import type { Request, Response } from 'express';
import type { AppContext } from '../context.js';

export function logController(ctx: AppContext) {
  return {
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
