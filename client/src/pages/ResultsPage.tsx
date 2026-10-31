import { ArrowLeft, Monitor, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { classDisplayName, type LeaderboardEntry } from '@shared/types/index';
import { Logo } from '../components/common/Logo';
import { StatusBadge } from '../components/common/StatusBadge';
import { FullScreenSpinner } from '../components/common/Spinner';
import { Leaderboard } from '../components/leaderboard/Leaderboard';
import { Podium } from '../components/leaderboard/Podium';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { api, studentApi } from '../services/api';
import { COMPETITION_STATUS_LABEL, dateTime, num, pct } from '../utils/format';
import type { ClassRankRow } from '../types';
import NotFoundPage from './NotFoundPage';

/** 대회 결과 조회. 관리자는 전체 정보, 그 외에는 설정된 이름 공개 방식이 적용된 공개 결과를 본다. */
export default function ResultsPage() {
  const { competitionId = '' } = useParams();
  const id = Number(competitionId);
  const { admin } = useAdminAuth();
  const [data, setData] = useState<{
    title: string;
    status: string;
    startedAt: number | null;
    finishedAt: number | null;
    individuals: LeaderboardEntry[];
    classes: (Pick<ClassRankRow, 'rank' | 'classId' | 'averageScore' | 'participantCount' | 'status'> & { accuracy?: number })[];
    fairnessWarning: string | null;
  } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return setNotFound(true);
    const load = async () => {
      try {
        if (admin && !admin.mustChangePassword) {
          const r = await api.get(`/competitions/${id}`);
          const c = r.data;
          setData({
            title: c.competition.title,
            status: c.competition.status,
            startedAt: c.competition.startedAt,
            finishedAt: c.competition.finishedAt,
            individuals: c.individualRanking,
            classes: c.classRanking.classes,
            fairnessWarning: c.classRanking.fairnessWarning,
          });
        } else {
          const r = await studentApi.get(`/public/competitions/${id}/results`);
          const c = r.data;
          setData({
            title: c.competition.title,
            status: c.competition.status,
            startedAt: c.competition.startedAt,
            finishedAt: c.competition.finishedAt,
            individuals: c.top.map((t: any, i: number) => ({ ...t, participantId: i, prevRank: null, correctCount: 0, lastAwarded: 0, lastCorrect: null })),
            classes: c.classRanking,
            fairnessWarning: c.fairnessWarning,
          });
        }
      } catch {
        setNotFound(true);
      }
    };
    load();
  }, [id, admin]);

  if (notFound) return <NotFoundPage />;
  if (!data) return <FullScreenSpinner />;
  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Logo size="sm" />
        <div className="flex gap-2">
          {admin && (
            <Link to="/admin/dashboard/competitions" className="btn-ghost btn-sm">
              <ArrowLeft className="h-4 w-4" /> 대시보드
            </Link>
          )}
          <Link to={`/projector/competition/${id}`} className="btn-ghost btn-sm">
            <Monitor className="h-4 w-4" /> 발표 화면
          </Link>
        </div>
      </header>
      <div className="text-center">
        <h1 className="font-display text-4xl md:text-5xl">{data.title}</h1>
        <p className="mt-2 text-white/60">
          {COMPETITION_STATUS_LABEL[data.status]} · 시작 {dateTime(data.startedAt)} · 종료 {dateTime(data.finishedAt)}
        </p>
      </div>
      {data.fairnessWarning && <div className="rounded-2xl bg-amber-400/15 p-3 text-center text-amber-100">⚠️ {data.fairnessWarning}</div>}
      <section className="glass-strong p-6">
        <h2 className="mb-6 flex items-center gap-2 font-display text-2xl">
          <Trophy className="h-6 w-6 text-neon-yellow" /> 전체 개인 시상대
        </h2>
        <Podium entries={data.individuals} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass p-5">
          <h2 className="mb-3 font-display text-2xl">학급 순위 (평균 점수)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.classes.map((c) => ({ name: classDisplayName(c.classId).replace('2학년 ', ''), avg: Math.round(c.averageScore) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.7)' }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip contentStyle={{ background: '#1e1048', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12 }} formatter={(v) => [`${v}점`, '평균']} />
              <Bar dataKey="avg" fill="#a855f7" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="table-base mt-3">
            <thead>
              <tr>
                <th>순위</th>
                <th>학급</th>
                <th>참가</th>
                <th>평균</th>
                {admin && <th>정답률</th>}
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((c) => (
                <tr key={c.classId}>
                  <td className="font-bold">{c.rank}</td>
                  <td>{classDisplayName(c.classId)}</td>
                  <td>{c.participantCount}명</td>
                  <td>{num(Math.round(c.averageScore))}</td>
                  {admin && <td>{c.accuracy !== undefined ? pct(c.accuracy) : '-'}</td>}
                  <td>
                    <StatusBadge status={c.status as never} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="glass p-5">
          <h2 className="mb-3 font-display text-2xl">개인 순위 {admin ? '(전체)' : '(상위 10명)'}</h2>
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <Leaderboard entries={data.individuals} showClass showLast={false} />
          </div>
        </section>
      </div>
    </div>
  );
}
