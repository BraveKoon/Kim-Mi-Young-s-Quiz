import { motion } from 'framer-motion';
import { Lock, Shield, Users, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SessionStatus } from '@shared/types/index';
import { Logo } from '../components/common/Logo';
import { StatusBadge } from '../components/common/StatusBadge';
import { useInterval } from '../hooks/useInterval';
import { studentApi } from '../services/api';

interface LobbyClass {
  classId: string;
  className: string;
  capacity: number;
  status: SessionStatus | 'NO_SESSION';
  participantCount: number;
  connectedCount: number;
  joinable: boolean;
}

const PLACEHOLDER: LobbyClass[] = Array.from({ length: 12 }, (_, i) => ({
  classId: `2-${i + 1}`,
  className: `2학년 ${i + 1}반`,
  capacity: 35,
  status: 'NO_SESSION',
  participantCount: 0,
  connectedCount: 0,
  joinable: false,
}));

export default function HomePage() {
  const [classes, setClasses] = useState<LobbyClass[] | null>(null);
  const [error, setError] = useState(false);
  const load = () =>
    studentApi
      .get('/classes')
      .then((r) => {
        setClasses(r.data.classes);
        setError(false);
      })
      .catch(() => setError(true));
  useEffect(() => {
    load();
  }, []);
  useInterval(load, 5000);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 md:py-12">
      <header className="mb-10 flex flex-col items-center gap-2.5 text-center">
        <Logo size="lg" />
        <p className="text-base text-slate-400 md:text-lg">우리 반 실시간 퀴즈 대회 — 학급을 선택해 입장하세요</p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
          서버에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        {(classes ?? PLACEHOLDER).map((c, i) => {
          const full = c.participantCount >= c.capacity;
          return (
            <motion.div key={c.classId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Link
                to={`/${c.classId}`}
                className={`glass group flex h-full flex-col gap-3 p-5 transition hover:border-blue-400/50 hover:bg-ink-800 ${!c.joinable && classes ? 'opacity-85' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-2xl text-white md:text-3xl">{c.className.replace('2학년 ', '')}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-xs text-slate-400">{c.className}</div>
                <div className="mt-auto space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Wifi className="h-3.5 w-3.5" /> 접속
                    </span>
                    <b className="text-slate-100">{c.connectedCount}명</b>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Users className="h-3.5 w-3.5" /> 참가
                    </span>
                    <b className={full ? 'text-rose-300' : 'text-slate-100'}>
                      {c.participantCount}/{c.capacity}
                    </b>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${(c.participantCount / c.capacity) * 100}%` }} />
                  </div>
                </div>
                <div
                  className={`rounded-lg py-1.5 text-center text-sm font-semibold transition ${
                    c.joinable ? 'bg-blue-600 text-white group-hover:bg-blue-500' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {!classes ? (
                    '불러오는 중…'
                  ) : c.joinable ? (
                    '입장하기 →'
                  ) : full ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" /> 정원 마감
                    </span>
                  ) : c.status === 'FINISHED' ? (
                    '퀴즈 종료 (결과 보기)'
                  ) : (
                    '입장 불가'
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <footer className="mt-12 flex justify-center">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <Shield className="h-4 w-4" /> 선생님(관리자) 로그인
        </Link>
      </footer>
    </div>
  );
}
