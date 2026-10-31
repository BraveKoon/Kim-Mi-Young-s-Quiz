import type { LeaderboardEntry } from '@shared/types/index.js';
import type { Repositories } from '../database/repositories/index.js';

interface RankRow {
  id: number;
  nickname: string;
  class_id: string;
  total_score: number;
  correct_count: number;
  total_elapsed_ms: number;
  last_awarded: number | null;
  last_correct: number | null;
}

/** 동점자는 같은 순위(1, 1, 3 …). 표시 순서는 누적 응답 시간이 짧은 순. */
export function assignRanks<T extends { score: number; elapsed: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.elapsed - b.elapsed);
  let lastScore = Number.NaN;
  let lastRank = 0;
  return sorted.map((r, i) => {
    if (r.score !== lastScore) {
      lastRank = i + 1;
      lastScore = r.score;
    }
    return { ...r, rank: lastRank };
  });
}

export class LeaderboardService {
  constructor(private repos: Repositories) {}

  /**
   * 학급 세션 순위.
   * @param currentQuestionId 직전/현재 문제 — 이번 문제 획득 점수와 이전 순위 계산에 사용
   * @param hideCurrent true면 현재 문제 점수를 제외(문제 진행 중 정답 여부 노출 방지)
   */
  sessionRanking(sessionId: number, currentQuestionId: number | null, hideCurrent = false): LeaderboardEntry[] {
    const rows = this.repos.db
      .prepare(
        `SELECT p.id, p.nickname, p.class_id, p.total_score, p.correct_count, p.total_elapsed_ms,
                a.awarded_score AS last_awarded, a.is_correct AS last_correct, a.elapsed_ms AS last_elapsed
         FROM participants p LEFT JOIN answers a ON a.participant_id = p.id AND a.question_id = ?
         WHERE p.session_id = ?`,
      )
      .all(currentQuestionId ?? -1, sessionId) as (RankRow & { last_elapsed: number | null })[];
    return this.rank(rows, currentQuestionId !== null, hideCurrent);
  }

  private rank(rows: (RankRow & { last_elapsed?: number | null })[], hasCurrent: boolean, hideCurrent: boolean): LeaderboardEntry[] {
    const base = rows.map((r) => {
      const last = r.last_awarded ?? 0;
      const lastElapsed = r.last_elapsed ?? 0;
      const answeredCurrent = r.last_correct !== null && r.last_correct !== undefined;
      return {
        r,
        score: hideCurrent ? r.total_score - last : r.total_score,
        elapsed: hideCurrent ? r.total_elapsed_ms - lastElapsed : r.total_elapsed_ms,
        prevScore: r.total_score - last,
        prevElapsed: r.total_elapsed_ms - lastElapsed,
        correct: hideCurrent && r.last_correct ? r.correct_count - 1 : r.correct_count,
        answeredCurrent,
      };
    });
    const prevRanks = new Map<number, number>();
    if (hasCurrent && !hideCurrent) {
      for (const p of assignRanks(base.map((b) => ({ ...b, score: b.prevScore, elapsed: b.prevElapsed })))) prevRanks.set(p.r.id, p.rank);
    }
    return assignRanks(base).map((b) => ({
      rank: b.rank,
      prevRank: prevRanks.get(b.r.id) ?? null,
      participantId: b.r.id,
      nickname: b.r.nickname,
      classId: b.r.class_id,
      totalScore: b.score,
      correctCount: b.correct,
      lastAwarded: hideCurrent ? 0 : (b.r.last_awarded ?? 0),
      lastCorrect: hideCurrent || !hasCurrent ? null : b.answeredCurrent ? b.r.last_correct === 1 : false,
    }));
  }

  /** 대회 전체(전교) 개인 순위 */
  competitionRanking(competitionId: number): LeaderboardEntry[] {
    const rows = this.repos.db
      .prepare(
        `SELECT p.id, p.nickname, p.class_id, p.total_score, p.correct_count, p.total_elapsed_ms, NULL AS last_awarded, NULL AS last_correct
         FROM participants p JOIN class_sessions s ON s.id = p.session_id WHERE s.competition_id = ?`,
      )
      .all(competitionId) as RankRow[];
    return this.rank(rows, false, false);
  }

  /** 대회 학급별 순위(평균 점수 기준) + 공정성 정보 */
  classRanking(competitionId: number) {
    const sessions = this.repos.sessions.byCompetition(competitionId);
    const stats = this.repos.db
      .prepare(
        `SELECT s.id AS session_id, s.class_id, s.quiz_set_id, s.quiz_set_title, s.status, s.question_count,
                COUNT(p.id) AS participant_count, COALESCE(AVG(p.total_score), 0) AS avg_score,
                COALESCE(SUM(p.total_score), 0) AS sum_score, COALESCE(MAX(p.total_score), 0) AS max_score,
                COALESCE(SUM(p.correct_count), 0) AS correct_sum, COALESCE(SUM(p.answer_count), 0) AS answer_sum
         FROM class_sessions s LEFT JOIN participants p ON p.session_id = s.id
         WHERE s.competition_id = ? GROUP BY s.id ORDER BY s.class_id`,
      )
      .all(competitionId) as {
      session_id: number;
      class_id: string;
      quiz_set_id: number | null;
      quiz_set_title: string | null;
      status: string;
      question_count: number;
      participant_count: number;
      avg_score: number;
      sum_score: number;
      max_score: number;
      correct_sum: number;
      answer_sum: number;
    }[];
    const ranked = assignRanks(
      stats.map((s) => ({ ...s, score: Math.round(s.avg_score * 10) / 10, elapsed: 0 })),
    ).map((s) => ({
      rank: s.rank,
      sessionId: s.session_id,
      classId: s.class_id,
      quizSetId: s.quiz_set_id,
      quizSetTitle: s.quiz_set_title,
      status: s.status,
      questionCount: s.question_count,
      participantCount: s.participant_count,
      averageScore: Math.round(s.avg_score * 10) / 10,
      totalScore: s.sum_score,
      maxScore: s.max_score,
      accuracy: s.participant_count && s.question_count ? s.correct_sum / (s.participant_count * s.question_count) : 0,
    }));
    const fairness = this.fairness(competitionId);
    return { classes: ranked, sessionsCount: sessions.length, ...fairness };
  }

  /** 서로 다른 문제 세트를 사용한 학급이 섞여 있으면 전교 비교가 공정하지 않다. */
  fairness(competitionId: number) {
    const rows = this.repos.db
      .prepare(
        `SELECT s.id, s.quiz_set_id, s.quiz_set_title,
                (SELECT GROUP_CONCAT(question_id) FROM (SELECT question_id FROM session_questions WHERE session_id = s.id ORDER BY order_num)) AS qs
         FROM class_sessions s WHERE s.competition_id = ?`,
      )
      .all(competitionId) as { id: number; quiz_set_id: number | null; quiz_set_title: string | null; qs: string | null }[];
    // 시작된 세션은 실제 출제된 문제(스냅샷), 시작 전 세션은 현재 문제 세트 구성으로 비교한다.
    const keys = new Set(
      rows.map((r) => r.qs ?? (r.quiz_set_id ? this.repos.quizSets.questionIds(r.quiz_set_id).join(',') : `none:${r.id}`)),
    );
    const comparable = keys.size <= 1;
    return {
      comparable,
      quizSets: [...new Set(rows.map((r) => r.quiz_set_title ?? '(삭제된 세트)'))],
      fairnessWarning: comparable
        ? null
        : '이 대회에서는 학급마다 서로 다른 문제 세트가 사용되었습니다. 공통 평가 기준이 없으므로 전교 순위는 공정한 비교가 아닐 수 있습니다.',
    };
  }
}
