import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { adminController } from '../controllers/adminController.js';
import { analyticsController } from '../controllers/analyticsController.js';
import { classController } from '../controllers/classController.js';
import { competitionController } from '../controllers/competitionController.js';
import { exportController } from '../controllers/exportController.js';
import { leaderboardController } from '../controllers/leaderboardController.js';
import { logController } from '../controllers/logController.js';
import { publicController } from '../controllers/publicController.js';
import { questionController } from '../controllers/questionController.js';
import { quizSetController } from '../controllers/quizSetController.js';
import * as S from '../controllers/schemas.js';
import { optionalParticipant, requireAdmin, requireAdminOrClassMember } from '../middleware/auth.js';
import { createLimiters } from '../middleware/rateLimit.js';
import { idParam, validate } from '../middleware/validation.js';

export function createApiRouter(ctx: AppContext) {
  const r = Router();
  const limit = createLimiters(ctx);
  const admin = requireAdmin(ctx);
  const adminPending = requireAdmin(ctx, { allowPendingPasswordChange: true });
  const classParam = z.object({ classId: S.classIdSchema });

  r.use(limit.api);
  r.use(optionalParticipant(ctx));

  r.get('/health', (_req, res) => res.json({ ok: true, time: ctx.clock() }));

  // ── 관리자 인증
  const a = adminController(ctx);
  r.post('/admin/login', limit.login, validate({ body: S.loginSchema }), a.login);
  r.post('/admin/logout', adminPending, a.logout);
  r.get('/admin/me', adminPending, a.me);
  r.post('/admin/change-password', limit.login, adminPending, validate({ body: S.changePasswordSchema }), a.changePassword);
  r.get('/admin/overview', admin, a.overview);
  r.get('/settings', admin, a.getSettings);
  r.put('/settings', admin, validate({ body: S.settingsSchema }), a.updateSettings);

  // ── 문제
  const q = questionController(ctx);
  r.get('/questions', admin, q.list);
  r.post('/questions', admin, validate({ body: S.questionSchema }), q.create);
  r.put('/questions/:id', admin, validate({ params: idParam, body: S.questionSchema }), q.update);
  r.delete('/questions/:id', admin, validate({ params: idParam }), q.remove);

  // ── 문제 세트
  const qs = quizSetController(ctx);
  r.get('/quiz-sets', admin, qs.list);
  r.get('/quiz-sets/:id', admin, validate({ params: idParam }), qs.get);
  r.post('/quiz-sets', admin, validate({ body: S.quizSetSchema }), qs.create);
  r.put('/quiz-sets/:id', admin, validate({ params: idParam, body: S.quizSetSchema }), qs.update);
  r.delete('/quiz-sets/:id', admin, validate({ params: idParam }), qs.remove);

  // ── 학급 / 참가자 / 세션
  const c = classController(ctx);
  r.get('/classes', c.list);
  r.get('/classes/:classId/session', validate({ params: classParam }), c.session);
  r.post('/classes/:classId/session', admin, validate({ params: classParam, body: S.createSessionSchema }), c.createSession);
  r.post('/classes/:classId/join', limit.join, validate({ params: classParam, body: S.joinSchema }), c.join);
  r.get('/classes/:classId/me', validate({ params: classParam }), c.me);
  r.get('/classes/:classId/participants', validate({ params: classParam }), requireAdminOrClassMember(ctx), c.participants);
  r.delete(
    '/classes/:classId/participants/:participantId',
    admin,
    validate({ params: z.object({ classId: S.classIdSchema, participantId: z.coerce.number().int().positive() }) }),
    c.removeParticipant,
  );

  // ── 순위
  const lb = leaderboardController(ctx);
  const maybeAdmin = (req: any, _res: any, next: any) => (req.headers.authorization ? admin(req, _res, next) : next());
  r.get('/leaderboard', maybeAdmin, validate({ query: S.leaderboardQuery }), lb.get);
  r.post('/leaderboard/reset', admin, validate({ body: S.resetSchema }), lb.reset);

  // ── 통계
  const an = analyticsController(ctx);
  r.get('/analytics/competition/:id', admin, validate({ params: idParam }), an.competition);
  r.get('/analytics/questions/:id', admin, validate({ params: idParam }), an.questions);
  r.get('/analytics/class/:classId', admin, validate({ params: classParam }), an.classStats);

  // ── 대회 이력
  const comp = competitionController(ctx);
  r.get('/competitions', admin, comp.list);
  r.get('/competitions/compare', admin, comp.compare);
  r.post('/competitions', admin, validate({ body: S.competitionSchema }), comp.create);
  r.get('/competitions/:id', admin, validate({ params: idParam }), comp.get);
  r.put('/competitions/:id', admin, validate({ params: idParam, body: S.competitionUpdateSchema }), comp.update);
  r.post('/competitions/:id/finish', admin, validate({ params: idParam }), comp.finish);
  r.delete('/competitions/:id', admin, validate({ params: idParam }), comp.remove);

  // ── 내보내기
  const ex = exportController(ctx);
  r.get('/exports', admin, ex.list);
  r.get('/exports/files/:id', admin, validate({ params: idParam }), ex.download);
  r.get('/exports/:id/csv', admin, validate({ params: idParam }), ex.csv);
  r.get('/exports/:id/excel', admin, validate({ params: idParam }), ex.excel);
  r.post('/exports/:id', admin, validate({ params: idParam }), ex.create);

  // ── 활동 로그
  const lg = logController(ctx);
  r.get('/logs', admin, validate({ query: S.logQuery }), lg.list);
  r.get('/logs/csv', admin, validate({ query: S.logQuery }), ex.logsCsv);

  // ── 공개(프로젝터/결과 발표) — 민감 정보 없음
  const pub = publicController(ctx);
  r.get('/public/projector/:classId', validate({ params: classParam }), pub.projectorState);
  r.get('/public/competitions', pub.competitions);
  r.get('/public/competitions/:id/results', validate({ params: idParam }), pub.competitionResults);

  return r;
}
