import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { EVENTS, isValidClassId } from '@shared/types/index.js';
import type { AppContext } from '../context.js';
import type { Broadcaster } from '../quiz/sessionManager.js';
import { TokenBucket } from '../security/eventRateLimiter.js';
import { registerAdminHandlers } from './adminHandlers.js';
import { rooms } from './roomManager.js';
import { registerStudentHandlers } from './studentHandlers.js';

export type SocketData =
  | { role: 'admin'; adminId: number; username: string; token: string }
  | { role: 'student'; participantId: number; classId: string; sessionId: number; nickname: string }
  | { role: 'projector'; classId: string };

export type AppSocket = Socket<any, any, any, SocketData>;

export function createSocketServer(httpServer: HttpServer, ctx: AppContext) {
  const io = new Server<any, any, any, SocketData>(httpServer, {
    cors: { origin: ctx.config.clientOrigins.includes('*') ? true : ctx.config.clientOrigins },
    pingInterval: 20000,
    pingTimeout: 20000,
    maxHttpBufferSize: 16 * 1024,
    connectionStateRecovery: undefined,
  });

  // 브로드캐스트 구현: 필요한 학급 Room에만 전송하며, 대상(학생/프로젝터/관리자)별 페이로드를 분리한다.
  const hasMembers = (room: string) => (io.sockets.adapter.rooms.get(room)?.size ?? 0) > 0;
  const broadcaster: Broadcaster = {
    toClass(classId, event, build) {
      if (hasMembers(rooms.class(classId))) io.to(rooms.class(classId)).emit(event, build('student'));
      if (hasMembers(rooms.projector(classId))) io.to(rooms.projector(classId)).emit(event, build('projector'));
      if (hasMembers(rooms.adminClass(classId))) io.to(rooms.adminClass(classId)).emit(event, build('admin'));
    },
    toParticipant(participantId, event, payload) {
      io.to(rooms.participant(participantId)).emit(event, payload);
    },
    toAdmins(event, payload) {
      if (hasMembers(rooms.admins)) io.to(rooms.admins).emit(event, payload);
    },
    disconnectParticipant(participantId, reason) {
      io.to(rooms.participant(participantId)).emit(EVENTS.RESET, { reason });
      io.in(rooms.participant(participantId)).disconnectSockets(true);
    },
  };
  ctx.sessions.broadcaster = broadcaster;
  ctx.logger.onLog((entry) => broadcaster.toAdmins(EVENTS.ADMIN_LOG, entry));

  // ── 핸드셰이크 인증
  io.use((socket, next) => {
    const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    try {
      if (auth.role === 'admin') {
        const { admin } = ctx.auth.verify(String(auth.token ?? ''));
        if (admin.must_change_password) return next(new Error('PASSWORD_CHANGE_REQUIRED'));
        socket.data = { role: 'admin', adminId: admin.id, username: admin.username, token: String(auth.token) };
        return next();
      }
      if (auth.role === 'student') {
        const p = ctx.participants.authenticate(auth.participantId, auth.token);
        if (!p) {
          ctx.logger.log('INVALID_PARTICIPANT', { severity: 'warning', details: { participantId: String(auth.participantId ?? ''), ip: socket.handshake.address } });
          return next(new Error('INVALID_PARTICIPANT'));
        }
        if (auth.classId !== undefined && auth.classId !== p.class_id) {
          ctx.logger.log('INVALID_ROOM_ACCESS', { classId: p.class_id, participantId: p.id, severity: 'warning', details: { requestedClassId: String(auth.classId) } });
          return next(new Error('INVALID_ROOM_ACCESS'));
        }
        const current = ctx.repos.sessions.currentForClass(p.class_id);
        if (!current || current.id !== p.session_id) return next(new Error('SESSION_CHANGED'));
        socket.data = { role: 'student', participantId: p.id, classId: p.class_id, sessionId: p.session_id, nickname: p.nickname };
        return next();
      }
      if (auth.role === 'projector') {
        if (!isValidClassId(auth.classId)) return next(new Error('INVALID_CLASS'));
        socket.data = { role: 'projector', classId: auth.classId };
        return next();
      }
      return next(new Error('UNAUTHORIZED'));
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: AppSocket) => {
    // ── 이벤트 단위 보안 검사: 속도 제한 + 관리자 이벤트 권한 확인
    const bucket = new TokenBucket(30, 10);
    let lastRateLog = 0;
    socket.use(([event, ...args], next) => {
      const ack = typeof args[args.length - 1] === 'function' ? (args[args.length - 1] as (r: unknown) => void) : undefined;
      const d = socket.data;
      const who = d.role === 'student' ? { classId: d.classId, participantId: d.participantId } : d.role === 'projector' ? { classId: d.classId } : {};
      if (!bucket.take()) {
        if (Date.now() - lastRateLog > 10_000) {
          lastRateLog = Date.now();
          ctx.logger.log('RATE_LIMITED', { ...who, severity: 'warning', details: { via: 'socket', event, role: d.role } });
        }
        ack?.({ ok: false, error: 'RATE_LIMITED', message: '요청이 너무 많습니다.' });
        return;
      }
      if (typeof event === 'string' && event.startsWith('admin:') && d.role !== 'admin') {
        ctx.logger.log('UNAUTHORIZED_ADMIN_EVENT', { ...who, severity: 'critical', details: { event, role: d.role } });
        ack?.({ ok: false, error: 'FORBIDDEN', message: '권한이 없습니다.' });
        return;
      }
      if (typeof event === 'string' && event.startsWith('student:') && d.role !== 'student') {
        ack?.({ ok: false, error: 'FORBIDDEN', message: '학생 전용 이벤트입니다.' });
        return;
      }
      next();
    });

    const d = socket.data;
    if (d.role === 'admin') registerAdminHandlers(io, socket, ctx);
    else if (d.role === 'student') registerStudentHandlers(io, socket, ctx);
    else if (d.role === 'projector') {
      const classId = d.classId;
      socket.join(rooms.projector(classId));
      socket.emit(EVENTS.STATE, { state: ctx.sessions.getClassState(classId, 'projector') });
      socket.on(EVENTS.PROJECTOR_REQUEST_STATE, (_p: unknown, ack?: (r: unknown) => void) => {
        const state = ctx.sessions.getClassState(classId, 'projector');
        if (typeof ack === 'function') ack({ ok: true, state });
        else socket.emit(EVENTS.STATE, { state });
      });
    }
  });

  return io;
}
