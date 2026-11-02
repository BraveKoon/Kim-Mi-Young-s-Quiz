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
    { label: '전체 접속', value: `${t.connected}/${t.capacity}`, icon: Wifi, color: 'border-teal-200 bg-teal-50 text-teal-600' },
    { label: '참가 학생', value: `${t.participants}명`, icon: Users, color: 'border-blue-200 bg-blue-50 text-[#2563EB]' },
    { label: '미접속', value: `${Math.max(0, t.participants - t.connected)}명`, icon: Activity, color: 'border-amber-200 bg-amber-50 text-amber-600' },
    { label: '진행 중인 학급', value: `${t.playing}/${t.classes}`, icon: PlayCircle, color: 'border-rose-200 bg-rose-50 text-rose-500' },
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
          <motion.div key={c.classId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="glass flex min-w-0 flex-col gap-3 p-4">
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
            <div className="h-1.5 overflow-hidden rounded-full bg-sky-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6]" style={{ width: `${(c.connectedCount / c.capacity) * 100}%` }} />
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
              <Link to={`/admin/dashboard/control?class=${c.classId}`} className="inline-flex items-center gap-1 text-[#2563EB] hover:underline">
                <CheckCircle2 className="h-3.5 w-3.5" /> 상세 진행
              </Link>
              <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/projector/${c.classId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline">
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
    <div className="rounded-xl border border-sky-100 bg-[#F3F9FF] py-1.5">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="font-bold text-slate-900">{value}</div>
    </div>
  );
}
