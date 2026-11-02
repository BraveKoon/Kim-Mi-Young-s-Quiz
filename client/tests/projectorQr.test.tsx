import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectorPage from '../src/pages/ProjectorPage';
import { studentApi } from '../src/services/api';

vi.mock('../src/socket', () => ({
  createSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

describe('ProjectorPage 학급 참가 QR 코드', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('대기(WAITING) 화면에서 반 참가 QR 코드와 접속 주소를 표시하고 크게 보기 모달을 연다', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentApi, 'get').mockResolvedValue({
      data: {
        state: {
          classId: '2-3',
          className: '2학년 3반',
          sessionId: 10,
          competitionId: 1,
          competitionTitle: '2학년 퀴즈 대회',
          quizSetTitle: '고사성어 퀴즈',
          status: 'WAITING',
          questionIndex: -1,
          totalQuestions: 30,
          question: null,
          startTime: null,
          endTime: null,
          remainingMs: null,
          serverNow: Date.now(),
          participantCount: 2,
          connectedCount: 2,
          answeredCount: 0,
          results: null,
          leaderboard: [],
        },
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/projector/2-3']}>
        <Routes>
          <Route path="/projector/:classId" element={<ProjectorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // 대기 화면 인라인 QR 코드 확인
    const inlineQr = await screen.findByRole('img', { name: '2학년 3반 참가 QR 코드' });
    expect(inlineQr).toBeInTheDocument();
    expect(screen.getByText(/\/2-3$/)).toBeInTheDocument();

    // QR 크게 보기 모달 열기 확인
    await user.click(screen.getByRole('button', { name: 'QR 크게 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '2학년 3반 참가 QR 코드' });
    expect(within(dialog).getByRole('img', { name: '2학년 3반 참가 QR 코드 QR 코드' })).toBeInTheDocument();
  });

  it('퀴즈 진행(PLAYING) 중에도 상단 참가 QR 버튼으로 뒤늦게 온 학생용 QR 모달을 띄울 수 있다', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    vi.spyOn(studentApi, 'get').mockResolvedValue({
      data: {
        state: {
          classId: '2-7',
          className: '2학년 7반',
          sessionId: 11,
          competitionId: 1,
          competitionTitle: '2학년 퀴즈 대회',
          quizSetTitle: '고사성어 퀴즈',
          status: 'PLAYING',
          questionIndex: 0,
          totalQuestions: 10,
          question: {
            id: 1,
            index: 0,
            questionType: 'MULTIPLE_CHOICE',
            text: '까마귀 날자 배 떨어진다는 뜻의 사자성어는?',
            options: ['오비이락', '동문서답', '유유상종', '일석이조'],
            timeLimit: 20,
            isDoublePoints: false,
          },
          startTime: now - 1000,
          endTime: now + 19000,
          remainingMs: null,
          serverNow: now,
          participantCount: 15,
          connectedCount: 15,
          answeredCount: 5,
          results: null,
          leaderboard: [],
        },
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/projector/2-7']}>
        <Routes>
          <Route path="/projector/:classId" element={<ProjectorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('까마귀 날자 배 떨어진다는 뜻의 사자성어는?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /참가 QR/ }));
    const dialog = await screen.findByRole('dialog', { name: '2학년 7반 참가 QR 코드' });
    expect(within(dialog).getByText(/\/2-7$/)).toBeInTheDocument();
  });
});
