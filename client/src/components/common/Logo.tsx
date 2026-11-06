import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

/** 비트 막대 3개: 높이가 시상대(2위·1위·3위) 순서이면서 이퀄라이저 같은 QuizBeat 마크 (가운데 막대만 노란색) */
const BARS = [
  { x: 6.6, y: 13.5, h: 12, fill: '#ffffff', dur: 0.9, delay: 0.1 },
  { x: 13.8, y: 6.5, h: 19, fill: '#fde68a', dur: 0.7, delay: 0 },
  { x: 21, y: 17.5, h: 8, fill: '#ffffff', dur: 1.1, delay: 0.2 },
];

/** QuizBeat 마크. animated 이면 막대가 비트처럼 움직인다(움직임 줄이기 설정을 따름). */
export function LogoMark({ className = 'h-9 w-9', animated = false }: { className?: string; animated?: boolean }) {
  const reduce = useReducedMotion();
  const move = animated && !reduce;
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#7059EE" />
      {BARS.map((b, i) =>
        move ? (
          <motion.rect
            key={i}
            x={b.x}
            y={b.y}
            width="4.4"
            height={b.h}
            rx="2.2"
            fill={b.fill}
            style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
            animate={{ scaleY: [1, 0.55, 1] }}
            transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <rect key={i} x={b.x} y={b.y} width="4.4" height={b.h} rx="2.2" fill={b.fill} />
        ),
      )}
    </svg>
  );
}

/** QuizBeat 워드마크: Quiz(진한 글자) + Beat(포인트색) */
export function Logo({ size = 'md', to = '/', animated = false }: { size?: 'sm' | 'md' | 'lg'; to?: string; animated?: boolean }) {
  const textCls = size === 'lg' ? 'text-4xl sm:text-5xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  const markCls = size === 'lg' ? 'h-10 w-10 sm:h-12 sm:w-12' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <Link to={to} aria-label="QuizBeat 홈" className="inline-flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40">
      <LogoMark className={`shrink-0 ${markCls}`} animated={animated} />
      <span className={`font-display tracking-tight text-slate-900 ${textCls}`}>
        Quiz<span className="text-brand-600">Beat</span>
      </span>
    </Link>
  );
}
