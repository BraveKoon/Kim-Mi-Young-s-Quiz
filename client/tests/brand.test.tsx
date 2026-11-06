import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Logo } from '../src/components/common/Logo';

describe('QuizBeat 로고', () => {
  it('QuizBeat 워드마크를 홈(/)으로 가는 링크로 렌더링한다', () => {
    render(
      <MemoryRouter>
        <Logo size="lg" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'QuizBeat 홈' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent('QuizBeat');
  });

  it('이동 경로(to)를 지정할 수 있다', () => {
    render(
      <MemoryRouter>
        <Logo size="sm" to="/admin/dashboard" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'QuizBeat 홈' })).toHaveAttribute('href', '/admin/dashboard');
  });

  it('마크는 막대 3개로 그려지고, 움직이는 마크(animated)도 같은 막대 3개를 렌더링한다', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <Logo />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('svg rect')).toHaveLength(4); // 배경 1 + 막대 3
    rerender(
      <MemoryRouter>
        <Logo animated />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('svg rect')).toHaveLength(4);
  });
});
