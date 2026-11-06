import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Monitor, PlayCircle, Users, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { openProjector } from '../../../utils/projector';
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
    { label: '전체 접속', value: `${t.connected}/${t.capacity}`, icon: Wifi, color: 'border-slate-200 bg-slate-50 text-slate-700' },
    { label: '참가 학생', value: `${t.participants}명`, icon: Users, color: 'border-slate-200 bg-slate-50 text-slate-700' },
    { label: '미접속', value: `${Math.max(0, t.participants - t.connected)}명`, icon: Activity, color: 'border-slate-200 bg-slate-50 text-slate-700' },
    { label: '진행 중인 학급', value: `${t.playing}/${t.classes}`, icon: PlayCircle, color: 'border-slate-200 bg-slate-50 text-slate-700' },
  ];
  return (
    <div>
      <SectionTitle title="대시보드" desc="12개 학급의 접속·진행 현황을 실시간으로 확인하고 학급별로 독립 제어합니다." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass flex items-center gap-3 p-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-500">{s.label}</div>
              <div className="font-display text-2xl text-slate-900">{s.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {overview.classes.map((c, i) => (
          <motion.div key={c.classId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="glass flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-2xl text-slate-900">{c.className}</div>
                <div className="truncate text-xs font-medium text-slate-500">{c.competitionTitle ?? '세션 없음'} · {c.quizSetTitle ?? '-'}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="접속" value={`${c.connectedCount}/${c.capacity}`} />
              <Stat label="참가" value={c.participantCount} />
              <Stat label="완료" value={c.completedCount} />
              <Stat label="평균" value={num(c.averageScore)} />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${(c.connectedCount / c.capacity) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>
                {c.questionIndex >= 0 ? `문제 ${c.questionIndex + 1}/${c.totalQuestions}` : `${c.totalQuestions}문항`}
                {(c.status === 'PLAYING' || c.status === 'PAUSED') && ` · 제출 ${c.answeredCount}/${c.participantCount}`}
              </span>
              <span>미접속 {c.disconnectedCount}</span>
            </div>
            <ClassControls classId={c.classId} status={c.status} questionIndex={c.questionIndex} totalQuestions={c.totalQuestions} compact />
            <div className="flex gap-3 border-t border-slate-100 pt-2 text-xs font-bold">
              <Link to={`/admin/dashboard/control?class=${c.classId}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                <CheckCircle2 className="h-3.5 w-3.5" /> 상세 진행
              </Link>
              <button type="button" onClick={() => openProjector(c.classId)} className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                <Monitor className="h-3.5 w-3.5" /> 프로젝터 열기
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 py-1.5">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="font-bold text-slate-900">{value}</div>
    </div>
  );
}
