import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '@shared/types/index';
import { Leaderboard } from '../src/components/leaderboard/Leaderboard';
import { Podium } from '../src/components/leaderboard/Podium';

const SAMPLE_ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1,
    prevRank: 3,
    participantId: 101,
    nickname: '김민수',
    classId: '2-1',
    totalScore: 2850,
    correctCount: 3,
    lastAwarded: 950,
    lastCorrect: true,
  },
  {
    rank: 2,
    prevRank: 1,
    participantId: 102,
    nickname: '박서연',
    classId: '2-3',
    totalScore: 2100,
    correctCount: 2,
    lastAwarded: 0,
    lastCorrect: false,
  },
  {
    rank: 3,
    prevRank: 3,
    participantId: 103,
    nickname: '이지훈',
    classId: '2-12',
    totalScore: 1500,
    correctCount: 2,
    lastAwarded: 700,
    lastCorrect: true,
  },
  {
    rank: 4,
    prevRank: null,
    participantId: 104,
    nickname: '최유진',
    classId: '2-2',
    totalScore: 800,
    correctCount: 1,
    lastAwarded: 800,
    lastCorrect: true,
  },
];

describe('Leaderboard', () => {
  it('참가자가 없을 때 빈 상태 문구를 표시한다', () => {
    render(<Leaderboard entries={[]} />);
    expect(screen.getByText('아직 순위가 없습니다.')).toBeInTheDocument();
  });

  it('천 단위 구분 점수, 이번 문제 획득 점수(+점수), 순위 변동, 학급명, 내 항목 강조를 렌더링한다', () => {
    render(<Leaderboard entries={SAMPLE_ENTRIES} highlightId={102} showClass />);

    expect(screen.getByText('김민수')).toBeInTheDocument();
    expect(screen.getByText('2,850')).toBeInTheDocument();
    expect(screen.getByText('+950')).toBeInTheDocument();
    expect(screen.getByText('2학년 1반')).toBeInTheDocument();
    expect(screen.getByText('2학년 3반')).toBeInTheDocument();
    expect(screen.getByText('2학년 12반')).toBeInTheDocument();

    // highlightId가 지정된 참가자 행은 네온 테두리 강조가 적용된다
    const highlightedRow = screen.getByText('박서연').closest('li')!;
    expect(highlightedRow.className).toContain('border-brand-500');
  });

  it('showLast=false 이면 직전 획득 점수를 숨기고 max 개수만큼만 표시한다', () => {
    render(<Leaderboard entries={SAMPLE_ENTRIES} showLast={false} max={2} />);
    expect(screen.getByText('김민수')).toBeInTheDocument();
    expect(screen.getByText('박서연')).toBeInTheDocument();
    expect(screen.queryByText('이지훈')).not.toBeInTheDocument();
    expect(screen.queryByText('+950')).not.toBeInTheDocument();
  });
});

describe('Podium', () => {
  it('1~3위 참가자 이름과 포맷된 점수를 시상대에 표시한다', () => {
    render(<Podium entries={SAMPLE_ENTRIES} confetti={false} />);
    expect(screen.getByText('김민수')).toBeInTheDocument();
    expect(screen.getByText('2,850점')).toBeInTheDocument();
    expect(screen.getByText('박서연')).toBeInTheDocument();
    expect(screen.getByText('2,100점')).toBeInTheDocument();
    expect(screen.getByText('이지훈')).toBeInTheDocument();
    expect(screen.getByText('1,500점')).toBeInTheDocument();
  });
});
