import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classDisplayName, formatStudentNickname, isValidClassId } from '@shared/types/index';
import { QrCode } from '../src/components/common/QrCode';
import { useCountdown } from '../src/hooks/useCountdown';
import { QUESTION_TYPE_LABEL, num, pct, seconds } from '../src/utils/format';
import { encodeQrMatrix } from '../src/utils/qrcode';

describe('포맷 유틸 및 공용 학급 헬퍼', () => {
  it('점수·백분율·시간·문제 유형 레이블을 올바르게 포맷한다', () => {
    expect(num(0)).toBe('0');
    expect(num(12345)).toBe('12,345');
    expect(pct(0.875, 1)).toBe('87.5%');
    expect(pct(0.5)).toBe('50%');
    expect(seconds(null)).toBe('-');
    expect(seconds(3450)).toBe('3.5초');
    expect(QUESTION_TYPE_LABEL).toEqual({
      MULTIPLE_CHOICE: '4지선다',
      OX: 'O/X',
      SHORT_ANSWER: '단답형',
    });
  });

  it('2학년 1~12반 학급 ID 검증 및 표시 이름을 반환한다', () => {
    expect(isValidClassId('2-1')).toBe(true);
    expect(isValidClassId('2-12')).toBe(true);
    expect(isValidClassId('2-0')).toBe(false);
    expect(isValidClassId('2-13')).toBe(false);
    expect(isValidClassId('1-1')).toBe(false);
    expect(classDisplayName('2-7')).toBe('2학년 7반');
    expect(formatStudentNickname(2, 1, 1, '홍길동')).toBe('20101 홍길동');
    expect(formatStudentNickname(2, 12, 35, '  김철수 ')).toBe('21235 김철수');
  });
});

describe('useCountdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('서버 시각 오프셋을 보정하여 남은 시간과 시작 전 대기 시간을 계산하고 일시정지 시 frozenMs를 유지한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T00:00:00.000Z'));
    const clientNow = Date.now();
    // 클라이언트 시계가 서버보다 5초 느린 상황 시뮬레이션
    const serverNow = clientNow + 5000;
    const startTime = serverNow + 2000; // 2배 문제 리드인 2초
    const endTime = startTime + 20000;

    const { result, rerender } = renderHook(
      (props: { running: boolean; frozenMs?: number | null }) =>
        useCountdown({
          endTime,
          startTime,
          running: props.running,
          frozenMs: props.frozenMs,
          serverNow,
        }),
      { initialProps: { running: true, frozenMs: null as number | null } },
    );

    expect(result.current.beforeStartMs).toBe(2000);
    expect(result.current.remainingMs).toBe(22000);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.beforeStartMs).toBe(0);
    expect(result.current.remainingMs).toBe(19500);

    // 일시정지 전환 시 frozenMs 고정
    rerender({ running: false, frozenMs: 12300 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.remainingMs).toBe(12300);
  });
});

describe('QR 코드 인코더 및 QrCode 컴포넌트', () => {
  it('학급 참가 URL에 대해 정사각형 QR 행렬과 3곳 파인더 패턴·SVG 경로를 생성한다', () => {
    const url = 'https://classquiz.bravekoon.workers.dev/2-3';
    const matrix = encodeQrMatrix(url);
    expect(matrix.length).toBe(33); // Version 4 (33x33)
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);

    // 좌상단·우상단·좌하단 7x7 파인더 중심(3, 3)은 항상 어두운 모듈
    const n = matrix.length;
    expect(matrix[3][3]).toBe(true);
    expect(matrix[3][n - 4]).toBe(true);
    expect(matrix[n - 4][3]).toBe(true);

    render(<QrCode value={url} size={220} label="2학년 3반 참가 QR 코드" />);
    const svg = screen.getByRole('img', { name: '2학년 3반 참가 QR 코드' });
    expect(svg).toHaveAttribute('viewBox', `0 0 ${n + 8} ${n + 8}`);
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
  });
});
