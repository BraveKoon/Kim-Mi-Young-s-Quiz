import type { Server } from 'socket.io';
import { EVENTS, isValidClassId } from '@shared/types/index.js';
import type { AppContext } from '../context.js';
import { AppError } from '../utils/errors.js';
import type { AppSocket } from './index.js';
import { rooms } from './roomManager.js';

type Ack = (r: unknown) => void;

/** 학급 진행 명령 핸들러 등록. verify 가 예외를 던지면 명령을 실행하지 않고 연결을 끊는다. */
function bindCommands(
  socket: AppSocket,
  ctx: AppContext,
  verify: () => void,
  opts: { scopeClassId?: string; includeAdminOnly: boolean },
) {
  const handle = (event: string, fn: (payload: any) => unknown) => {
    socket.on(event, (payload: any, ack?: Ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        verify();
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
    // 프로젝터 컨트롤 키는 발급된 학급만 제어할 수 있다.
    if (opts.scopeClassId && p.classId !== opts.scopeClassId) {
      ctx.logger.log('UNAUTHORIZED_ADMIN_EVENT', { classId: opts.scopeClassId, severity: 'critical', details: { reason: 'CROSS_CLASS_CONTROL', requestedClassId: p.classId } });
      throw new AppError(403, 'FORBIDDEN', '다른 학급은 제어할 수 없습니다.');
    }
    return p.classId;
  };

  handle(EVENTS.ADMIN_START, (p) => ctx.sessions.startQuiz(classOf(p)));
  handle(EVENTS.ADMIN_PAUSE, (p) => ctx.sessions.pauseQuiz(classOf(p)));
  handle(EVENTS.ADMIN_RESUME, (p) => ctx.sessions.resumeQuiz(classOf(p)));
  handle(EVENTS.ADMIN_NEXT, (p) => ctx.sessions.nextQuestion(classOf(p)));
  handle(EVENTS.ADMIN_SKIP, (p) => ctx.sessions.skipQuestion(classOf(p)));
  handle(EVENTS.ADMIN_SHOW_RESULTS, (p) => ctx.sessions.showResults(classOf(p)));
  handle(EVENTS.ADMIN_FINISH, (p) => ctx.sessions.finishQuiz(classOf(p)));
  handle(EVENTS.ADMIN_RESET_CLASS, (p) => {
    if (p.confirm !== 'RESET') throw new AppError(400, 'CONFIRM_REQUIRED', '확인 문구가 필요합니다.');
    // 프로젝터 컨트롤로는 참가자 삭제까지 하는 초기화를 허용하지 않는다(점수·진행 상태 초기화만).
    ctx.sessions.resetClass(classOf(p), { removeParticipants: opts.includeAdminOnly ? !!p.removeParticipants : false });
  });

  if (opts.includeAdminOnly) {
    handle(EVENTS.ADMIN_WATCH, (p) => {
      for (const r of socket.rooms) if (r.startsWith('admin:') && r !== rooms.admins) socket.leave(r);
      if (p.classId === null) return {};
      const classId = classOf(p);
      socket.join(rooms.adminClass(classId));
      return { state: ctx.sessions.getClassState(classId, 'admin'), participants: ctx.sessions.participantsPayload(classId, 'admin') };
    });
    handle(EVENTS.ADMIN_RESET_ALL, (p) => {
      if (p.confirm !== 'RESET_ALL') throw new AppError(400, 'CONFIRM_REQUIRED', '전체 초기화 확인 문구(RESET_ALL)가 필요합니다.');
      return { result: ctx.sessions.resetAll({ removeParticipants: !!p.removeParticipants }) };
    });
  }
}

/** 프로젝터 컨트롤 키 소켓이 사용할 수 있는 관리자 이벤트 (단일 학급 한정, 전체 초기화·관전 제외) */
export const PROJECTOR_CONTROL_EVENTS: ReadonlySet<string> = new Set([
  EVENTS.ADMIN_START,
  EVENTS.ADMIN_PAUSE,
  EVENTS.ADMIN_RESUME,
  EVENTS.ADMIN_NEXT,
  EVENTS.ADMIN_SKIP,
  EVENTS.ADMIN_SHOW_RESULTS,
  EVENTS.ADMIN_FINISH,
  EVENTS.ADMIN_RESET_CLASS,
]);

export function registerAdminHandlers(_io: Server, socket: AppSocket, ctx: AppContext) {
  const data = socket.data;
  if (data.role !== 'admin') return;
  socket.join(rooms.admins);
  socket.emit(EVENTS.ADMIN_OVERVIEW, ctx.sessions.getOverview());

  /** 매 이벤트마다 토큰 재검증(만료·로그아웃·비밀번호 변경 반영) 후 실행 */
  bindCommands(
    socket,
    ctx,
    () => {
      const { admin } = ctx.auth.verify(data.token);
      if (admin.must_change_password) throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', '초기 비밀번호를 먼저 변경해야 합니다.');
    },
    { includeAdminOnly: true },
  );
}

/** 프로젝터 컨트롤 키로 연결된 소켓: 매 이벤트마다 키(만료·계정 상태)를 재검증하고 해당 학급만 제어한다. */
export function registerProjectorControlHandlers(socket: AppSocket, ctx: AppContext) {
  const data = socket.data;
  if (data.role !== 'projector' || !data.controlKey) return;
  const { classId, controlKey } = data;
  bindCommands(
    socket,
    ctx,
    () => {
      if (ctx.auth.verifyProjectorKey(controlKey, classId) === null) {
        throw new AppError(401, 'CONTROL_KEY_EXPIRED', '진행 컨트롤 권한이 만료되었습니다. 대시보드에서 프로젝터를 다시 여세요.');
      }
    },
    { scopeClassId: classId, includeAdminOnly: false },
  );
}
