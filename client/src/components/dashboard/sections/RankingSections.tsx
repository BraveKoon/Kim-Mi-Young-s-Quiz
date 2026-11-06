import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CLASS_IDS, classDisplayName, type LeaderboardEntry } from '@shared/types/index';
import { useApi } from '../../../hooks/useApi';
import type { ClassRankRow } from '../../../types';
import { num, pct } from '../../../utils/format';
import { Spinner } from '../../common/Spinner';
import { StatusBadge } from '../../common/StatusBadge';
import { Leaderboard } from '../../leaderboard/Leaderboard';
import { CompetitionSelect, SectionTitle } from '../CompetitionSelect';

function FairnessNote({ warning }: { warning: string | null | undefined }) {
  if (!warning) return null;
  return <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50/80 p-3 text-sm font-semibold text-amber-950">⚠️ {warning}</div>;
}

export function IndividualRankingSection() {
  const [cid, setCid] = useState<number | null>(null);
  const [classId, setClassId] = useState<string>('');
  const url = cid ? (classId ? `/leaderboard?scope=class&classId=${classId}` : `/leaderboard?scope=school&competitionId=${cid}`) : null;
  const { data } = useApi<{ leaderboard: LeaderboardEntry[]; fairnessWarning?: string | null; status?: string }>(url);
  return (
    <div>
      <SectionTitle title="개인 순위" desc="대회 전체(전교) 개인 순위 또는 학급의 현재 세션 순위를 확인합니다.">
        <CompetitionSelect value={cid} onChange={setCid} />
        <select className="input w-44 font-semibold" aria-label="학급 선택" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="" className="bg-white text-slate-900">
            전체(대회 기준)
          </option>
          {CLASS_IDS.map((id) => (
            <option key={id} value={id} className="bg-white text-slate-900">
              {classDisplayName(id)} (현재 세션)
            </option>
          ))}
        </select>
        {cid && (
          <Link to={`/results/${cid}`} className="btn-ghost">
            <ExternalLink className="h-4 w-4 text-brand-600" /> 결과 페이지
          </Link>
        )}
      </SectionTitle>
      <FairnessNote warning={data?.fairnessWarning} />
      {!data ? <Spinner /> : <div className="glass p-4">{<Leaderboard entries={data.leaderboard} showClass={!classId} showLast={false} />}</div>}
    </div>
  );
}

export function ClassRankingSection() {
  const [cid, setCid] = useState<number | null>(null);
  const { data } = useApi<{ classes: ClassRankRow[]; fairnessWarning: string | null }>(cid ? `/leaderboard?scope=classes&competitionId=${cid}` : null);
  return (
    <div>
      <SectionTitle title="학급 순위" desc="대회에 참가한 학급의 평균 점수 순위입니다.">
        <CompetitionSelect value={cid} onChange={setCid} />
      </SectionTitle>
      <FairnessNote warning={data?.fairnessWarning} />
      {!data ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass min-w-0 p-4">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={data.classes.map((c) => ({ name: c.classId.replace('2-', '') + '반', avg: Math.round(c.averageScore), acc: Math.round(c.accuracy * 100) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} stroke="#94a3b8" />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    color: '#0f172a',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
                  }}
                />
                <Bar dataKey="avg" name="평균 점수" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass overflow-x-auto p-2">
            <table className="table-base">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>학급</th>
                  <th>상태</th>
                  <th>참가</th>
                  <th>평균</th>
                  <th>최고</th>
                  <th>정답률</th>
                </tr>
              </thead>
              <tbody>
                {data.classes.map((c) => (
                  <tr key={c.sessionId}>
                    <td className="font-display text-lg text-brand-600">{c.rank}</td>
                    <td className="font-bold text-slate-900">{classDisplayName(c.classId)}</td>
                    <td>
                      <StatusBadge status={c.status as never} />
                    </td>
                    <td>{c.participantCount}</td>
                    <td className="font-semibold text-emerald-700">{num(Math.round(c.averageScore))}</td>
                    <td>{num(c.maxScore)}</td>
                    <td>{pct(c.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
