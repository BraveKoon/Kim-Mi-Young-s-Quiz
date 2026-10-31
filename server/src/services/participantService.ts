import { isValidClassId } from '@shared/types/index.js';
import type { AppConfig } from '../config/index.js';
import type { ParticipantRow, Repositories } from '../database/repositories/index.js';
import { hashToken, randomToken } from '../security/tokens.js';
import type { Clock } from '../utils/clock.js';
import { AppError, conflict, notFound } from '../utils/errors.js';
import type { ActivityLogger } from './activityLogger.js';

export class ParticipantService {
  constructor(private repos: Repositories, private config: AppConfig, private clock: Clock, private logger: ActivityLogger) {}

  /**
   * 학급 입장. 정원·닉네임 중복 검사와 삽입을 하나의 트랜잭션으로 처리한다.
   * better-sqlite3 트랜잭션은 동기 실행이므로 동시에 들어온 요청 사이에서도 원자적이다.
   */
  join(classId: string, nickname: string) {
    if (!isValidClassId(classId)) throw notFound('존재하지 않는 학급입니다.', 'CLASS_NOT_FOUND');
    const now = this.clock();
    const token = randomToken();
    const result = this.repos.tx(() => {
      const cls = this.repos.classes.find(classId)!;
      const session = this.repos.sessions.currentForClass(classId);
      if (!session) throw new AppError(409, 'NO_SESSION', '아직 이 학급의 퀴즈가 준비되지 않았습니다. 선생님께 문의하세요.');
      if (session.status === 'FINISHED') throw new AppError(409, 'SESSION_FINISHED', '이 학급의 퀴즈는 이미 종료되었습니다.');
      if (this.repos.participants.findByNickname(session.id, nickname)) {
        throw conflict('이미 사용 중인 닉네임입니다. 다른 닉네임을 입력하세요.', 'NICKNAME_TAKEN');
      }
      if (this.repos.participants.countBySession(session.id) >= cls.capacity) {
        throw new AppError(409, 'CLASS_FULL', `정원(${cls.capacity}명)이 가득 찼습니다.`);
      }
      const id = this.repos.participants.create(session.id, classId, nickname, now);
      this.repos.participants.addToken(id, hashToken(token), now, now + this.config.participantTokenTtlHours * 3600_000);
      return { participantId: id, sessionId: session.id };
    });
    this.logger.log('STUDENT_JOINED', { classId, participantId: result.participantId, sessionId: result.sessionId, details: { nickname } });
    return { ...result, classId, nickname, token };
  }

  /** participantId + 토큰 검증. 실패 시 null */
  authenticate(participantId: unknown, token: unknown): ParticipantRow | null {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
    const p = this.repos.participants.findByToken(hashToken(token), this.clock());
    if (!p || p.id !== Number(participantId)) return null;
    return p;
  }

  remove(participantId: number) {
    const p = this.repos.participants.find(participantId);
    if (!p) throw notFound('참가자를 찾을 수 없습니다.');
    this.repos.participants.delete(participantId);
    this.logger.log('STUDENT_REMOVED', { classId: p.class_id, sessionId: p.session_id, details: { nickname: p.nickname, participantId } });
    return p;
  }
}
