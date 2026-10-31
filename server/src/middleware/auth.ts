import type { NextFunction, Request, Response } from 'express';
import type { AppContext } from '../context.js';
import type { AdminRow } from '../database/repositories/index.js';
import type { ParticipantRow } from '../database/repositories/index.js';
import type { AdminTokenPayload } from '../services/authService.js';
import { forbidden } from '../utils/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminRow;
      adminToken?: AdminTokenPayload;
      participant?: ParticipantRow;
      valid?: { body?: any; query?: any; params?: any };
    }
  }
}

export function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

/**
 * 관리자 인증. 모든 관리자 API 요청마다 JWT 서명·만료·폐기 여부를 확인한다.
 * 기본 비밀번호 상태(must_change_password)면 비밀번호 변경 외의 기능을 막는다.
 */
export function requireAdmin(ctx: AppContext, opts: { allowPendingPasswordChange?: boolean } = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { admin, payload } = ctx.auth.verify(bearer(req));
    if (admin.must_change_password && !opts.allowPendingPasswordChange) {
      throw forbidden('초기 비밀번호를 먼저 변경해야 합니다.', 'PASSWORD_CHANGE_REQUIRED');
    }
    req.admin = admin;
    req.adminToken = payload;
    next();
  };
}

/** 학생 인증 헤더(X-Participant-Id, X-Participant-Token)가 있으면 검증해 req.participant 에 넣는다. */
export function optionalParticipant(ctx: AppContext) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const id = req.headers['x-participant-id'];
    const token = req.headers['x-participant-token'];
    if (id && token) {
      const p = ctx.participants.authenticate(Number(id), String(token));
      if (p) req.participant = p;
    }
    next();
  };
}

/** 관리자 또는 해당 학급 학생만 허용 */
export function requireAdminOrClassMember(ctx: AppContext) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (token) {
      const { admin } = ctx.auth.verify(token);
      if (admin.must_change_password) throw forbidden('초기 비밀번호를 먼저 변경해야 합니다.', 'PASSWORD_CHANGE_REQUIRED');
      req.admin = admin;
      return next();
    }
    const classId = String(req.params.classId ?? req.query.classId ?? '');
    if (req.participant && req.participant.class_id === classId) return next();
    if (req.participant) {
      ctx.logger.log('INVALID_ROOM_ACCESS', {
        classId: req.participant.class_id,
        participantId: req.participant.id,
        severity: 'warning',
        details: { via: 'rest', requestedClassId: classId, path: req.path },
      });
    }
    throw forbidden('다른 학급의 정보는 조회할 수 없습니다.');
  };
}
