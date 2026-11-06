import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { autoFocusOnDesktop } from '../../utils/pointer';
import { Logo } from './Logo';

const STEPS = [
  { title: '이름 입력', desc: '학번과 이름으로 우리 반에 입장해요' },
  { title: '대기실', desc: '선생님이 시작하면 퀴즈가 열려요' },
  { title: '퀴즈와 순위', desc: '빠르고 정확하게 풀고 순위를 확인해요' },
];

/** 학생 입장 화면(학년·반·번호·이름) 앞에 보이는 QuizBeat 시작 화면 */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, delay, ease: [0.23, 1, 0.32, 1] as const } };

  return (
    <main className="min-h-dvh w-full bg-paper text-slate-900">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
        <motion.div {...fade(0)}>
          <Logo size="lg" animated />
        </motion.div>

        <motion.h1 {...fade(0.04)} className="mt-6 font-display text-3xl text-slate-900 sm:text-4xl">
          우리 반 실시간 퀴즈
        </motion.h1>
        <motion.p {...fade(0.08)} className="mt-2 text-base font-medium text-slate-600 sm:text-lg">
          친구들과 함께 풀고, 순위로 확인해요
        </motion.p>

        <motion.ol {...fade(0.12)} className="mt-9 w-full divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-left" aria-label="참여 방법">
          {STEPS.map((s) => (
            <li key={s.title} className="px-4 py-3.5">
              <span className="block text-base text-slate-900">{s.title}</span>
              <span className="block text-sm text-slate-600">{s.desc}</span>
            </li>
          ))}
        </motion.ol>

        <motion.div {...fade(0.16)} className="mt-9 w-full">
          <button
            type="button"
            onClick={onStart}
            autoFocus={autoFocusOnDesktop}
            className="btn-primary h-14 w-full rounded-2xl text-lg font-extrabold"
          >
            시작하기 <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </motion.div>

        <motion.div {...fade(0.2)} className="mt-6">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <Shield className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <span>선생님(관리자) 로그인</span>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
