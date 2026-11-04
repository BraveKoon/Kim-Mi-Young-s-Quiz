import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassState } from '@shared/types/index';

// 소켓 없이 화면만 검증하기 위해 훅이 돌려주는 값을 테스트에서 직접 지정한다.
const hook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../src/hooks/useStudentQuiz', async (orig) => ({
  ...(await orig<typeof import('../src/hooks/useStudentQuiz')>()),
  useStudentQuiz: () => hook.value,
}));

import ClassPage from '../src/pages/ClassPage';

function playingState(questionIndex: number): ClassState {
  const now = Date.now();
  return {
    classId: '2-1',
    className: '2학년 1반',
    sessionId: 1,
    competitionId: 1,
    competitionTitle: '기본 대회',
    quizSetTitle: '고사성어',
    status: 'PLAYING',
    questionIndex,
    totalQuestions: 5,
    question: { id: 10 + questionIndex, index: questionIndex, questionType: 'MULTIPLE_CHOICE', text: '질문?', options: ['가', '나', '다', '라'], timeLimit: 20, isDoublePoints: false, category: null },
    startTime: now - 1000,
    endTime: now + 19000,
    remainingMs: 19000,
    serverNow: now,
    answeredCount: 1,
    participantCount: 12,
    connectedCount: 12,
    capacity: 35,
    results: null,
    leaderboard: [],
  };
}

function setup(questionIndex: number, myRank: number) {
  hook.value = {
    state: playingState(questionIndex),
    conn: 'connected',
    participants: [],
    answered: { answeredCount: 1, participantCount: 12 },
    mySubmit: { questionId: 10 + questionIndex, selectedIndex: 1 },
    myResult: null,
    myTotal: 1750,
    myRank,
    timerSync: null,
    submit: vi.fn(),
    reconnect: vi.fn(),
  };
  localStorage.setItem('classquiz.student.2-1', JSON.stringify({ participantId: 1, token: 't'.repeat(30), nickname: '20101 홍길동', sessionId: 1 }));
  return render(
    <MemoryRouter initialEntries={['/2-1']}>
      <Routes>
        <Route path="/:classId" element={<ClassPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('학생 화면 내 등수 표시', () => {
  beforeEach(() => localStorage.clear());

  it('문제를 푼 뒤(제출 완료 화면)에 직전 문제까지의 내 등수·전체 인원·점수를 보여준다', () => {
    setup(2, 3);
    const card = screen.getByTestId('my-rank-card');
    expect(card).toHaveTextContent('내 등수 (직전 문제까지)');
    expect(card).toHaveTextContent('3위');
    expect(card).toHaveTextContent('/ 12명');
    expect(card).toHaveTextContent('1,750점');
    // 상단 점수 칩에도 등수가 함께 표시된다
    expect(screen.getByLabelText('내 점수와 등수')).toHaveTextContent('3위');
  });

  it('첫 문제에서는 모두 0점이라 등수가 의미 없으므로 표시하지 않는다', () => {
    setup(0, 1);
    expect(screen.queryByTestId('my-rank-card')).toBeNull();
    expect(screen.getByLabelText('내 점수와 등수')).not.toHaveTextContent('위');
  });
});
