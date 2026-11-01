import { describe, expect, it } from 'vitest';
import { calculateScore } from '../src/quiz/scoring.js';
import { assignRanks } from '../src/services/leaderboardService.js';
import { maskName } from '../src/security/masking.js';
import { csvCell } from '../src/services/exportService.js';

describe('점수 계산', () => {
  it('즉시 정답이면 1000점', () => {
    expect(calculateScore({ isCorrect: true, elapsedMs: 0, timeLimitSec: 20, isDoublePoints: false })).toBe(1000);
  });
  it('제한시간 직전 정답은 약 500점', () => {
    expect(calculateScore({ isCorrect: true, elapsedMs: 19_999, timeLimitSec: 20, isDoublePoints: false })).toBe(500);
  });
  it('공식: round(1000 * (1 - elapsed/(limit*2)))', () => {
    expect(calculateScore({ isCorrect: true, elapsedMs: 5000, timeLimitSec: 20, isDoublePoints: false })).toBe(875);
  });
  it('2배 문제는 ×2 (최대 2000점)', () => {
    expect(calculateScore({ isCorrect: true, elapsedMs: 0, timeLimitSec: 20, isDoublePoints: true })).toBe(2000);
    expect(calculateScore({ isCorrect: true, elapsedMs: 5000, timeLimitSec: 20, isDoublePoints: true })).toBe(1750);
  });
  it('오답·시간 초과는 0점', () => {
    expect(calculateScore({ isCorrect: false, elapsedMs: 0, timeLimitSec: 20, isDoublePoints: true })).toBe(0);
    expect(calculateScore({ isCorrect: true, elapsedMs: 20_001, timeLimitSec: 20, isDoublePoints: false })).toBe(0);
  });
});

describe('순위/마스킹/CSV', () => {
  it('동점자는 같은 순위', () => {
    const r = assignRanks([
      { id: 1, score: 100, elapsed: 5 },
      { id: 2, score: 300, elapsed: 5 },
      { id: 3, score: 100, elapsed: 3 },
      { id: 4, score: 50, elapsed: 1 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([[2, 1], [3, 2], [1, 2], [4, 4]]);
  });
  it('닉네임 마스킹 (일반 이름 및 학번+이름)', () => {
    expect(maskName('김민수')).toBe('김*수');
    expect(maskName('민수')).toBe('민*');
    expect(maskName('남궁민수')).toBe('남**수');
    expect(maskName('20101 홍길동')).toBe('20101 홍*동');
    expect(maskName('21235 민수')).toBe('21235 민*');
    expect(maskName('21235 남궁민수')).toBe('21235 남**수');
  });
  it('CSV 수식 주입 방지', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell('a,b')).toBe('"a,b"');
  });
});
