import type { Request, Response } from 'express';
import type { AppContext } from '../context.js';
import { badRequest, forbidden } from '../utils/errors.js';

export function leaderboardController(ctx: AppContext) {
  return {
    /**
     * scope=class: classId 필요(관리자 또는 해당 학급 학생)
     * scope=school/classes: competitionId 필요(관리자 전용)
     */
    get(req: Request, res: Response) {
      const { classId, competitionId, scope } = req.valid!.query;
      if (scope === 'class') {
        if (!classId) throw badRequest('classId가 필요합니다.');
        if (!req.admin && req.participant?.class_id !== classId) throw forbidden('다른 학급의 순위는 조회할 수 없습니다.');
        const state = ctx.sessions.getClassState(classId, req.admin ? 'admin' : 'student', req.participant?.id);
        return res.json({ scope, classId, status: state.status, leaderboard: state.leaderboard, me: state.me ?? null });
      }
      if (!req.admin) throw forbidden('전체 순위는 관리자만 조회할 수 있습니다.');
      const compId = competitionId ?? (classId ? ctx.repos.sessions.currentForClass(classId)?.competition_id : undefined);
      if (!compId) throw badRequest('competitionId가 필요합니다.');
      if (scope === 'school') {
        return res.json({ scope, competitionId: compId, leaderboard: ctx.leaderboard.competitionRanking(compId), ...ctx.leaderboard.fairness(compId) });
      }
      return res.json({ scope, competitionId: compId, ...ctx.leaderboard.classRanking(compId) });
    },
    reset(req: Request, res: Response) {
      const { scope, classId, removeParticipants } = req.valid!.body;
      let result;
      if (scope === 'class') {
        if (!classId) throw badRequest('classId가 필요합니다.');
        ctx.sessions.resetClass(classId, { removeParticipants });
        result = [{ classId, ok: true }];
      } else {
        result = ctx.sessions.resetAll({ removeParticipants });
      }
      ctx.logger.log('LEADERBOARD_RESET', { classId: classId ?? null, severity: 'warning', details: { scope, by: req.admin!.username, removeParticipants } });
      res.json({ ok: true, result });
    },
  };
}
