import type { Request, Response } from 'express';
import type { AppContext } from '../context.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { serializeQuestion } from './questionController.js';

export function quizSetController(ctx: AppContext) {
  const checkQuestions = (ids: number[]) => {
    if (new Set(ids).size !== ids.length) throw badRequest('같은 문제를 중복으로 넣을 수 없습니다.');
    for (const id of ids) if (!ctx.repos.questions.find(id)) throw badRequest(`문제 ${id}를 찾을 수 없습니다.`);
  };
  const serialize = (id: number) => {
    const s = ctx.repos.quizSets.find(id)!;
    const questions = ctx.repos.quizSets.questions(id).map(serializeQuestion);
    return { id: s.id, title: s.title, description: s.description, category: s.category, createdAt: s.created_at, updatedAt: s.updated_at, questionCount: questions.length, questions };
  };
  return {
    list(_req: Request, res: Response) {
      res.json({ quizSets: ctx.repos.quizSets.list().map((s) => serialize(s.id)) });
    },
    get(req: Request, res: Response) {
      const { id } = req.valid!.params;
      if (!ctx.repos.quizSets.find(id)) throw notFound('문제 세트를 찾을 수 없습니다.');
      res.json({ quizSet: serialize(id) });
    },
    create(req: Request, res: Response) {
      checkQuestions(req.valid!.body.questionIds);
      const id = ctx.repos.quizSets.create(req.valid!.body, ctx.clock());
      res.status(201).json({ quizSet: serialize(id) });
    },
    update(req: Request, res: Response) {
      const { id } = req.valid!.params;
      checkQuestions(req.valid!.body.questionIds);
      if (!ctx.repos.quizSets.update(id, req.valid!.body, ctx.clock())) throw notFound('문제 세트를 찾을 수 없습니다.');
      res.json({ quizSet: serialize(id) });
    },
    remove(req: Request, res: Response) {
      const { id } = req.valid!.params;
      const inUse = ctx.repos.sessions.allCurrent().some((s) => s.quiz_set_id === id && s.status !== 'FINISHED');
      if (inUse) throw conflict('현재 학급 세션에서 사용 중인 문제 세트는 삭제할 수 없습니다.', 'QUIZ_SET_IN_USE');
      if (!ctx.repos.quizSets.delete(id)) throw notFound('문제 세트를 찾을 수 없습니다.');
      res.json({ ok: true });
    },
  };
}
