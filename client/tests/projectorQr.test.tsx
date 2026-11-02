import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@shared/types/index';
import ProjectorPage from '../src/pages/ProjectorPage';
import { studentApi } from '../src/services/api';

const mockEmitAck = vi.fn();
const mockOptionalAuth = vi.fn();

vi.mock('../src/contexts/AdminAuthContext', () => ({
  useOptionalAdminAuth: () => mockOptionalAuth(),
}));

vi.mock('../src/socket', () => ({
  createSocket: (auth: { role: string }) => {
    const handlers = new Map<string, ((...args: any[]) => void)[]>();
    const sock = {
      connected: true,
      on: vi.fn((ev: string, fn: (...args: any[]) => void) => {
        handlers.set(ev, [...(handlers.get(ev) ?? []), fn]);
        if (auth.role === 'admin' && ev === 'connect') {
          fn();
        }
        return sock;
      }),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
      disconnect: vi.fn(),
    };
    return sock;
  },
  emitAck: (...args: any[]) => mockEmitAck(...args),
}));

describe('ProjectorPage 학급 참가 QR 코드 및 선생님 진행 컨트롤', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockEmitAck.mockReset();
    mockEmitAck.mockResolvedValue({ ok: true });
    mockOptionalAuth.mockReturnValue(null);
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
          capacity: 35,
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

    const inlineQr = await screen.findByRole('img', { name: '2학년 3반 참가 QR 코드' });
    expect(inlineQr).toBeInTheDocument();
    expect(screen.getByText(/\/2-3$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'QR 크게 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '2학년 3반 참가 QR 코드' });
    expect(within(dialog).getByRole('img', { name: '2학년 3반 참가 QR 코드 QR 코드' })).toBeInTheDocument();
  });

  it('선생님 로그인 상태에서는 프로젝터 화면에서 시작·일시정지·결과 발표·건너뛰기·다음 문제를 직접 실행할 수 있다', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    mockOptionalAuth.mockReturnValue({
      token: 'admin-jwt-token',
      admin: { id: 1, username: 'teacher1', mustChangePassword: false, createdAt: now },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
    });

    // 1) WAITING 상태에서 '퀴즈 시작' 실행 검증
    vi.spyOn(studentApi, 'get').mockResolvedValueOnce({
      data: {
        state: {
          classId: '2-5',
          className: '2학년 5반',
          sessionId: 11,
          competitionId: 1,
          competitionTitle: '2학년 퀴즈 대회',
          quizSetTitle: '고사성어 퀴즈',
          status: 'WAITING',
          questionIndex: -1,
          totalQuestions: 10,
          question: null,
          startTime: null,
          endTime: null,
          remainingMs: null,
          serverNow: now,
          participantCount: 12,
          connectedCount: 12,
          answeredCount: 0,
          capacity: 35,
          results: null,
          leaderboard: [],
        },
      },
    } as any);

    const { unmount } = render(
      <MemoryRouter initialEntries={['/projector/2-5']}>
        <Routes>
          <Route path="/projector/:classId" element={<ProjectorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const dock = await screen.findByRole('region', { name: '프로젝터 퀴즈 진행 컨트롤' });
    await user.click(within(dock).getByRole('button', { name: /퀴즈 시작/ }));
    expect(mockEmitAck).toHaveBeenCalledWith(expect.anything(), EVENTS.ADMIN_START, { classId: '2-5' }, 15000);
    unmount();

    // 2) PLAYING 상태에서 '일시정지', '결과 발표', '건너뛰기' 실행 검증
    mockEmitAck.mockClear();
    vi.spyOn(studentApi, 'get').mockResolvedValueOnce({
      data: {
        state: {
          classId: '2-7',
          className: '2학년 7반',
          sessionId: 12,
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
            category: '사자성어',
          },
          startTime: now - 1000,
          endTime: now + 19000,
          remainingMs: 19000,
          serverNow: now,
          participantCount: 15,
          connectedCount: 15,
          answeredCount: 5,
          capacity: 35,
          results: null,
          leaderboard: [],
        },
      },
    } as any);

    const r2 = render(
      <MemoryRouter initialEntries={['/projector/2-7']}>
        <Routes>
          <Route path="/projector/:classId" element={<ProjectorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const playingDock = await screen.findByRole('region', { name: '프로젝터 퀴즈 진행 컨트롤' });
    await user.click(within(playingDock).getByRole('button', { name: /일시정지/ }));
    expect(mockEmitAck).toHaveBeenCalledWith(expect.anything(), EVENTS.ADMIN_PAUSE, { classId: '2-7' }, 15000);

    await user.click(within(playingDock).getByRole('button', { name: /결과 발표/ }));
    expect(mockEmitAck).toHaveBeenCalledWith(expect.anything(), EVENTS.ADMIN_SHOW_RESULTS, { classId: '2-7' }, 15000);

    await user.click(within(playingDock).getByRole('button', { name: /건너뛰기/ }));
    expect(mockEmitAck).toHaveBeenCalledWith(expect.anything(), EVENTS.ADMIN_SKIP, { classId: '2-7' }, 15000);
    r2.unmount();

    // 3) RESULT 상태에서 '다음 문제' 실행 검증
    mockEmitAck.mockClear();
    vi.spyOn(studentApi, 'get').mockResolvedValueOnce({
      data: {
        state: {
          classId: '2-7',
          className: '2학년 7반',
          sessionId: 12,
          competitionId: 1,
          competitionTitle: '2학년 퀴즈 대회',
          quizSetTitle: '고사성어 퀴즈',
          status: 'RESULT',
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
            category: '사자성어',
          },
          startTime: now - 20000,
          endTime: now,
          remainingMs: 0,
          serverNow: now,
          participantCount: 15,
          connectedCount: 15,
          answeredCount: 15,
          capacity: 35,
          results: {
            questionId: 1,
            index: 0,
            correctIndex: 0,
            explanation: '까마귀 날자 배 떨어진다는 뜻입니다.',
            distribution: [12, 1, 1, 1],
            answeredCount: 15,
            correctCount: 12,
            participantCount: 15,
            averageElapsedMs: 3200,
          },
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

    const resultDock = await screen.findByRole('region', { name: '프로젝터 퀴즈 진행 컨트롤' });
    await user.click(within(resultDock).getByRole('button', { name: /다음 문제/ }));
    expect(mockEmitAck).toHaveBeenCalledWith(expect.anything(), EVENTS.ADMIN_NEXT, { classId: '2-7' }, 15000);
  });
});
