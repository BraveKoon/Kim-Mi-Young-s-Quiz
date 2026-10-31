import type { QuestionType } from '@shared/types/index.js';
import type { Repositories, SessionQuestionRow } from '../database/repositories/index.js';
import { notFound } from '../utils/errors.js';
import type { LeaderboardService } from '../services/leaderboardService.js';

export interface QuestionStat {
  questionId: number;
  order: number;
  questionType: QuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  acceptedAnswers?: string[];
  isDoublePoints: boolean;
  timeLimit: number;
  category: string | null;
  participantCount: number; // 해당 문제를 출제받은 세션의 전체 참가자
  answeredCount: number;
  noAnswerCount: number;
  correctCount: number;
  /** 응답자 기준 정답률 */
  correctRateAnswered: number;
  /** 전체 참가자 기준 정답률 (미응답 = 오답 처리) */
  correctRateAll: number;
  distribution: number[];
  averageElapsedMs: number | null;
  averageScore: number; // 응답자 기준
  byClass: { classId: string; participantCount: number; answeredCount: number; correctCount: number; correctRateAll: number }[];
}

export class AnalyticsService {
  constructor(private repos: Repositories, private leaderboard: LeaderboardService) {}

  /** 특정 세션 집합의 문항별 통계. 같은 문제(question_id)는 학급을 합산한다. */
  questionStats(sessionIds: number[]): QuestionStat[] {
    if (!sessionIds.length) return [];
    const ph = sessionIds.map(() => '?').join(',');
    const sqs = this.repos.db
      .prepare(`SELECT sq.*, s.class_id FROM session_questions sq JOIN class_sessions s ON s.id = sq.session_id WHERE sq.session_id IN (${ph}) ORDER BY sq.order_num`)
      .all(...sessionIds) as (SessionQuestionRow & { class_id: string })[];
    const partCounts = new Map(
      (this.repos.db
        .prepare(`SELECT session_id, COUNT(*) c FROM participants WHERE session_id IN (${ph}) GROUP BY session_id`)
        .all(...sessionIds) as { session_id: number; c: number }[]).map((r) => [r.session_id, r.c]),
    );
    const answerAgg = this.repos.db
      .prepare(
        `SELECT session_id, question_id, selected_index, COUNT(*) AS n, SUM(is_correct) AS correct,
                SUM(elapsed_ms) AS elapsed, SUM(awarded_score) AS score
         FROM answers WHERE session_id IN (${ph}) GROUP BY session_id, question_id, selected_index`,
      )
      .all(...sessionIds) as { session_id: number; question_id: number; selected_index: number; n: number; correct: number; elapsed: number; score: number }[];

    const stats = new Map<number, QuestionStat & { _elapsed: number; _score: number }>();
    for (const sq of sqs) {
      let st = stats.get(sq.question_id);
      const rawOptions = JSON.parse(sq.options) as string[];
      const isShort = sq.question_type === 'SHORT_ANSWER';
      const options = isShort ? ['정답', '오답'] : rawOptions;
      if (!st) {
        st = {
          questionId: sq.question_id,
          order: sq.order_num,
          questionType: sq.question_type,
          text: sq.question_text,
          options,
          correctIndex: isShort ? 0 : sq.correct_index,
          ...(isShort ? { acceptedAnswers: rawOptions } : {}),
          isDoublePoints: sq.is_double_points === 1,
          timeLimit: sq.time_limit,
          category: sq.category,
          participantCount: 0,
          answeredCount: 0,
          noAnswerCount: 0,
          correctCount: 0,
          correctRateAnswered: 0,
          correctRateAll: 0,
          distribution: options.map(() => 0),
          averageElapsedMs: null,
          averageScore: 0,
          byClass: [],
          _elapsed: 0,
          _score: 0,
        };
        stats.set(sq.question_id, st);
      }
      const pc = partCounts.get(sq.session_id) ?? 0;
      st.participantCount += pc;
      const rows = answerAgg.filter((a) => a.session_id === sq.session_id && a.question_id === sq.question_id);
      let clsAnswered = 0;
      let clsCorrect = 0;
      for (const r of rows) {
        if (isShort) {
          st.distribution[0] += r.correct;
          st.distribution[1] += r.n - r.correct;
        } else if (r.selected_index >= 0 && r.selected_index < st.distribution.length) {
          st.distribution[r.selected_index] += r.n;
        }
        clsAnswered += r.n;
        clsCorrect += r.correct;
        st._elapsed += r.elapsed;
        st._score += r.score;
      }
      st.answeredCount += clsAnswered;
      st.correctCount += clsCorrect;
      st.byClass.push({ classId: sq.class_id, participantCount: pc, answeredCount: clsAnswered, correctCount: clsCorrect, correctRateAll: pc ? clsCorrect / pc : 0 });
    }
    return [...stats.values()]
      .map(({ _elapsed, _score, ...st }) => ({
        ...st,
        noAnswerCount: Math.max(0, st.participantCount - st.answeredCount),
        correctRateAnswered: st.answeredCount ? st.correctCount / st.answeredCount : 0,
        correctRateAll: st.participantCount ? st.correctCount / st.participantCount : 0,
        averageElapsedMs: st.answeredCount ? Math.round(_elapsed / st.answeredCount) : null,
        averageScore: st.answeredCount ? Math.round(_score / st.answeredCount) : 0,
      }))
      .sort((a, b) => a.order - b.order);
  }

  private summarize(questions: QuestionStat[]) {
    const asked = questions.filter((q) => q.participantCount > 0);
    const byRate = [...asked].sort((a, b) => a.correctRateAll - b.correctRateAll);
    return {
      hardest: byRate[0] ? { questionId: byRate[0].questionId, text: byRate[0].text, correctRateAll: byRate[0].correctRateAll } : null,
      easiest: byRate.at(-1) ? { questionId: byRate.at(-1)!.questionId, text: byRate.at(-1)!.text, correctRateAll: byRate.at(-1)!.correctRateAll } : null,
    };
  }

  competition(competitionId: number) {
    const comp = this.repos.competitions.find(competitionId);
    if (!comp) throw notFound('대회를 찾을 수 없습니다.');
    const sessions = this.repos.sessions.byCompetition(competitionId);
    const questions = this.questionStats(sessions.map((s) => s.id));
    const classRanking = this.leaderboard.classRanking(competitionId);
    const individuals = this.leaderboard.competitionRanking(competitionId);
    const totalParticipants = individuals.length;
    return {
      competition: comp,
      totals: {
        classes: sessions.length,
        participants: totalParticipants,
        averageScore: totalParticipants ? Math.round(individuals.reduce((s, r) => s + r.totalScore, 0) / totalParticipants) : 0,
        capacity: sessions.length * 35,
        participationRate: sessions.length ? totalParticipants / (sessions.length * 35) : 0,
      },
      classRanking,
      questions,
      ...this.summarize(questions),
    };
  }

  classStats(classId: string, sessionId?: number) {
    const session = sessionId ? this.repos.sessions.find(sessionId) : this.repos.sessions.currentForClass(classId);
    if (!session || session.class_id !== classId) throw notFound('세션을 찾을 수 없습니다.');
    const questions = this.questionStats([session.id]);
    const ranking = this.leaderboard.sessionRanking(session.id, null);
    return {
      classId,
      sessionId: session.id,
      status: session.status,
      competitionId: session.competition_id,
      participantCount: ranking.length,
      averageScore: ranking.length ? Math.round(ranking.reduce((s, r) => s + r.totalScore, 0) / ranking.length) : 0,
      accuracy:
        ranking.length && session.question_count ? ranking.reduce((s, r) => s + r.correctCount, 0) / (ranking.length * session.question_count) : 0,
      ranking,
      questions,
      ...this.summarize(questions),
    };
  }

  /** 대회 간 비교: 평균 점수, 참가율, 학급별 변화, 개인별(학급+닉네임 일치) 변화 */
  compare(competitionIds: number[]) {
    const comps = competitionIds.map((id) => {
      const c = this.repos.competitions.find(id);
      if (!c) throw notFound(`대회 ${id}를 찾을 수 없습니다.`);
      return c;
    });
    const summaries = comps.map((c) => {
      const cr = this.leaderboard.classRanking(c.id);
      const ind = this.leaderboard.competitionRanking(c.id);
      return {
        id: c.id,
        title: c.title,
        startedAt: c.started_at,
        averageScore: ind.length ? Math.round(ind.reduce((s, r) => s + r.totalScore, 0) / ind.length) : 0,
        participants: ind.length,
        participationRate: cr.classes.length ? ind.length / (cr.classes.length * 35) : 0,
        classes: Object.fromEntries(cr.classes.map((k) => [k.classId, { averageScore: k.averageScore, participants: k.participantCount, accuracy: k.accuracy }])),
        individuals: ind,
      };
    });
    const people = new Map<string, { classId: string; nickname: string; scores: (number | null)[]; ranks: (number | null)[] }>();
    summaries.forEach((s, i) => {
      for (const r of s.individuals) {
        const key = `${r.classId}|${r.nickname}`;
        if (!people.has(key)) people.set(key, { classId: r.classId, nickname: r.nickname, scores: summaries.map(() => null), ranks: summaries.map(() => null) });
        people.get(key)!.scores[i] = r.totalScore;
        people.get(key)!.ranks[i] = r.rank;
      }
    });
    return {
      competitions: summaries.map(({ individuals, ...rest }) => rest),
      individuals: [...people.values()].filter((p) => p.scores.filter((x) => x !== null).length > 1),
      note: '개인별 변화는 같은 학급·같은 닉네임으로 참가한 경우에만 연결됩니다.',
    };
  }
}
