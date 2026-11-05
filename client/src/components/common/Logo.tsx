import { Link } from 'react-router-dom';

/** QUIZUP 마크: 진한 정사각형 + 위로 향한 화살표 (UP) */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0F172A" />
      <path d="M16 23V10M10 15.5l6-6 6 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** QUIZUP 워드마크: QUIZ(진한 글자) + UP(포인트색) */
export function Logo({ size = 'md', to = '/' }: { size?: 'sm' | 'md' | 'lg'; to?: string }) {
  const textCls = size === 'lg' ? 'text-4xl sm:text-5xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  const markCls = size === 'lg' ? 'h-10 w-10 sm:h-12 sm:w-12' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <Link to={to} aria-label="QUIZUP 홈" className="inline-flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40">
      <LogoMark className={`shrink-0 ${markCls}`} />
      <span className={`font-display tracking-tight text-slate-900 ${textCls}`}>
        QUIZ<span className="text-brand-600">UP</span>
      </span>
    </Link>
  );
}
