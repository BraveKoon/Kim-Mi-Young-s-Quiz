import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 서버 없이 화면 흐름만 검증한다.
vi.mock('../src/services/api', () => ({
  studentApi: { get: vi.fn(() => Promise.resolve({ data: { classes: [] } })), post: vi.fn() },
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

import HomePage from '../src/pages/HomePage';

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

describe('학생 입장 시작 화면', () => {
  beforeEach(() => sessionStorage.clear());

  it('처음에는 시작 화면만 보이고 학년·반·번호·이름 입력 화면은 보이지 않는다', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: '우리 반 실시간 퀴즈' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /시작하기/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('학년')).toBeNull();
    expect(screen.queryByLabelText('반')).toBeNull();
    // 선생님(관리자) 로그인 링크는 시작 화면에도 유지된다
    expect(screen.getByRole('link', { name: /선생님\(관리자\) 로그인/ })).toHaveAttribute('href', '/admin');
  });

  it('시작하기를 누르면 학년·반·번호·이름 입력 화면으로 넘어간다', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /시작하기/ }));
    expect(screen.getByLabelText('학년')).toBeInTheDocument();
    expect(screen.getByLabelText('반')).toBeInTheDocument();
    expect(screen.getByLabelText('번호')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^시작하기/ })).toBeNull();
  });

  it('같은 탭에서 다시 방문하면 시작 화면을 건너뛰고 바로 입력 화면을 보여 준다', async () => {
    const first = renderHome();
    await userEvent.click(screen.getByRole('button', { name: /시작하기/ }));
    first.unmount();
    renderHome();
    expect(screen.getByLabelText('학년')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '우리 반 실시간 퀴즈' })).toBeNull();
  });

  it('세션 저장소를 쓸 수 없어도 시작하기로 입력 화면에 진입할 수 있다', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /시작하기/ }));
    expect(screen.getByLabelText('학년')).toBeInTheDocument();
    spy.mockRestore();
  });
});
