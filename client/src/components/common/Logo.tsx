import { Link } from 'react-router-dom';

export function Logo({ size = 'md', to = '/' }: { size?: 'sm' | 'md' | 'lg'; to?: string }) {
  const textCls = size === 'lg' ? 'text-4xl sm:text-[2.75rem]' : size === 'sm' ? 'text-xl' : 'text-2xl sm:text-3xl';
  const boxCls = size === 'lg' ? 'h-11 w-11 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-xl' : 'h-9 w-9 rounded-xl';
  const iconCls = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const dotCls = size === 'lg' ? 'h-3 w-3 -top-1 -right-1' : 'h-2.5 w-2.5 -top-0.5 -right-0.5';

  return (
    <Link to={to} className="group inline-flex items-center gap-2.5 focus:outline-none">
      <span
        className={`relative flex shrink-0 items-center justify-center bg-[#2563EB] text-white shadow-[0_6px_16px_-4px_rgba(37,99,235,0.45)] transition-transform group-hover:-translate-y-0.5 ${boxCls}`}
      >
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6.5 5.5h11A3.5 3.5 0 0121 9v6a3.5 3.5 0 01-3.5 3.5H12l-4.2 2.8c-.66.44-1.55-.03-1.55-.83V18.5A3.5 3.5 0 013 15V9a3.5 3.5 0 013.5-3.5z"
            fill="currentColor"
          />
          <circle cx="9" cy="12" r="1.35" fill="#EFF7FF" />
          <circle cx="12.5" cy="12" r="1.35" fill="#FACC15" />
          <circle cx="16" cy="12" r="1.35" fill="#EFF7FF" />
        </svg>
        <span className={`absolute rounded-full border-2 border-white bg-[#FB7185] ${dotCls}`} />
      </span>
      <span className={`font-display tracking-tight text-slate-900 ${textCls}`}>ClassQuiz</span>
    </Link>
  );
}

/** 카드 상단 4색 포인트 바 (파랑 · 청록 · 레몬 · 코랄) */
export function ClassroomAccentStrip() {
  return (
    <div className="grid h-1.5 w-full grid-cols-4" aria-hidden="true">
      <div className="bg-[#2563EB]" />
      <div className="bg-[#14B8A6]" />
      <div className="bg-[#FACC15]" />
      <div className="bg-[#FB7185]" />
    </div>
  );
}
