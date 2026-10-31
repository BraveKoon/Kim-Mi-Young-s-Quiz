import type { Request, Response } from 'express';
import { EVENTS } from '@shared/types/index.js';
import type { AppContext } from '../context.js';
import { forbidden, notFound } from '../utils/errors.js';

export function classController(ctx: AppContext) {
  return {
    /** 공개: 로비용 학급 목록 (인원 수·상태만) */
    list(_req: Request, res: Response) {
      const { classes, totals } = ctx.sessions.getOverview();
      res.json({
        classes: classes.map((c) => ({
          classId: c.classId,
          className: c.className,
          capacity: c.capacity,
          status: c.status,
          participantCount: c.participantCount,
          connectedCount: c.connectedCount,
          joinable: c.joinable,
        })),
        totals: { capacity: totals.capacity, participants: totals.participants, connected: totals.connected },
      });
    },
    /** 공개: 학급 세션 요약 (문제/정답 미포함) */
    session(req: Request, res: Response) {
      const s = ctx.sessions.getClassState(req.valid!.params.classId, 'projector');
      res.json({
        session: {
          classId: s.classId,
          className: s.className,
          sessionId: s.sessionId,
          status: s.status,
          competitionTitle: s.competitionTitle,
          questionIndex: s.questionIndex,
          totalQuestions: s.totalQuestions,
          participantCount: s.participantCount,
          connectedCount: s.connectedCount,
          capacity: s.capacity,
        },
      });
    },
    createSession(req: Request, res: Response) {
      const { classId } = req.valid!.params;
      const { competitionId, quizSetId } = req.valid!.body;
      const sessionId = ctx.sessions.createSession(classId, competitionId, quizSetId);
      res.status(201).json({ sessionId, state: ctx.sessions.getClassState(classId, 'admin') });
    },
    join(req: Request, res: Response) {
      const { classId } = req.valid!.params;
      const result = ctx.participants.join(classId, req.valid!.body.nickname);
      ctx.sessions.publishParticipants(classId);
      res.status(201).json(result);
    },
    /** 관리자 또는 같은 학급 학생 */
    participants(req: Request, res: Response) {
      const { classId } = req.valid!.params;
      const session = ctx.repos.sessions.currentForClass(classId);
      const rows = session ? ctx.repos.participants.bySession(session.id) : [];
      const isAdmin = !!req.admin;
      res.json({
        participants: rows.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          connected: ctx.presence.isConnected(p.id),
          ...(isAdmin
            ? { totalScore: p.total_score, correctCount: p.correct_count, answerCount: p.answer_count, lastSeenAt: p.last_seen_at, createdAt: p.created_at }
            : {}),
        })),
      });
    },
    removeParticipant(req: Request, res: Response) {
      const { classId, participantId } = req.valid!.params;
      const p = ctx.repos.participants.find(participantId);
      if (!p || p.class_id !== classId) throw notFound('참가자를 찾을 수 없습니다.');
      ctx.sessions.broadcaster.toParticipant(p.id, EVENTS.RESET, { reason: 'REMOVED' });
      ctx.sessions.broadcaster.disconnectParticipant(p.id, 'REMOVED');
      ctx.presence.remove(p.id);
      ctx.participants.remove(p.id);
      ctx.sessions.publishParticipants(classId);
      res.json({ ok: true });
    },
    /** 학생 본인 상태 복구용 REST (소켓 연결 전 확인) */
    me(req: Request, res: Response) {
      const { classId } = req.valid!.params;
      const p = req.participant;
      if (!p) throw forbidden('참가자 인증이 필요합니다.', 'INVALID_PARTICIPANT');
      if (p.class_id !== classId) throw forbidden('다른 학급의 정보는 조회할 수 없습니다.');
      const session = ctx.repos.sessions.currentForClass(classId);
      if (!session || session.id !== p.session_id) throw forbidden('세션이 변경되었습니다. 다시 입장하세요.', 'SESSION_CHANGED');
      res.json({ participant: { id: p.id, nickname: p.nickname, classId: p.class_id, sessionId: p.session_id } });
    },
  };
}
