import type { Request, Response } from 'express';
import { classDisplayName } from '@shared/types/index.js';
import type { AppContext } from '../context.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';

export function competitionController(ctx: AppContext) {
  const serialize = (id: number) => {
    const c = ctx.repos.competitions.find(id)!;
    const sessions = ctx.repos.sessions.byCompetition(id);
    const currentIds = new Set(ctx.repos.classes.all().map((k) => k.current_session_id));
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      createdAt: c.created_at,
      startedAt: c.started_at,
      finishedAt: c.finished_at,
      sessions: sessions.map((s) => ({
        id: s.id,
        classId: s.class_id,
        className: classDisplayName(s.class_id),
        quizSetId: s.quiz_set_id,
        quizSetTitle: s.quiz_set_title,
        status: s.status,
        questionCount: s.question_count,
        participantCount: ctx.repos.participants.countBySession(s.id),
        isCurrent: currentIds.has(s.id),
        startedAt: s.started_at,
        finishedAt: s.finished_at,
      })),
      ...ctx.leaderboard.fairness(id),
    };
  };
  return {
    list(_req: Request, res: Response) {
      res.json({ competitions: ctx.repos.competitions.list().map((c) => serialize(c.id)) });
    },
    get(req: Request, res: Response) {
      const { id } = req.valid!.params;
      if (!ctx.repos.competitions.find(id)) throw notFound('대회를 찾을 수 없습니다.');
      res.json({
        competition: serialize(id),
        individualRanking: ctx.leaderboard.competitionRanking(id),
        classRanking: ctx.leaderboard.classRanking(id),
      });
    },
    /** 대회 생성 + (선택) 지정 학급에 세션 생성 */
    create(req: Request, res: Response) {
      const { title, description, quizSetId, classIds } = req.valid!.body;
      if (classIds.length && !quizSetId) throw badRequest('학급을 지정하려면 문제 세트를 선택해야 합니다.');
      if (quizSetId && !ctx.repos.quizSets.find(quizSetId)) throw notFound('문제 세트를 찾을 수 없습니다.');
      const id = ctx.repos.competitions.create(title, description, ctx.clock());
      const errors: { classId: string; message: string }[] = [];
      for (const classId of classIds) {
        try {
          ctx.sessions.createSession(classId, id, quizSetId!);
        } catch (err) {
          errors.push({ classId, message: (err as Error).message });
        }
      }
      res.status(201).json({ competition: serialize(id), errors });
    },
    update(req: Request, res: Response) {
      const { id } = req.valid!.params;
      if (!ctx.repos.competitions.update(id, req.valid!.body.title, req.valid!.body.description)) throw notFound('대회를 찾을 수 없습니다.');
      res.json({ competition: serialize(id) });
    },
    finish(req: Request, res: Response) {
      const { id } = req.valid!.params;
      if (!ctx.repos.competitions.find(id)) throw notFound('대회를 찾을 수 없습니다.');
      for (const s of ctx.repos.sessions.byCompetition(id)) {
        const current = ctx.repos.sessions.currentForClass(s.class_id);
        if (current?.id === s.id && current.status !== 'FINISHED') ctx.sessions.finishQuiz(s.class_id);
        else if (s.status !== 'FINISHED') ctx.repos.sessions.update(s.id, { status: 'FINISHED', finished_at: ctx.clock() }, ctx.clock());
      }
      ctx.repos.competitions.markFinished(id, ctx.clock());
      res.json({ competition: serialize(id) });
    },
    remove(req: Request, res: Response) {
      const { id } = req.valid!.params;
      const c = ctx.repos.competitions.find(id);
      if (!c) throw notFound('대회를 찾을 수 없습니다.');
      if (req.query.confirm !== c.title) throw badRequest('삭제하려면 confirm 파라미터에 대회명을 정확히 입력해야 합니다.', 'CONFIRM_REQUIRED');
      const sessions = ctx.repos.sessions.byCompetition(id);
      const current = ctx.repos.sessions.allCurrent();
      if (sessions.some((s) => current.some((k) => k.id === s.id && ['PLAYING', 'PAUSED', 'RESULT'].includes(k.status)))) {
        throw conflict('진행 중인 학급이 있는 대회는 삭제할 수 없습니다.', 'SESSION_ACTIVE');
      }
      ctx.repos.competitions.delete(id);
      ctx.logger.log('COMPETITION_DELETED', { severity: 'warning', details: { competitionId: id, title: c.title, by: req.admin!.username } });
      ctx.sessions.notifyOverview();
      res.json({ ok: true });
    },
    compare(req: Request, res: Response) {
      const ids = String(req.query.ids ?? '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
      if (ids.length < 2 || ids.length > 6) throw badRequest('비교할 대회 2~6개를 ids=1,2 형식으로 지정하세요.');
      res.json(ctx.analytics.compare(ids));
    },
  };
}
