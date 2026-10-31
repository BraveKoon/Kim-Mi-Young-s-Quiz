import type { Request, Response } from 'express';
import type { NameDisplayMode } from '@shared/types/index.js';
import type { AppContext } from '../context.js';
import { displayName } from '../security/masking.js';
import { notFound } from '../utils/errors.js';

/** 프로젝터·결과 공개 화면 전용. 설정된 이름 공개 방식(FULL/MASKED/HIDDEN)을 서버에서 적용한다. */
export function publicController(ctx: AppContext) {
  const mode = () => (ctx.repos.settings.get('projector_name_mode') as NameDisplayMode) ?? 'MASKED';
  return {
    projectorState(req: Request, res: Response) {
      res.json({ state: ctx.sessions.getClassState(req.valid!.params.classId, 'projector') });
    },
    competitionResults(req: Request, res: Response) {
      const id = req.valid!.params.id;
      const c = ctx.repos.competitions.find(id);
      if (!c) throw notFound('대회를 찾을 수 없습니다.');
      const m = mode();
      const top = ctx.leaderboard
        .competitionRanking(id)
        .slice(0, 10)
        .map((r) => ({ rank: r.rank, classId: r.classId, nickname: displayName(r.nickname, m, r.rank), totalScore: r.totalScore }));
      const cr = ctx.leaderboard.classRanking(id);
      res.json({
        competition: { id: c.id, title: c.title, description: c.description, status: c.status, startedAt: c.started_at, finishedAt: c.finished_at },
        top,
        classRanking: cr.classes.map((k) => ({ rank: k.rank, classId: k.classId, averageScore: k.averageScore, participantCount: k.participantCount, status: k.status })),
        comparable: cr.comparable,
        fairnessWarning: cr.fairnessWarning,
      });
    },
    competitions(_req: Request, res: Response) {
      res.json({
        competitions: ctx.repos.competitions.list().map((c) => ({ id: c.id, title: c.title, status: c.status, startedAt: c.started_at, finishedAt: c.finished_at })),
      });
    },
  };
}
