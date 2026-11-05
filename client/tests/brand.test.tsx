import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Logo } from '../src/components/common/Logo';

describe('QUIZUP 로고', () => {
  it('QUIZUP 워드마크를 홈(/)으로 가는 링크로 렌더링한다', () => {
    render(
      <MemoryRouter>
        <Logo size="lg" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'QUIZUP 홈' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent('QUIZUP');
  });

  it('이동 경로(to)를 지정할 수 있다', () => {
    render(
      <MemoryRouter>
        <Logo size="sm" to="/admin/dashboard" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'QUIZUP 홈' })).toHaveAttribute('href', '/admin/dashboard');
  });
});
