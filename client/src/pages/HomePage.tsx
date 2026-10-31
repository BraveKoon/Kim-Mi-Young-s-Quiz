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

const GRADIENTS = [
  'from-fuchsia-500/40 to-violet-600/30',
  'from-cyan-400/40 to-blue-600/30',
  'from-amber-400/40 to-rose-500/30',
  'from-lime-400/40 to-emerald-600/30',
];

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
      <header className="mb-10 flex flex-col items-center gap-3 text-center">
        <Logo size="lg" />
        <p className="text-lg text-white/70 md:text-xl">우리 반 실시간 퀴즈 대회 — 학급을 선택해 입장하세요!</p>
      </header>

      {error && <div className="glass mb-6 border-rose-400/40 p-4 text-center text-rose-200">서버에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.</div>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(classes ?? PLACEHOLDER).map((c, i) => {
          const full = c.participantCount >= c.capacity;
          return (
            <motion.div key={c.classId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -6, scale: 1.02 }}>
              <Link
                to={`/${c.classId}`}
                className={`glass group relative flex h-full flex-col gap-3 overflow-hidden bg-gradient-to-br p-5 ${GRADIENTS[i % 4]} ${!c.joinable && classes ? 'opacity-80' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-3xl md:text-4xl">{c.className.replace('2학년 ', '')}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-sm text-white/60">{c.className}</div>
                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-white/70">
                      <Wifi className="h-4 w-4" /> 접속
                    </span>
                    <b>{c.connectedCount}명</b>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-white/70">
                      <Users className="h-4 w-4" /> 참가
                    </span>
                    <b className={full ? 'text-rose-300' : ''}>
                      {c.participantCount}/{c.capacity}
                    </b>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" style={{ width: `${(c.participantCount / c.capacity) * 100}%` }} />
                  </div>
                </div>
                <div className={`rounded-xl py-1.5 text-center text-sm font-bold ${c.joinable ? 'bg-white/15 group-hover:bg-white/25' : 'bg-black/20 text-white/50'}`}>
                  {!classes ? '불러오는 중…' : c.joinable ? '입장하기 →' : full ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-4 w-4" /> 정원 마감
                    </span>
                  ) : c.status === 'FINISHED' ? '퀴즈 종료 (결과 보기)' : '입장 불가'}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <footer className="mt-12 flex justify-center">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80">
          <Shield className="h-4 w-4" /> 선생님(관리자) 로그인
        </Link>
      </footer>
    </div>
  );
}
