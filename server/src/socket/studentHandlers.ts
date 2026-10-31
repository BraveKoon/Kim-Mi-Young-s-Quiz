import type { Server } from 'socket.io';
import { EVENTS } from '@shared/types/index.js';
import type { AppContext } from '../context.js';
import type { AppSocket } from './index.js';
import { rooms } from './roomManager.js';

type Ack = (r: unknown) => void;

/**
 * 학생 소켓 처리.
 * 중복 접속 정책: 같은 참가자가 새로 접속하면 기존 연결을 끊고 새 연결로 교체한다.
 * (새로고침·기기 변경 시에도 끊김 없이 이어서 참여할 수 있도록)
 */
export function registerStudentHandlers(io: Server, socket: AppSocket, ctx: AppContext) {
  const data = socket.data;
  if (data.role !== 'student') return;
  const { participantId, classId, sessionId } = data;
  const now = ctx.clock();

  const { previousSocketId, reconnected } = ctx.presence.connect(participantId, classId, socket.id);
  if (previousSocketId) {
    const old = io.sockets.sockets.get(previousSocketId);
    if (old) {
      old.emit(EVENTS.CONNECTION_STATUS, { status: 'replaced', message: '다른 창(기기)에서 접속하여 이 연결이 종료되었습니다.' });
      old.leave(rooms.participant(participantId));
      old.disconnect(true);
    }
    ctx.logger.log('CONNECTION_REPLACED', { classId, participantId, sessionId, details: { previousSocketId } });
  }
  socket.join([rooms.class(classId), rooms.participant(participantId)]);
  ctx.repos.participants.setSocket(participantId, socket.id, now);
  ctx.logger.log(reconnected ? 'STUDENT_RECONNECTED' : 'STUDENT_CONNECTED', { classId, participantId, sessionId });

  const personalState = () => ctx.sessions.getClassState(classId, 'student', participantId);
  socket.emit(EVENTS.CONNECTION_STATUS, { status: 'connected', participantId, classId, reconnected });
  socket.emit(EVENTS.STATE, { state: personalState() });
  ctx.sessions.publishParticipants(classId);

  socket.on(EVENTS.STUDENT_JOIN, (payload: { classId?: unknown } | undefined, ack?: Ack) => {
    if (payload?.classId !== undefined && payload.classId !== classId) {
      ctx.logger.log('INVALID_ROOM_ACCESS', { classId, participantId, sessionId, severity: 'warning', details: { requestedClassId: String(payload.classId) } });
      return typeof ack === 'function' && ack({ ok: false, error: 'INVALID_ROOM_ACCESS', message: '다른 학급에는 입장할 수 없습니다.' });
    }
    if (typeof ack === 'function') ack({ ok: true, state: personalState() });
  });

  socket.on(EVENTS.STUDENT_REQUEST_STATE, (_payload: unknown, ack?: Ack) => {
    const state = personalState();
    if (typeof ack === 'function') ack({ ok: true, state });
    else socket.emit(EVENTS.STATE, { state });
  });

  socket.on(EVENTS.STUDENT_SUBMIT, (payload: { questionId?: unknown; selectedIndex?: unknown } | undefined, ack?: Ack) => {
    // 클라이언트가 보낸 점수·정답 여부·응답 시간 등은 무시하고 questionId/selectedIndex 만 사용한다.
    let result;
    try {
      result = ctx.sessions.submitAnswer(participantId, { questionId: payload?.questionId, selectedIndex: payload?.selectedIndex });
    } catch (err) {
      console.error('submit_answer 오류', err);
      result = { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' };
    }
    if (typeof ack === 'function') ack(result);
  });

  socket.on('disconnect', (reason) => {
    if (ctx.presence.disconnect(participantId, socket.id)) {
      ctx.repos.participants.setSocket(participantId, null, ctx.clock());
      ctx.logger.log('STUDENT_DISCONNECTED', { classId, participantId, sessionId, details: { reason } });
      ctx.sessions.publishParticipants(classId);
    }
  });
}
