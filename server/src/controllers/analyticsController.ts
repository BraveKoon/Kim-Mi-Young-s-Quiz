import type { Request, Response } from 'express';
import type { AppContext } from '../context.js';

export function analyticsController(ctx: AppContext) {
  return {
    competition(req: Request, res: Response) {
      res.json(ctx.analytics.competition(req.valid!.params.id));
    },
    questions(req: Request, res: Response) {
      const a = ctx.analytics.competition(req.valid!.params.id);
      res.json({ questions: a.questions, hardest: a.hardest, easiest: a.easiest });
    },
    classStats(req: Request, res: Response) {
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : undefined;
      res.json(ctx.analytics.classStats(req.valid!.params.classId, sessionId));
    },
  };
}
