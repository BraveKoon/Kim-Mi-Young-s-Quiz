import type { Server } from 'socket.io';
import { EVENTS, isValidClassId } from '@shared/types/index.js';
import type { AppContext } from '../context.js';
import { AppError } from '../utils/errors.js';
import type { AppSocket } from './index.js';
import { rooms } from './roomManager.js';

type Ack = (r: unknown) => void;

export function registerAdminHandlers(_io: Server, socket: AppSocket, ctx: AppContext) {
  const data = socket.data;
  if (data.role !== 'admin') return;
  socket.join(rooms.admins);
  socket.emit(EVENTS.ADMIN_OVERVIEW, ctx.sessions.getOverview());

  /** 매 이벤트마다 토큰 재검증(만료·로그아웃·비밀번호 변경 반영) 후 실행 */
  const handle = (event: string, fn: (payload: any) => unknown) => {
    socket.on(event, (payload: any, ack?: Ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const { admin } = ctx.auth.verify(data.token);
        if (admin.must_change_password) throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', '초기 비밀번호를 먼저 변경해야 합니다.');
      } catch (err) {
        reply({ ok: false, error: (err as AppError).code ?? 'UNAUTHORIZED', message: (err as Error).message });
        socket.disconnect(true);
        return;
      }
      try {
        const result = fn(payload ?? {});
        reply({ ok: true, ...(result && typeof result === 'object' ? result : {}) });
      } catch (err) {
        if (err instanceof AppError) reply({ ok: false, error: err.code, message: err.message });
        else {
          console.error(`[socket] ${event} 오류`, err);
          reply({ ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' });
        }
      }
    });
  };

  const classOf = (p: { classId?: unknown }) => {
    if (!isValidClassId(p.classId)) throw new AppError(400, 'INVALID_CLASS', '학급 ID가 올바르지 않습니다.');
    return p.classId;
  };

  handle(EVENTS.ADMIN_WATCH, (p) => {
    for (const r of socket.rooms) if (r.startsWith('admin:') && r !== rooms.admins) socket.leave(r);
    if (p.classId === null) return {};
    const classId = classOf(p);
    socket.join(rooms.adminClass(classId));
    return { state: ctx.sessions.getClassState(classId, 'admin') };
  });
  handle(EVENTS.ADMIN_START, (p) => ctx.sessions.startQuiz(classOf(p)));
  handle(EVENTS.ADMIN_PAUSE, (p) => ctx.sessions.pauseQuiz(classOf(p)));
  handle(EVENTS.ADMIN_RESUME, (p) => ctx.sessions.resumeQuiz(classOf(p)));
  handle(EVENTS.ADMIN_NEXT, (p) => ctx.sessions.nextQuestion(classOf(p)));
  handle(EVENTS.ADMIN_SHOW_RESULTS, (p) => ctx.sessions.showResults(classOf(p)));
  handle(EVENTS.ADMIN_FINISH, (p) => ctx.sessions.finishQuiz(classOf(p)));
  handle(EVENTS.ADMIN_RESET_CLASS, (p) => {
    if (p.confirm !== 'RESET') throw new AppError(400, 'CONFIRM_REQUIRED', '확인 문구가 필요합니다.');
    ctx.sessions.resetClass(classOf(p), { removeParticipants: !!p.removeParticipants });
  });
  handle(EVENTS.ADMIN_RESET_ALL, (p) => {
    if (p.confirm !== 'RESET_ALL') throw new AppError(400, 'CONFIRM_REQUIRED', '전체 초기화 확인 문구(RESET_ALL)가 필요합니다.');
    return { result: ctx.sessions.resetAll({ removeParticipants: !!p.removeParticipants }) };
  });
}
