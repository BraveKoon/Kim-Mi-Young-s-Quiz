import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { classDisplayName } from '@shared/types/index';
import { useApi } from '../../../hooks/useApi';
import type { QuestionStat } from '../../../types';
import { num, pct, seconds } from '../../../utils/format';
import { Modal } from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { DistributionChart } from '../../charts/DistributionChart';
import { RateChart } from '../../charts/RateChart';
import { CompetitionSelect, SectionTitle } from '../CompetitionSelect';

interface Analytics {
  totals: { classes: number; participants: number; averageScore: number; participationRate: number };
  questions: QuestionStat[];
  hardest: { questionId: number; text: string; correctRateAll: number } | null;
  easiest: { questionId: number; text: string; correctRateAll: number } | null;
  classRanking: { fairnessWarning: string | null };
}

export function AnalyticsSection() {
  const [cid, setCid] = useState<number | null>(null);
  const { data } = useApi<Analytics>(cid ? `/analytics/competition/${cid}` : null);
  const [detail, setDetail] = useState<QuestionStat | null>(null);
  return (
    <div>
      <SectionTitle title="문항별 통계" desc="응답자 기준과 전체 참가자 기준(미응답 포함) 정답률을 구분해 보여줍니다. 막대나 표를 클릭하면 상세 분석을 볼 수 있습니다.">
        <CompetitionSelect value={cid} onChange={setCid} />
      </SectionTitle>
      {!data ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {data.classRanking.fairnessWarning && <div className="rounded-2xl bg-amber-400/15 p-3 text-sm text-amber-100">⚠️ {data.classRanking.fairnessWarning}</div>}
          <div className="grid gap-3 md:grid-cols-4">
            <Card label="참가 학급" value={`${data.totals.classes}개`} />
            <Card label="참가 학생" value={`${data.totals.participants}명`} />
            <Card label="평균 점수" value={num(data.totals.averageScore)} />
            <Card label="참가율(정원 대비)" value={pct(data.totals.participationRate)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="glass flex items-center gap-3 p-4">
              <ThumbsDown className="h-8 w-8 shrink-0 text-rose-300" />
              <div className="min-w-0">
                <div className="text-xs text-white/60">가장 어려웠던 문제</div>
                <div className="truncate font-bold">{data.hardest?.text ?? '-'}</div>
                <div className="text-sm text-rose-200">정답률 {data.hardest ? pct(data.hardest.correctRateAll) : '-'}</div>
              </div>
            </div>
            <div className="glass flex items-center gap-3 p-4">
              <ThumbsUp className="h-8 w-8 shrink-0 text-lime-300" />
              <div className="min-w-0">
                <div className="text-xs text-white/60">가장 쉬웠던 문제</div>
                <div className="truncate font-bold">{data.easiest?.text ?? '-'}</div>
                <div className="text-sm text-lime-200">정답률 {data.easiest ? pct(data.easiest.correctRateAll) : '-'}</div>
              </div>
            </div>
          </div>
          {data.questions.length ? (
            <>
              <div className="glass p-4">
                <RateChart data={data.questions.map((q) => ({ id: q.questionId, label: `Q${q.order}`, answered: q.correctRateAnswered, all: q.correctRateAll }))} onSelect={(id) => setDetail(data.questions.find((q) => q.questionId === id) ?? null)} />
              </div>
              <div className="glass overflow-x-auto p-2">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>문제</th>
                      <th>응답/참가</th>
                      <th>정답률(응답자)</th>
                      <th>정답률(전체)</th>
                      <th>평균 응답시간</th>
                      <th>평균 점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.questions.map((q) => (
                      <tr key={q.questionId} className="cursor-pointer hover:bg-white/5" onClick={() => setDetail(q)}>
                        <td>{q.order}</td>
                        <td className="max-w-md truncate font-bold">
                          {q.isDoublePoints && '⚡ '}
                          {q.text}
                        </td>
                        <td>
                          {q.answeredCount}/{q.participantCount}
                        </td>
                        <td>{pct(q.correctRateAnswered)}</td>
                        <td>{pct(q.correctRateAll)}</td>
                        <td>{seconds(q.averageElapsedMs)}</td>
                        <td>{num(q.averageScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="glass p-8 text-center text-white/50">아직 진행된 문제가 없습니다.</p>
          )}
        </div>
      )}
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`Q${detail.order} 상세 분석`} wide>
          <div className="space-y-4">
            <p className="text-lg font-bold">{detail.text}</p>
            <DistributionChart options={detail.options} distribution={detail.distribution} correctIndex={detail.correctIndex} />
            <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4">
              <Card label="응답자" value={`${detail.answeredCount}명`} />
              <Card label="미응답" value={`${detail.noAnswerCount}명`} />
              <Card label="정답률(응답자/전체)" value={`${pct(detail.correctRateAnswered)} / ${pct(detail.correctRateAll)}`} />
              <Card label="평균 시간 · 점수" value={`${seconds(detail.averageElapsedMs)} · ${num(detail.averageScore)}`} />
            </div>
            <div>
              <h4 className="mb-2 font-bold">오답 선택 인원</h4>
              <ul className="space-y-1 text-sm">
                {detail.options.map((o, i) =>
                  i === detail.correctIndex ? null : (
                    <li key={i} className="flex justify-between rounded-lg bg-white/5 px-3 py-1">
                      <span>{o}</span>
                      <b>{detail.distribution[i]}명</b>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-bold">학급별 정답률 (전체 참가자 기준)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={detail.byClass.map((c) => ({ name: classDisplayName(c.classId).replace('2학년 ', ''), rate: Math.round(c.correctRateAll * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                  <Tooltip contentStyle={{ background: '#1e1048', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12 }} formatter={(v) => `${v}%`} />
                  <Bar dataKey="rate" name="정답률" fill="#22e3ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="font-display text-xl">{value}</div>
    </div>
  );
}
