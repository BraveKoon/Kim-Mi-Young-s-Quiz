export interface ScoreInput {
  isCorrect: boolean;
  elapsedMs: number;
  timeLimitSec: number;
  isDoublePoints: boolean;
}

export const MAX_BASE_SCORE = 1000;

/**
 * 서버 기준 점수 계산.
 *   정답: round(1000 * (1 - elapsedSec / (timeLimit * 2)))  → 즉시 1000점, 제한시간 직전 약 500점
 *   2배 문제: × 2 (최대 2000점)
 *   오답/시간 초과: 0점
 */
export function calculateScore({ isCorrect, elapsedMs, timeLimitSec, isDoublePoints }: ScoreInput): number {
  if (!isCorrect) return 0;
  if (timeLimitSec <= 0) return 0;
  const elapsedSec = Math.max(0, elapsedMs) / 1000;
  if (elapsedSec > timeLimitSec) return 0;
  const base = Math.round(MAX_BASE_SCORE * (1 - elapsedSec / (timeLimitSec * 2)));
  return isDoublePoints ? base * 2 : base;
}
