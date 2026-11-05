import { Clock } from 'lucide-react';

export function TimerBar({ remainingMs, totalMs, large }: { remainingMs: number; totalMs: number; large?: boolean }) {
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const color = ratio > 0.5 ? 'from-lime-300 to-emerald-500' : ratio > 0.25 ? 'from-yellow-300 to-amber-500' : 'from-rose-400 to-red-600';
  const sec = Math.ceil(remainingMs / 1000);
  return (
    <div className="flex items-center gap-3" role="timer" aria-live="off" aria-label={`남은 시간 ${sec}초`}>
      <div
        className={`flex shrink-0 items-center gap-1 font-display tabular-nums ${large ? 'text-6xl [@media(max-height:820px)]:text-4xl' : 'text-3xl'} ${
          ratio <= 0.25 ? 'text-rose-600 animate-pulse' : 'text-slate-800'
        }`}
      >
        <Clock className={`${large ? 'h-12 w-12 [@media(max-height:820px)]:h-8 [@media(max-height:820px)]:w-8' : 'h-7 w-7'} ${ratio <= 0.25 ? 'text-rose-500' : 'text-brand-600'}`} />
        {sec}
      </div>
      <div className={`relative flex-1 overflow-hidden rounded-full bg-slate-200/85 ${large ? 'h-6' : 'h-4'}`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-[width] duration-100 ease-linear`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
