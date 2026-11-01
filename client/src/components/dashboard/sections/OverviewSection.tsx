import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Monitor, PlayCircle, Users, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { num } from '../../../utils/format';
import { Spinner } from '../../common/Spinner';
import { StatusBadge } from '../../common/StatusBadge';
import { ClassControls } from '../ClassControls';
import { SectionTitle } from '../CompetitionSelect';

export function OverviewSection() {
  const { overview } = useAdminSocket();
  if (!overview) return <Spinner label="실시간 현황을 불러오는 중…" />;
  const t = overview.totals;
  const stats = [
    { label: '전체 접속', value: `${t.connected}/${t.capacity}`, icon: Wifi, color: 'text-emerald-400' },
    { label: '참가 학생', value: `${t.participants}명`, icon: Users, color: 'text-sky-400' },
    { label: '미접속', value: `${Math.max(0, t.participants - t.connected)}명`, icon: Activity, color: 'text-amber-400' },
    { label: '진행 중인 학급', value: `${t.playing}/${t.classes}`, icon: PlayCircle, color: 'text-blue-400' },
  ];
  return (
    <div>
      <SectionTitle title="대시보드" desc="12개 학급의 접속·진행 현황을 실시간으로 확인하고 학급별로 독립 제어합니다." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass flex items-center gap-3 p-4">
            <s.icon className={`h-8 w-8 ${s.color}`} />
            <div>
              <div className="text-xs text-white/60">{s.label}</div>
              <div className="font-display text-2xl">{s.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {overview.classes.map((c, i) => (
          <motion.div key={c.classId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="glass flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-2xl">{c.className}</div>
                <div className="truncate text-xs text-white/50">{c.competitionTitle ?? '세션 없음'} · {c.quizSetTitle ?? '-'}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="접속" value={`${c.connectedCount}/${c.capacity}`} />
              <Stat label="참가" value={c.participantCount} />
              <Stat label="완료" value={c.completedCount} />
              <Stat label="평균" value={num(c.averageScore)} />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-blue-500" style={{ width: `${(c.connectedCount / c.capacity) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>
                {c.questionIndex >= 0 ? `문제 ${c.questionIndex + 1}/${c.totalQuestions}` : `${c.totalQuestions}문항`}
                {(c.status === 'PLAYING' || c.status === 'PAUSED') && ` · 제출 ${c.answeredCount}/${c.participantCount}`}
              </span>
              <span>미접속 {c.disconnectedCount}</span>
            </div>
            <ClassControls classId={c.classId} status={c.status} questionIndex={c.questionIndex} totalQuestions={c.totalQuestions} compact />
            <div className="flex gap-2 text-xs">
              <Link to={`/admin/dashboard/control?class=${c.classId}`} className="inline-flex items-center gap-1 text-cyan-200 hover:underline">
                <CheckCircle2 className="h-3.5 w-3.5" /> 상세 진행
              </Link>
              <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/projector/${c.classId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200 hover:underline">
                <Monitor className="h-3.5 w-3.5" /> 프로젝터 열기
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 py-1.5">
      <div className="text-white/50">{label}</div>
      <div className="font-bold text-white">{value}</div>
    </div>
  );
}
