import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionsSection } from '../src/components/dashboard/sections/QuestionsSection';
import { AdminAccountsCard } from '../src/components/dashboard/sections/SettingsSection';
import { ToastProvider } from '../src/contexts/ToastContext';
import AdminLoginPage from '../src/pages/AdminLoginPage';
import HomePage from '../src/pages/HomePage';
import { api, studentApi } from '../src/services/api';

const mockUseAdminAuth = vi.fn();
vi.mock('../src/contexts/AdminAuthContext', () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

describe('QuestionsSection (4지선다 · O/X · 단답형)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('유형별 배지 표시·필터링 및 O/X·단답형 문제 저장 요청을 올바르게 전송한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        questions: [
          {
            id: 1,
            questionType: 'MULTIPLE_CHOICE',
            questionText: '대한민국의 수도는?',
            options: ['부산', '서울', '대전', '인천'],
            correctIndex: 1,
            timeLimit: 20,
            isDoublePoints: false,
            orderNum: 1,
            explanation: null,
            category: '사회',
          },
          {
            id: 2,
            questionType: 'OX',
            questionText: '지구는 태양 주위를 돈다.',
            options: ['O', 'X'],
            correctIndex: 0,
            timeLimit: 15,
            isDoublePoints: true,
            orderNum: 2,
            explanation: null,
            category: '과학',
          },
        ],
      },
    } as any);
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { question: { id: 3 } } } as any);

    render(
      <ToastProvider>
        <QuestionsSection />
      </ToastProvider>,
    );

    expect(await screen.findByText('대한민국의 수도는?')).toBeInTheDocument();
    expect(screen.getByText('지구는 태양 주위를 돈다.')).toBeInTheDocument();

    // 유형 필터 동작 확인
    await user.selectOptions(screen.getByLabelText('유형 필터'), 'OX');
    expect(screen.queryByText('대한민국의 수도는?')).not.toBeInTheDocument();
    expect(screen.getByText('지구는 태양 주위를 돈다.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('유형 필터'), 'ALL');

    // 1) 새 O/X 문제 작성
    await user.click(screen.getByRole('button', { name: /새 문제/ }));
    const dialog = await screen.findByRole('dialog', { name: '새 문제' });
    await user.click(within(dialog).getByRole('radio', { name: /O\/X 문제/ }));
    await user.type(within(dialog).getByLabelText('문제'), '고래는 어류이다.');
    await user.click(within(dialog).getByLabelText('X 정답 지정'));
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(postSpy).toHaveBeenLastCalledWith(
      '/questions',
      expect.objectContaining({
        questionType: 'OX',
        questionText: '고래는 어류이다.',
        options: ['O', 'X'],
        correctIndex: 1,
      }),
    );

    // 2) 새 단답형 문제 작성 (복수 인정 답안)
    await user.click(await screen.findByRole('button', { name: /새 문제/ }));
    const dialog2 = await screen.findByRole('dialog', { name: '새 문제' });
    await user.click(within(dialog2).getByRole('radio', { name: /단답형/ }));
    await user.type(within(dialog2).getByLabelText('문제'), '훈민정음을 창제한 왕은?');
    await user.type(within(dialog2).getByLabelText('인정 답안 1'), '세종대왕');
    await user.click(within(dialog2).getByRole('button', { name: /인정 답안 추가/ }));
    await user.type(within(dialog2).getByLabelText('인정 답안 2'), '세종');
    await user.click(within(dialog2).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));
    expect(postSpy).toHaveBeenLastCalledWith(
      '/questions',
      expect.objectContaining({
        questionType: 'SHORT_ANSWER',
        questionText: '훈민정음을 창제한 왕은?',
        options: ['세종대왕', '세종'],
        correctIndex: 0,
      }),
    );

    // 3) JSON 일괄 등록 모달에서 고사성어·사자성어 30문제 프리셋 불러오기 후 등록
    postSpy.mockResolvedValueOnce({ data: { count: 30, questionIds: Array.from({ length: 30 }, (_, i) => i + 10), quizSetId: 9 } } as any);
    await user.click(await screen.findByRole('button', { name: /JSON 일괄 등록/ }));
    const bulkDialog = await screen.findByRole('dialog', { name: 'JSON 문제 일괄 등록' });
    await user.click(within(bulkDialog).getByRole('button', { name: /고사성어·사자성어 30문제 불러오기/ }));
    await user.click(within(bulkDialog).getByRole('button', { name: '일괄 등록' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(3));
    expect(postSpy).toHaveBeenLastCalledWith(
      '/questions/bulk',
      expect.objectContaining({
        quizSetTitle: '중2 고사성어·사자성어 퀴즈 (30문항)',
        questions: expect.arrayContaining([
          expect.objectContaining({ orderNum: 1, options: expect.arrayContaining(['작심삼일']) }),
          expect.objectContaining({ orderNum: 30, questionType: 'SHORT_ANSWER', options: ['권선징악'] }),
        ]),
      }),
    );
  });
});

describe('AdminAccountsCard (관리자 계정 관리)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAdminAuth.mockReturnValue({
      admin: { id: 1, username: 'admin', mustChangePassword: false },
    });
  });

  it('관리자 목록 표시, 본인 삭제 비활성화, 새 관리자 추가 및 다른 관리자 삭제가 동작한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        admins: [
          { id: 1, username: 'admin', mustChangePassword: false, createdAt: 1730000000000 },
          { id: 2, username: 'teacher_lee', mustChangePassword: true, createdAt: 1730000100000 },
        ],
      },
    } as any);
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      data: { admin: { id: 3, username: 'teacher_park', mustChangePassword: true } },
    } as any);
    const delSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { ok: true } } as any);

    render(
      <ToastProvider>
        <AdminAccountsCard />
      </ToastProvider>,
    );

    expect(await screen.findByText('teacher_lee')).toBeInTheDocument();
    expect(screen.getByText('본인')).toBeInTheDocument();
    expect(screen.getByText('초기 비밀번호 변경 대기')).toBeInTheDocument();

    // 본인 계정은 삭제 버튼 비활성화, 다른 관리자 계정은 활성화
    expect(screen.getByRole('button', { name: 'admin 계정 삭제' })).toBeDisabled();
    const delLeeBtn = screen.getByRole('button', { name: 'teacher_lee 계정 삭제' });
    expect(delLeeBtn).toBeEnabled();

    // 새 관리자 추가
    await user.type(screen.getByLabelText('새 관리자 아이디'), 'teacher_park');
    await user.type(screen.getByLabelText('새 관리자 초기 비밀번호'), 'initial-pw-2026!');
    await user.click(screen.getByRole('button', { name: /관리자 추가/ }));
    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith('/admins', {
        username: 'teacher_park',
        password: 'initial-pw-2026!',
      }),
    );

    // 다른 관리자 삭제 확인 다이얼로그 실행
    await user.click(delLeeBtn);
    const confirmModal = await screen.findByRole('dialog', { name: '관리자 계정 삭제' });
    await user.click(within(confirmModal).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(delSpy).toHaveBeenCalledWith('/admins/2'));
  });

  it('관리자가 1명뿐이면 삭제 버튼이 비활성화된다', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        admins: [{ id: 1, username: 'admin', mustChangePassword: false, createdAt: 1730000000000 }],
      },
    } as any);

    render(
      <ToastProvider>
        <AdminAccountsCard />
      </ToastProvider>,
    );

    const btn = await screen.findByRole('button', { name: 'admin 계정 삭제' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', '마지막 관리자 계정은 삭제할 수 없습니다.');
  });
});

describe('AdminLoginPage', () => {
  it('하단에 홈으로 이동하는 버튼을 렌더링한다', () => {
    mockUseAdminAuth.mockReturnValue({ admin: null, login: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLoginPage />
      </MemoryRouter>,
    );
    const homeLink = screen.getByRole('link', { name: '홈으로' });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });
});

describe('HomePage (학번+이름 자동 닉네임 입장)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('학년·반·번호·이름 선택 시 닉네임(예: 20307 홍길동)을 자동 생성해 바로 학급으로 입장하고 하단 관리자 로그인 링크를 유지한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentApi, 'get').mockResolvedValue({
      data: {
        classes: Array.from({ length: 12 }, (_, i) => ({
          classId: `2-${i + 1}`,
          className: `2학년 ${i + 1}반`,
          capacity: 35,
          status: 'WAITING',
          participantCount: 0,
          connectedCount: 0,
          joinable: true,
        })),
      },
    } as any);
    const joinSpy = vi.spyOn(studentApi, 'post').mockResolvedValue({
      data: {
        participantId: 101,
        token: 'tok-test-student-20307',
        nickname: '20307 홍길동',
        sessionId: 5,
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/:classId" element={<div>학급 퀴즈방 진입 완료</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // 하단 관리자 로그인 버튼 유지 확인
    const adminLink = screen.getByRole('link', { name: /선생님\(관리자\) 로그인/ });
    expect(adminLink).toHaveAttribute('href', '/admin');

    // 기본값: 2학년 1반 1번 -> 20101 홍길동 미리보기
    expect(await screen.findByRole('button', { name: /2학년 1반 입장하기/ })).toBeEnabled();
    await user.selectOptions(screen.getByLabelText('반'), '3');
    await user.selectOptions(screen.getByLabelText('번호'), '7');
    await user.type(screen.getByLabelText('이름'), '홍길동');

    expect(screen.getByTestId('generated-nickname')).toHaveTextContent('20307 홍길동');

    await user.click(screen.getByRole('button', { name: /2학년 3반 입장하기/ }));

    await waitFor(() =>
      expect(joinSpy).toHaveBeenCalledWith('/classes/2-3/join', {
        nickname: '20307 홍길동',
      }),
    );
    expect(await screen.findByText('학급 퀴즈방 진입 완료')).toBeInTheDocument();
  });
});
