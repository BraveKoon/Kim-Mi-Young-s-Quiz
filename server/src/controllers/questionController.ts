import type { Request, Response } from 'express';
import type { AppContext } from '../context.js';
import type { QuestionRow } from '../database/repositories/index.js';
import { notFound } from '../utils/errors.js';

/** 관리자용 문제 직렬화 (정답·해설 포함 — 관리자 API에서만 사용) */
export function serializeQuestion(q: QuestionRow) {
  return {
    id: q.id,
    questionType: q.question_type,
    questionText: q.question_text,
    options: JSON.parse(q.options) as string[],
    correctIndex: q.correct_index,
    timeLimit: q.time_limit,
    isDoublePoints: q.is_double_points === 1,
    orderNum: q.order_num,
    explanation: q.explanation,
    category: q.category,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  };
}

export function questionController(ctx: AppContext) {
  return {
    list(_req: Request, res: Response) {
      res.json({ questions: ctx.repos.questions.list().map(serializeQuestion) });
    },
    create(req: Request, res: Response) {
      const id = ctx.repos.questions.create(req.valid!.body, ctx.clock());
      res.status(201).json({ question: serializeQuestion(ctx.repos.questions.find(id)!) });
    },
    bulkCreate(req: Request, res: Response) {
      const { questions, replaceExisting, quizSetTitle, quizSetDescription, quizSetCategory } = req.valid!.body;
      const now = ctx.clock();
      const result = ctx.repos.tx(() => {
        if (replaceExisting) {
          for (const old of ctx.repos.questions.list()) {
            ctx.repos.questions.softDelete(old.id, now);
          }
        }
        const baseOrder = replaceExisting ? 0 : (ctx.repos.questions.list().at(-1)?.order_num ?? 0);
        const questionIds = questions.map((item: any, idx: number) =>
          ctx.repos.questions.create(
            {
              ...item,
              orderNum: item.orderNum > 0 ? item.orderNum : baseOrder + idx + 1,
            },
            now,
          ),
        );
        const quizSetId = quizSetTitle
          ? ctx.repos.quizSets.create(
              {
                title: quizSetTitle,
                description: quizSetDescription ?? null,
                category: quizSetCategory ?? null,
                questionIds,
              },
              now,
            )
          : null;
        return { count: questionIds.length, questionIds, quizSetId };
      });
      res.status(201).json(result);
    },
    update(req: Request, res: Response) {
      const { id } = req.valid!.params;
      if (!ctx.repos.questions.update(id, req.valid!.body, ctx.clock())) throw notFound('문제를 찾을 수 없습니다.');
      res.json({ question: serializeQuestion(ctx.repos.questions.find(id)!) });
    },
    remove(req: Request, res: Response) {
      const { id } = req.valid!.params;
      if (!ctx.repos.questions.softDelete(id, ctx.clock())) throw notFound('문제를 찾을 수 없습니다.');
      res.json({ ok: true });
    },
  };
}
