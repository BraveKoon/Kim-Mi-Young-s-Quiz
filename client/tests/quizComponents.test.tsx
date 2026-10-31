import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusBadge } from '../src/components/common/StatusBadge';
import { AnswerButton } from '../src/components/quiz/AnswerButton';
import { DoublePointsBanner } from '../src/components/quiz/DoublePointsBanner';
import { TimerBar } from '../src/components/quiz/TimerBar';

describe('TimerBar', () => {
  it('남은 초를 올림하여 표시하고 비율에 맞게 진행 막대 너비를 계산한다', () => {
    const { container } = render(<TimerBar remainingMs={14200} totalMs={20000} />);
    const timer = screen.getByRole('timer', { name: '남은 시간 15초' });
    expect(timer).toBeInTheDocument();
    expect(timer).toHaveTextContent('15');
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('71%');
    expect(bar.className).toContain('from-lime-300');
  });

  it('남은 시간 비율에 따라 경고 색상(노랑/빨강) 및 깜빡임 효과를 적용한다', () => {
    const { container, rerender } = render(<TimerBar remainingMs={8000} totalMs={20000} />);
    let bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.className).toContain('from-yellow-300');

    rerender(<TimerBar remainingMs={4000} totalMs={20000} />);
    bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.className).toContain('from-rose-400');
    expect(screen.getByRole('timer')).toHaveTextContent('4');
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('음수나 총시간 초과 입력도 0%~100% 범위로 안전하게 보정한다', () => {
    const { container, rerender } = render(<TimerBar remainingMs={-500} totalMs={20000} />);
    let bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('0%');

    rerender(<TimerBar remainingMs={30000} totalMs={20000} />);
    bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('100%');

    rerender(<TimerBar remainingMs={5000} totalMs={0} />);
    bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });
});

describe('AnswerButton', () => {
  it('보기 도형·문구·접근성 레이블을 표시하고 클릭 이벤트를 전달한다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AnswerButton index={1} text="서울특별시" mode="idle" onClick={onClick} />);
    const btn = screen.getByRole('button', { name: '2번 파랑: 서울특별시' });
    expect(btn).toHaveTextContent('◆');
    expect(btn).toHaveTextContent('서울특별시');
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 상태에서는 클릭되지 않으며 결과 공개 시 선택 인원 배지를 표시한다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AnswerButton index={0} text="O" mode="correct" disabled count={18} onClick={onClick} />);
    const btn = screen.getByRole('button', { name: '1번 빨강: O' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('18명');
    expect(btn.className).toContain('ring-lime-300');
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('DoublePointsBanner & StatusBadge', () => {
  it('2배 점수 배너를 show 여부에 따라 표시/숨김 처리한다', () => {
    const { rerender } = render(<DoublePointsBanner show={false} />);
    expect(screen.queryByText(/DOUBLE POINTS x2!/i)).not.toBeInTheDocument();
    rerender(<DoublePointsBanner show={true} />);
    expect(screen.getByText(/DOUBLE POINTS x2!/i)).toBeInTheDocument();
  });

  it('세션 상태별 한국어 배지를 표시한다', () => {
    const { rerender } = render(<StatusBadge status="WAITING" />);
    expect(screen.getByText('대기 중')).toBeInTheDocument();
    rerender(<StatusBadge status="PLAYING" />);
    expect(screen.getByText('진행 중')).toBeInTheDocument();
    rerender(<StatusBadge status="PAUSED" />);
    expect(screen.getByText('일시정지')).toBeInTheDocument();
    rerender(<StatusBadge status="RESULT" />);
    expect(screen.getByText('결과 공개')).toBeInTheDocument();
    rerender(<StatusBadge status="FINISHED" />);
    expect(screen.getByText('종료')).toBeInTheDocument();
  });
});
