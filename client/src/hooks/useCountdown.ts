import { useEffect, useRef, useState } from 'react';

/**
 * 서버 시각 기준 남은 시간 계산(화면 표시용).
 * 실제 마감 판정은 서버가 하며, 여기서는 serverNow 로 계산한 시계 오차를 보정해 부드럽게 표시만 한다.
 */
export function useServerOffset(serverNow: number | undefined) {
  const offset = useRef(0);
  if (serverNow) offset.current = serverNow - Date.now();
  return offset;
}

export function useCountdown(opts: { endTime: number | null; startTime?: number | null; running: boolean; frozenMs?: number | null; serverNow?: number }) {
  const offset = useServerOffset(opts.serverNow);
  const calc = () => {
    if (!opts.running) return opts.frozenMs ?? (opts.endTime ? Math.max(0, opts.endTime - (Date.now() + offset.current)) : 0);
    return opts.endTime ? Math.max(0, opts.endTime - (Date.now() + offset.current)) : 0;
  };
  const [remaining, setRemaining] = useState(calc);
  const [beforeStartMs, setBeforeStart] = useState(0);
  useEffect(() => {
    const tick = () => {
      setRemaining(calc());
      setBeforeStart(opts.startTime ? Math.max(0, opts.startTime - (Date.now() + offset.current)) : 0);
    };
    tick();
    if (!opts.running) return;
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.endTime, opts.startTime, opts.running, opts.frozenMs, opts.serverNow]);
  return { remainingMs: remaining, beforeStartMs };
}
