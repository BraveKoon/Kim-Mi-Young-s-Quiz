import type { Request, Response } from 'express';
import type { AppContext } from '../context.js';

export function logController(ctx: AppContext) {
  return {
    /** 활동 로그 전체 초기화. 초기화 사실 자체는 새 로그 1건으로 남긴다(감사 목적). */
    reset(req: Request, res: Response) {
      const deleted = ctx.repos.logs.deleteAll();
      ctx.logger.log('LOGS_RESET', { severity: 'warning', details: { by: req.admin!.username, deleted } });
      res.json({ ok: true, deleted });
    },
    list(req: Request, res: Response) {
      const { rows, total } = ctx.repos.logs.query(req.valid!.query);
      res.json({
        total,
        logs: rows.map((r) => ({
          id: r.id,
          classId: r.class_id,
          participantId: r.participant_id,
          nickname: r.nickname,
          sessionId: r.session_id,
          eventType: r.event_type,
          severity: r.severity,
          details: r.details ? JSON.parse(r.details) : null,
          createdAt: r.created_at,
        })),
      });
    },
  };
}
