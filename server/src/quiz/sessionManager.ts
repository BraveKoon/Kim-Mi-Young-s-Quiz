import {
  CLASS_IDS,
  EVENTS,
  classDisplayName,
  type ClassOverview,
  type ClassState,
  type LeaderboardEntry,
  type NameDisplayMode,
  type PublicQuestion,
  type QuestionResult,
  type SessionStatus,
  type SubmitAnswerAck,
} from '@shared/types/index.js';
import type { AppConfig } from '../config/index.js';
import type { Repositories, SessionQuestionRow, SessionRow } from '../database/repositories/index.js';
import { displayName } from '../security/masking.js';
import type { ActivityLogger } from '../services/activityLogger.js';
import type { LeaderboardService } from '../services/leaderboardService.js';
import type { Presence } from '../socket/roomManager.js';
import type { Clock } from '../utils/clock.js';
import { AppError, badRequest, conflict, notFound } from '../utils/errors.js';
import { calculateScore } from './scoring.js';
import { ClassTimers } from './timer.js';

export type Audience = 'student' | 'projector' | 'admin';

/** 소켓 계층이 구현하는 브로드캐스트 인터페이스 (테스트에서는 대체 가능) */
export interface Broadcaster {
  /** 학급 단위 이벤트: 대상별로 다른 페이로드를 만들 수 있게 함수로 받는다. */
  toClass(classId: string, event: string, build: (audience: Audience) => unknown): void;
  toParticipant(participantId: number, event: string, payload: unknown): void;
  toAdmins(event: string, payload: unknown): void;
  disconnectParticipant(participantId: number, reason: string): void;
  disconnectAdmin(adminId: number): void;
}

export const nullBroadcaster: Broadcaster = {
  toClass() {},
  toParticipant() {},
  toAdmins() {},
  disconnectParticipant() {},
  disconnectAdmin() {},
};

/** 단답형 채점용 문자열 정규화 (유니코드 NFC, 앞뒤·연속 공백 정리, 영문 소문자화) */
export function normalizeShortAnswer(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 2배 점수 문제 시작 전 배너 표시 시간 */
export const DOUBLE_POINTS_LEAD_IN_MS = 2000;
/** 모든 접속자가 답한 경우 자동 마감까지 지연 */
const ALL_ANSWERED_DELAY_MS = 800;

const ACTIVE_STATUSES: SessionStatus[] = ['PLAYING', 'PAUSED', 'RESULT'];

export class SessionManager {
  readonly timers = new ClassTimers();
  broadcaster: Broadcaster = nullBroadcaster;
  private overviewTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(
    private repos: Repositories,
    private config: AppConfig,
    private clock: Clock,
    private logger: ActivityLogger,
    private leaderboard: LeaderboardService,
    private presence: Presence,
  ) {}

  // ───────────────────────── 상태 조회 ─────────────────────────

  private nameMode(): NameDisplayMode {
    return (this.repos.settings.get('projector_name_mode') as NameDisplayMode) ?? 'MASKED';
  }
  private leaderboardSize(): number {
    return Number(this.repos.settings.get('leaderboard_size') ?? 10) || 10;
  }

  private toPublicQuestion(sq: SessionQuestionRow, index: number): PublicQuestion {
    return {
      id: sq.question_id,
      index,
      questionType: sq.question_type,
      text: sq.question_text,
      // 단답형은 options 컬럼에 인정 답안이 저장되므로 학생/프로젝터에는 빈 배열만 내려 정답 노출을 차단한다.
      options: sq.question_type === 'SHORT_ANSWER' ? [] : (JSON.parse(sq.options) as string[]),
      timeLimit: sq.time_limit,
      isDoublePoints: sq.is_double_points === 1,
      category: sq.category,
    };
  }

  private currentQuestion(session: SessionRow): SessionQuestionRow | undefined {
    if (session.current_question_id == null) return undefined;
    return this.repos.sessions.sessionQuestion(session.id, session.current_question_id);
  }

  buildResults(session: SessionRow, sq: SessionQuestionRow): QuestionResult {
    const answers = this.repos.answers.forQuestion(session.id, sq.question_id);
    const options = JSON.parse(sq.options) as string[];
    const isShort = sq.question_type === 'SHORT_ANSWER';
    const distribution = isShort ? [0, 0] : options.map(() => 0);
    let correct = 0;
    let elapsedSum = 0;
    for (const a of answers) {
      if (isShort) {
        distribution[a.is_correct ? 0 : 1]++;
      } else if (a.selected_index >= 0 && a.selected_index < distribution.length) {
        distribution[a.selected_index]++;
      }
      if (a.is_correct) correct++;
      elapsedSum += a.elapsed_ms;
    }
    return {
      questionId: sq.question_id,
      index: session.current_question_index,
      correctIndex: sq.correct_index,
      ...(isShort ? { acceptedAnswers: options } : {}),
      explanation: sq.explanation,
      distribution,
      answeredCount: answers.length,
      correctCount: correct,
      participantCount: this.repos.participants.countBySession(session.id),
      averageElapsedMs: answers.length ? Math.round(elapsedSum / answers.length) : null,
    };
  }

  private maskBoard(entries: LeaderboardEntry[], audience: Audience): LeaderboardEntry[] {
    if (audience !== 'projector') return entries;
    const mode = this.nameMode();
    return entries.map((e) => ({ ...e, nickname: displayName(e.nickname, mode, e.rank) }));
  }

  /** 학급의 현재 상태 스냅샷 (정답은 RESULT/FINISHED 상태에서만 포함) */
  getClassState(classId: string, audience: Audience, participantId?: number): ClassState {
    const now = this.clock();
    const cls = this.repos.classes.find(classId);
    if (!cls) throw notFound('존재하지 않는 학급입니다.', 'CLASS_NOT_FOUND');
    const session = this.repos.sessions.currentForClass(classId);
    const base: ClassState = {
      classId,
      className: cls.name,
      sessionId: null,
      competitionId: null,
      competitionTitle: null,
      quizSetTitle: null,
      status: 'NO_SESSION',
      questionIndex: -1,
      totalQuestions: 0,
      question: null,
      startTime: null,
      endTime: null,
      remainingMs: null,
      serverNow: now,
      answeredCount: 0,
      participantCount: 0,
      connectedCount: this.presence.count(classId),
      capacity: cls.capacity,
      results: null,
      leaderboard: [],
    };
    if (!session) return base;
    const competition = this.repos.competitions.find(session.competition_id);
    const sq = ACTIVE_STATUSES.includes(session.status) ? this.currentQuestion(session) : undefined;
    const hideCurrent = session.status === 'PLAYING' || session.status === 'PAUSED';
    const ranking = this.leaderboard.sessionRanking(session.id, session.current_question_id, hideCurrent);
    const showBoard = !hideCurrent;
    const size = audience === 'admin' || session.status === 'FINISHED' ? ranking.length : this.leaderboardSize();

    const state: ClassState = {
      ...base,
      sessionId: session.id,
      competitionId: session.competition_id,
      competitionTitle: competition?.title ?? null,
      quizSetTitle: session.quiz_set_title,
      status: session.status,
      questionIndex: session.current_question_index,
      totalQuestions: session.question_count,
      question: sq ? this.toPublicQuestion(sq, session.current_question_index) : null,
      startTime: sq ? session.question_start_time : null,
      endTime: sq ? session.question_end_time : null,
      remainingMs:
        session.status === 'PLAYING' && session.question_end_time
          ? Math.max(0, session.question_end_time - now)
          : session.status === 'PAUSED'
            ? session.paused_remaining_ms
            : null,
      answeredCount: sq ? this.repos.answers.countForQuestion(session.id, sq.question_id) : 0,
      participantCount: ranking.length,
      results: sq && session.status === 'RESULT' ? this.buildResults(session, sq) : null,
      leaderboard: showBoard ? this.maskBoard(ranking.slice(0, size), audience) : [],
    };
    if (audience === 'admin') {
      state.answerKey = sq
        ? {
            correctIndex: sq.correct_index,
            explanation: sq.explanation,
            ...(sq.question_type === 'SHORT_ANSWER' ? { acceptedAnswers: JSON.parse(sq.options) as string[] } : {}),
          }
        : null;
    }

    if (participantId !== undefined) {
      const p = this.repos.participants.find(participantId);
      const entry = ranking.find((r) => r.participantId === participantId);
      if (p && p.session_id === session.id) {
        const ans = sq ? this.repos.answers.find(p.id, sq.question_id) : undefined;
        state.me = {
          participantId: p.id,
          nickname: p.nickname,
          totalScore: entry?.totalScore ?? 0,
          rank: entry?.rank ?? null,
          submitted: !!ans,
          selectedIndex: ans?.selected_index ?? null,
          answerText: ans?.answer_text ?? null,
          lastResult:
            sq && (session.status === 'RESULT' || session.status === 'FINISHED')
              ? { isCorrect: ans?.is_correct === 1, awardedScore: ans?.awarded_score ?? 0 }
              : null,
        };
      }
    }
    return state;
  }

  /** 관리자 대시보드용 전체 학급 현황 */
  getOverview(): { classes: ClassOverview[]; totals: Record<string, number> } {
    const classes = this.repos.classes.all().map((cls): ClassOverview => {
      const session = cls.current_session_id ? this.repos.sessions.find(cls.current_session_id) : undefined;
      const connectedCount = this.presence.count(cls.id);
      if (!session) {
        return {
          classId: cls.id, className: cls.name, capacity: cls.capacity, sessionId: null, competitionId: null, competitionTitle: null,
          quizSetTitle: null, status: 'NO_SESSION', questionIndex: -1, totalQuestions: 0, participantCount: 0, connectedCount,
          disconnectedCount: 0, answeredCount: 0, completedCount: 0, averageScore: 0, joinable: false,
        };
      }
      const agg = this.repos.db
        .prepare(
          `SELECT COUNT(*) AS n, COALESCE(AVG(total_score), 0) AS avg,
                  COALESCE(SUM(CASE WHEN ? > 0 AND answer_count >= ? THEN 1 ELSE 0 END), 0) AS completed
           FROM participants WHERE session_id = ?`,
        )
        .get(session.question_count, session.question_count, session.id) as { n: number; avg: number; completed: number };
      const answered =
        session.current_question_id != null && ACTIVE_STATUSES.includes(session.status)
          ? this.repos.answers.countForQuestion(session.id, session.current_question_id)
          : 0;
      return {
        classId: cls.id,
        className: cls.name,
        capacity: cls.capacity,
        sessionId: session.id,
        competitionId: session.competition_id,
        competitionTitle: this.repos.competitions.find(session.competition_id)?.title ?? null,
        quizSetTitle: session.quiz_set_title,
        status: session.status,
        questionIndex: session.current_question_index,
        totalQuestions: session.question_count,
        participantCount: agg.n,
        connectedCount,
        disconnectedCount: Math.max(0, agg.n - connectedCount),
        answeredCount: answered,
        completedCount: agg.completed,
        averageScore: Math.round(agg.avg),
        joinable: session.status !== 'FINISHED' && agg.n < cls.capacity,
      };
    });
    const totals = {
      classes: classes.length,
      capacity: classes.reduce((s, c) => s + c.capacity, 0),
      participants: classes.reduce((s, c) => s + c.participantCount, 0),
      connected: classes.reduce((s, c) => s + c.connectedCount, 0),
      playing: classes.filter((c) => c.status === 'PLAYING' || c.status === 'RESULT' || c.status === 'PAUSED').length,
    };
    return { classes, totals };
  }

  /** 관리자 현황 브로드캐스트 (짧게 묶어서 과도한 전송 방지) */
  notifyOverview() {
    if (this.closed || this.overviewTimer) return;
    this.overviewTimer = setTimeout(() => {
      this.overviewTimer = null;
      if (this.closed) return;
      try {
        this.broadcaster.toAdmins(EVENTS.ADMIN_OVERVIEW, this.getOverview());
      } catch (err) {
        console.error('overview broadcast 실패', err);
      }
    }, 300);
  }

  /** 학급 상태 이벤트 발행: 학생/프로젝터/관리자에게 각각 맞는 상태를 전송 */
  publish(classId: string, event: string, extra: Record<string, unknown> = {}) {
    const cache = new Map<Audience, ClassState>();
    this.broadcaster.toClass(classId, event, (aud) => {
      if (!cache.has(aud)) cache.set(aud, this.getClassState(classId, aud));
      return { ...extra, state: cache.get(aud) };
    });
    this.notifyOverview();
  }

  /** 대기실 참가자 목록 (대상별로 점수·이름 노출 수준이 다름) */
  participantsPayload(classId: string, audience: Audience) {
    const session = this.repos.sessions.currentForClass(classId);
    const list = session
      ? this.repos.participants.bySession(session.id).map((p) => ({
          id: p.id,
          nickname: p.nickname,
          totalScore: p.total_score,
          connected: this.presence.isConnected(p.id),
        }))
      : [];
    const mode = this.nameMode();
    return {
      classId,
      count: list.length,
      connectedCount: this.presence.count(classId),
      participants:
        audience === 'projector'
          ? list.map((p) => ({ ...p, totalScore: 0, nickname: displayName(p.nickname, mode) }))
          : audience === 'student'
            ? list.map((p) => ({ ...p, totalScore: 0 })) // 진행 중 점수 노출 방지
            : list,
    };
  }

  publishParticipants(classId: string) {
    const cache = new Map<Audience, unknown>();
    this.broadcaster.toClass(classId, EVENTS.PARTICIPANTS, (aud) => {
      if (!cache.has(aud)) cache.set(aud, this.participantsPayload(classId, aud));
      return cache.get(aud);
    });
    this.notifyOverview();
  }

  // ───────────────────────── 상태 전이 ─────────────────────────

  private requireSession(classId: string): SessionRow {
    if (!CLASS_IDS.includes(classId)) throw notFound('존재하지 않는 학급입니다.', 'CLASS_NOT_FOUND');
    const s = this.repos.sessions.currentForClass(classId);
    if (!s) throw conflict('이 학급에는 생성된 퀴즈 세션이 없습니다.', 'NO_SESSION');
    return s;
  }

  startQuiz(classId: string) {
    const session = this.requireSession(classId);
    if (session.status !== 'WAITING') throw conflict('대기 중인 세션만 시작할 수 있습니다.', 'INVALID_STATE');
    if (!session.quiz_set_id) throw badRequest('문제 세트가 지정되지 않았습니다.', 'NO_QUIZ_SET');
    const questions = this.repos.quizSets.questions(session.quiz_set_id);
    if (!questions.length) throw badRequest('문제 세트에 문제가 없습니다.', 'EMPTY_QUIZ_SET');
    const now = this.clock();
    this.repos.tx(() => {
      this.repos.sessions.snapshotQuestions(
        session.id,
        questions.map((q, i) => ({
          question_id: q.id,
          order_num: i + 1,
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options,
          correct_index: q.correct_index,
          time_limit: q.time_limit,
          is_double_points: q.is_double_points,
          explanation: q.explanation,
          category: q.category,
        })),
      );
      this.repos.sessions.update(session.id, { question_count: questions.length, started_at: now }, now);
      this.repos.competitions.markStarted(session.competition_id, now);
    });
    this.logger.log('QUIZ_STARTED', { classId, sessionId: session.id, details: { questionCount: questions.length } });
    this.startQuestion(classId, session.id, 0, EVENTS.STARTED);
  }

  private startQuestion(classId: string, sessionId: number, index: number, event: string = EVENTS.QUESTION) {
    const sq = this.repos.sessions.sessionQuestionAt(sessionId, index);
    if (!sq) throw badRequest('문제를 찾을 수 없습니다.');
    const now = this.clock();
    const leadIn = sq.is_double_points ? DOUBLE_POINTS_LEAD_IN_MS : 0;
    const start = now + leadIn;
    const end = start + sq.time_limit * 1000;
    this.repos.sessions.update(
      sessionId,
      {
        status: 'PLAYING',
        current_question_id: sq.question_id,
        current_question_index: index,
        question_start_time: start,
        question_end_time: end,
        paused_remaining_ms: null,
        paused_from_status: null,
      },
      now,
    );
    this.scheduleClose(classId, sessionId, sq.question_id, end);
    this.logger.log('QUESTION_STARTED', { classId, sessionId, details: { index, questionId: sq.question_id } });
    if (event !== EVENTS.QUESTION) this.publish(classId, event);
    this.publish(classId, EVENTS.QUESTION);
  }

  private scheduleClose(classId: string, sessionId: number, questionId: number, endTime: number) {
    const delay = endTime - this.clock() + this.config.answerGraceMs;
    this.timers.schedule(
      classId,
      delay,
      () => this.closeQuestion(classId, sessionId, questionId, 'TIME_UP'),
      () => this.emitTimer(classId),
    );
  }

  private emitTimer(classId: string) {
    const s = this.repos.sessions.currentForClass(classId);
    if (!s || s.status !== 'PLAYING' || !s.question_end_time) return;
    const now = this.clock();
    const payload = {
      classId,
      remainingMs: Math.max(0, s.question_end_time - now),
      startTime: s.question_start_time,
      endTime: s.question_end_time,
      serverNow: now,
    };
    this.broadcaster.toClass(classId, EVENTS.TIMER, () => payload);
  }

  /** 문제 마감 + 결과 공개. 타이머 만료/전원 제출/관리자 요청 시 호출. 중복 호출에 안전하다. */
  closeQuestion(classId: string, sessionId: number, questionId: number, reason: 'TIME_UP' | 'ALL_ANSWERED' | 'ADMIN' | 'RECOVERY') {
    const session = this.repos.sessions.currentForClass(classId);
    if (!session || session.id !== sessionId || session.current_question_id !== questionId) return false;
    if (session.status !== 'PLAYING' && !(reason === 'ADMIN' && session.status === 'PAUSED')) return false;
    const now = this.clock();
    this.timers.clear(classId);
    this.repos.sessions.update(
      sessionId,
      {
        status: 'RESULT',
        question_end_time: Math.min(session.question_end_time ?? now, Math.max(now, session.question_start_time ?? now)),
        paused_remaining_ms: null,
        paused_from_status: null,
      },
      now,
    );
    this.logger.log('RESULTS_SHOWN', { classId, sessionId, details: { questionId, reason } });
    this.publish(classId, EVENTS.RESULTS, { reason });
    this.sendPersonalResults(classId, sessionId, questionId);
    this.publish(classId, EVENTS.LEADERBOARD);
    return true;
  }

  private sendPersonalResults(classId: string, sessionId: number, questionId: number) {
    const ranking = this.leaderboard.sessionRanking(sessionId, questionId);
    for (const pid of this.presence.connectedIds(classId)) {
      const entry = ranking.find((r) => r.participantId === pid);
      if (!entry) continue;
      const ans = this.repos.answers.find(pid, questionId);
      this.broadcaster.toParticipant(pid, EVENTS.MY_RESULT, {
        questionId,
        submitted: !!ans,
        selectedIndex: ans?.selected_index ?? null,
        answerText: ans?.answer_text ?? null,
        isCorrect: ans?.is_correct === 1,
        awardedScore: ans?.awarded_score ?? 0,
        totalScore: entry.totalScore,
        rank: entry.rank,
        prevRank: entry.prevRank,
        participantCount: ranking.length,
      });
    }
  }

  showResults(classId: string) {
    const s = this.requireSession(classId);
    if (s.status !== 'PLAYING' && s.status !== 'PAUSED') throw conflict('진행 중인 문제가 없습니다.', 'INVALID_STATE');
    this.closeQuestion(classId, s.id, s.current_question_id!, 'ADMIN');
  }

  nextQuestion(classId: string) {
    const s = this.requireSession(classId);
    if (s.status === 'PLAYING' || s.status === 'PAUSED') {
      throw conflict('현재 문제의 결과를 먼저 공개하세요.', 'RESULTS_NOT_SHOWN');
    }
    if (s.status !== 'RESULT') throw conflict('결과 화면에서만 다음 문제로 이동할 수 있습니다.', 'INVALID_STATE');
    const next = s.current_question_index + 1;
    if (next >= s.question_count) return this.finishQuiz(classId);
    this.startQuestion(classId, s.id, next);
  }

  pauseQuiz(classId: string) {
    const s = this.requireSession(classId);
    if (s.status !== 'PLAYING') throw conflict('진행 중인 문제만 일시정지할 수 있습니다.', 'INVALID_STATE');
    const now = this.clock();
    const remaining = Math.max(0, (s.question_end_time ?? now) - now);
    this.timers.clear(classId);
    this.repos.sessions.update(s.id, { status: 'PAUSED', paused_remaining_ms: remaining, paused_from_status: 'PLAYING' }, now);
    this.logger.log('QUIZ_PAUSED', { classId, sessionId: s.id, details: { remainingMs: remaining } });
    this.publish(classId, EVENTS.PAUSED, { remainingMs: remaining });
  }

  resumeQuiz(classId: string) {
    const s = this.requireSession(classId);
    if (s.status !== 'PAUSED') throw conflict('일시정지 상태가 아닙니다.', 'INVALID_STATE');
    const sq = this.currentQuestion(s);
    if (!sq) throw conflict('재개할 문제가 없습니다.', 'INVALID_STATE');
    const now = this.clock();
    const remaining = s.paused_remaining_ms ?? 0;
    // 새 기준 시각: 남은 시간을 보존하고, 경과 시간이 연속되도록 시작 시각을 재계산
    const end = now + remaining;
    const start = end - sq.time_limit * 1000;
    this.repos.sessions.update(
      s.id,
      { status: 'PLAYING', question_start_time: start, question_end_time: end, paused_remaining_ms: null, paused_from_status: null },
      now,
    );
    this.scheduleClose(classId, s.id, sq.question_id, end);
    this.logger.log('QUIZ_RESUMED', { classId, sessionId: s.id, details: { remainingMs: remaining } });
    this.publish(classId, EVENTS.RESUMED);
  }

  finishQuiz(classId: string) {
    const s = this.requireSession(classId);
    if (s.status === 'FINISHED') throw conflict('이미 종료된 퀴즈입니다.', 'INVALID_STATE');
    const now = this.clock();
    this.timers.clear(classId);
    this.repos.tx(() => {
      this.repos.sessions.update(s.id, { status: 'FINISHED', finished_at: now, paused_remaining_ms: null, paused_from_status: null }, now);
      const all = this.repos.sessions.byCompetition(s.competition_id);
      if (all.every((x) => x.id === s.id || x.status === 'FINISHED')) this.repos.competitions.markFinished(s.competition_id, now);
    });
    this.logger.log('QUIZ_FINISHED', { classId, sessionId: s.id });
    this.publish(classId, EVENTS.FINISHED);
    // 학생별 최종 결과
    const ranking = this.leaderboard.sessionRanking(s.id, null);
    for (const pid of this.presence.connectedIds(classId)) {
      const e = ranking.find((r) => r.participantId === pid);
      if (e) this.broadcaster.toParticipant(pid, EVENTS.MY_RESULT, { final: true, totalScore: e.totalScore, rank: e.rank, participantCount: ranking.length });
    }
  }

  /**
   * 학급 초기화: 현재 세션의 답안과 점수를 지우고 대기 상태로 되돌린다.
   * 종료된 대회의 기록은 보존해야 하므로 초기화할 수 없다(새 세션을 생성해야 함).
   */
  resetClass(classId: string, opts: { removeParticipants?: boolean } = {}) {
    const s = this.requireSession(classId);
    const comp = this.repos.competitions.find(s.competition_id);
    if (comp?.status === 'FINISHED') {
      throw new AppError(409, 'COMPETITION_FINISHED', '종료된 대회의 기록은 보존됩니다. 새 세션을 생성하세요.');
    }
    const now = this.clock();
    this.timers.clear(classId);
    const removed = opts.removeParticipants ? this.repos.participants.bySession(s.id).map((p) => p.id) : [];
    this.repos.tx(() => {
      this.repos.answers.deleteBySession(s.id);
      this.repos.participants.resetScores(s.id, now);
      if (opts.removeParticipants) this.repos.participants.deleteBySession(s.id);
      this.repos.sessions.update(
        s.id,
        {
          status: 'WAITING',
          current_question_id: null,
          current_question_index: -1,
          question_start_time: null,
          question_end_time: null,
          paused_remaining_ms: null,
          paused_from_status: null,
          started_at: null,
          finished_at: null,
        },
        now,
      );
    });
    this.logger.log('CLASS_RESET', { classId, sessionId: s.id, severity: 'warning', details: { removeParticipants: !!opts.removeParticipants } });
    this.publish(classId, EVENTS.RESET, { reason: opts.removeParticipants ? 'PARTICIPANTS_REMOVED' : 'RESET' });
    for (const pid of removed) {
      this.broadcaster.disconnectParticipant(pid, 'PARTICIPANTS_REMOVED');
      this.presence.remove(pid);
    }
    this.publishParticipants(classId);
  }

  resetAll(opts: { removeParticipants?: boolean } = {}) {
    const result: { classId: string; ok: boolean; error?: string }[] = [];
    for (const classId of CLASS_IDS) {
      try {
        if (!this.repos.sessions.currentForClass(classId)) continue;
        this.resetClass(classId, opts);
        result.push({ classId, ok: true });
      } catch (err) {
        result.push({ classId, ok: false, error: (err as Error).message });
      }
    }
    this.logger.log('ALL_RESET', { severity: 'critical', details: { removeParticipants: !!opts.removeParticipants } });
    return result;
  }

  /** 학급에 새 세션 생성(새 대회/문제 세트). 진행 중인 세션이 있으면 거부. */
  createSession(classId: string, competitionId: number, quizSetId: number) {
    if (!CLASS_IDS.includes(classId)) throw notFound('존재하지 않는 학급입니다.', 'CLASS_NOT_FOUND');
    const comp = this.repos.competitions.find(competitionId);
    if (!comp) throw notFound('대회를 찾을 수 없습니다.');
    const set = this.repos.quizSets.find(quizSetId);
    if (!set) throw notFound('문제 세트를 찾을 수 없습니다.');
    const count = this.repos.quizSets.questionIds(quizSetId).length;
    if (!count) throw badRequest('문제 세트에 문제가 없습니다.', 'EMPTY_QUIZ_SET');
    const current = this.repos.sessions.currentForClass(classId);
    if (current && ACTIVE_STATUSES.includes(current.status)) {
      throw conflict(`${classDisplayName(classId)}은(는) 퀴즈가 진행 중입니다. 종료 후 새 세션을 만드세요.`, 'SESSION_ACTIVE');
    }
    const now = this.clock();
    const oldParticipants = current ? this.repos.participants.bySession(current.id).map((p) => p.id) : [];
    const sessionId = this.repos.tx(() => {
      const id = this.repos.sessions.create(classId, competitionId, quizSetId, set.title, count, now);
      this.repos.classes.setCurrentSession(classId, id);
      if (comp.status === 'FINISHED') this.repos.competitions.markStarted(competitionId, now);
      return id;
    });
    this.logger.log('SESSION_CREATED', { classId, sessionId, details: { competitionId, quizSetId } });
    // 이전 세션의 학생은 새 세션에 다시 입장해야 한다.
    this.publish(classId, EVENTS.RESET, { reason: 'NEW_SESSION' });
    for (const pid of oldParticipants) {
      this.broadcaster.disconnectParticipant(pid, 'NEW_SESSION');
      this.presence.remove(pid);
    }
    this.publishParticipants(classId);
    return sessionId;
  }

  // ───────────────────────── 답안 제출 ─────────────────────────

  submitAnswer(participantId: number, payload: { questionId: unknown; selectedIndex?: unknown; answerText?: unknown }): SubmitAnswerAck {
    const now = this.clock(); // 서버 수신 시각
    const p = this.repos.participants.find(participantId);
    if (!p) return { ok: false, error: 'INVALID_PARTICIPANT', message: '참가자 정보를 찾을 수 없습니다.' };
    const s = this.repos.sessions.currentForClass(p.class_id);
    const logBase = { classId: p.class_id, participantId: p.id, sessionId: s?.id ?? p.session_id };
    if (!s || s.id !== p.session_id) {
      this.logger.log('ANSWER_WHEN_CLOSED', { ...logBase, severity: 'warning', details: { reason: 'SESSION_CHANGED' } });
      return { ok: false, error: 'SESSION_CHANGED', message: '세션이 변경되었습니다. 다시 입장하세요.' };
    }
    if (s.status === 'PAUSED') return { ok: false, error: 'PAUSED', message: '퀴즈가 일시정지 중입니다.' };
    if (s.status !== 'PLAYING') {
      this.logger.log('ANSWER_WHEN_CLOSED', { ...logBase, severity: 'warning', details: { status: s.status } });
      return { ok: false, error: 'CLOSED', message: '답안 제출이 마감되었습니다.' };
    }
    const questionId = Number(payload.questionId);
    const selectedIndex = payload.selectedIndex;
    if (!Number.isInteger(questionId) || questionId !== s.current_question_id) {
      this.logger.log('INVALID_ANSWER', { ...logBase, severity: 'warning', details: { reason: 'WRONG_QUESTION', questionId: payload.questionId } });
      return { ok: false, error: 'WRONG_QUESTION', message: '현재 진행 중인 문제가 아닙니다.' };
    }
    const sq = this.repos.sessions.sessionQuestion(s.id, questionId)!;
    const isShort = sq.question_type === 'SHORT_ANSWER';
    const rawOptions = JSON.parse(sq.options) as string[];
    let trimmedText = '';
    if (isShort) {
      if (typeof payload.answerText !== 'string') {
        this.logger.log('INVALID_ANSWER', { ...logBase, severity: 'warning', details: { reason: 'INVALID_TEXT' } });
        return { ok: false, error: 'INVALID_OPTION', message: '답안을 입력하세요.' };
      }
      trimmedText = payload.answerText.normalize('NFC').replace(/\s+/g, ' ').trim();
      if (!trimmedText || trimmedText.length > 120) {
        this.logger.log('INVALID_ANSWER', { ...logBase, severity: 'warning', details: { reason: 'INVALID_TEXT_LENGTH', length: trimmedText.length } });
        return { ok: false, error: 'INVALID_OPTION', message: !trimmedText ? '답안을 입력하세요.' : '답안은 120자 이하로 입력하세요.' };
      }
    } else {
      const optionCount = rawOptions.length;
      if (typeof selectedIndex !== 'number' || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= optionCount) {
        this.logger.log('INVALID_ANSWER', { ...logBase, severity: 'warning', details: { reason: 'INVALID_OPTION', selectedIndex: String(selectedIndex) } });
        return { ok: false, error: 'INVALID_OPTION', message: '잘못된 보기입니다.' };
      }
    }
    const start = s.question_start_time!;
    const end = s.question_end_time!;
    if (now < start) return { ok: false, error: 'NOT_STARTED', message: '아직 문제가 시작되지 않았습니다.' };
    if (now > end + this.config.answerGraceMs) {
      this.logger.log('LATE_ANSWER', { ...logBase, severity: 'warning', details: { questionId, lateByMs: now - end } });
      return { ok: false, error: 'TIME_OVER', message: '제한시간이 지났습니다.' };
    }
    if (this.repos.answers.find(p.id, questionId)) {
      this.logger.log('DUPLICATE_ANSWER', { ...logBase, severity: 'warning', details: { questionId } });
      return { ok: true, duplicate: true, message: '이미 제출한 답안입니다.' };
    }
    const elapsedMs = Math.min(Math.max(0, now - start), sq.time_limit * 1000);
    const isCorrect = isShort
      ? rawOptions.map(normalizeShortAnswer).includes(normalizeShortAnswer(trimmedText))
      : selectedIndex === sq.correct_index;
    const storedIndex = isShort ? (isCorrect ? 0 : -1) : (selectedIndex as number);
    const score = calculateScore({ isCorrect, elapsedMs, timeLimitSec: sq.time_limit, isDoublePoints: sq.is_double_points === 1 });

    const inserted = this.repos.tx(() => {
      const ok = this.repos.answers.insert({
        session_id: s.id,
        participant_id: p.id,
        class_id: p.class_id,
        question_id: questionId,
        selected_index: storedIndex,
        answer_text: isShort ? trimmedText : null,
        is_correct: isCorrect ? 1 : 0,
        awarded_score: score,
        elapsed_ms: elapsedMs,
        submitted_at: now,
      });
      if (ok) this.repos.participants.addScore(p.id, score, isCorrect, elapsedMs, now);
      return ok;
    });
    if (!inserted) {
      this.logger.log('DUPLICATE_ANSWER', { ...logBase, severity: 'warning', details: { questionId } });
      return { ok: true, duplicate: true, message: '이미 제출한 답안입니다.' };
    }

    const answeredCount = this.repos.answers.countForQuestion(s.id, questionId);
    const participantCount = this.repos.participants.countBySession(s.id);
    this.broadcaster.toClass(p.class_id, EVENTS.ANSWER_RECEIVED, () => ({ classId: p.class_id, questionId, answeredCount, participantCount }));
    this.notifyOverview();

    // 접속 중인 학생 전원이 제출하면 자동 마감
    const connected = this.presence.connectedIds(p.class_id);
    const answeredIds = new Set(this.repos.answers.forQuestion(s.id, questionId).map((a) => a.participant_id));
    const allAnswered = answeredCount >= participantCount || (connected.length > 0 && connected.every((id) => answeredIds.has(id)));
    if (allAnswered) {
      this.timers.defer(p.class_id, ALL_ANSWERED_DELAY_MS, () => this.closeQuestion(p.class_id, s.id, questionId, 'ALL_ANSWERED'));
    }
    return { ok: true };
  }

  // ───────────────────────── 복구 ─────────────────────────

  /** 서버 재시작 시 DB에 저장된 세션 상태를 기준으로 타이머를 복구한다. */
  recover() {
    const now = this.clock();
    const recovered: string[] = [];
    for (const s of this.repos.sessions.allCurrent()) {
      if (s.status !== 'PLAYING' || s.current_question_id == null) continue;
      if ((s.question_end_time ?? 0) + this.config.answerGraceMs <= now) {
        this.closeQuestion(s.class_id, s.id, s.current_question_id, 'RECOVERY');
      } else {
        this.scheduleClose(s.class_id, s.id, s.current_question_id, s.question_end_time!);
      }
      recovered.push(s.class_id);
      this.logger.log('SERVER_RECOVERED', { classId: s.class_id, sessionId: s.id, details: { status: s.status } });
    }
    return recovered;
  }

  shutdown() {
    this.closed = true;
    this.timers.clearAll();
    if (this.overviewTimer) clearTimeout(this.overviewTimer);
    this.overviewTimer = null;
  }
}
