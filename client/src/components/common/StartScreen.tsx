import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ListChecks, Shield, Trophy, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const STEPS = [
  { icon: UserRound, title: '이름 입력', desc: '학번과 이름으로 우리 반에 입장해요' },
  { icon: ListChecks, title: '대기실', desc: '선생님이 시작하면 퀴즈가 열려요' },
  { icon: Trophy, title: '퀴즈 · 순위', desc: '빠르고 정확하게 풀고 순위를 확인해요' },
];

/** 학생 입장 화면(학년·반·번호·이름) 앞에 보이는 QuizBeat 시작 화면 */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay } };

  return (
    <div className="min-h-dvh w-full bg-[#f6f6f8] text-slate-900">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
        <motion.div {...fade(0)}>
          <Logo size="lg" animated />
        </motion.div>

        <motion.h1 {...fade(0.1)} className="mt-6 font-display text-3xl text-slate-900 sm:text-4xl">
          우리 반 실시간 퀴즈
        </motion.h1>
        <motion.p {...fade(0.15)} className="mt-2 text-base font-medium text-slate-600 sm:text-lg">
          친구들과 함께 풀고, 순위로 확인해요
        </motion.p>

        <motion.ol {...fade(0.25)} className="mt-9 grid w-full gap-2.5 text-left" aria-label="참여 방법">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <s.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-slate-900">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-sm font-medium text-slate-600">{s.desc}</span>
              </span>
            </li>
          ))}
        </motion.ol>

        <motion.div {...fade(0.35)} className="mt-9 w-full">
          <button
            type="button"
            onClick={onStart}
            autoFocus
            className="btn-primary h-14 w-full rounded-2xl text-lg font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-brand-600/30"
          >
            시작하기 <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </motion.div>

        <motion.div {...fade(0.45)} className="mt-6">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <Shield className="h-4 w-4 text-brand-600" />
            <span>선생님(관리자) 로그인</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
