import { BarChart3, ExternalLink, Flag, Monitor, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CLASS_IDS, classDisplayName } from '@shared/types/index';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, errorMessage } from '../../../services/api';
import type { Competition, QuizSet } from '../../../types';
import { COMPETITION_STATUS_LABEL, dateOnly, dateTime, num, pct } from '../../../utils/format';
import { ConfirmDialog, Modal } from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { StatusBadge } from '../../common/StatusBadge';
import { SectionTitle } from '../CompetitionSelect';

const COLORS = ['#2563EB', '#14B8A6', '#F59E0B', '#FB7185', '#6366F1', '#0EA5E9'];

export function CompetitionsSection() {
  const toast = useToast();
  const { data, reload } = useApi<{ competitions: Competition[] }>('/competitions');
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<Competition | null>(null);
  const [finish, setFinish] = useState<Competition | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [compare, setCompare] = useState(false);
  if (!data) return <Spinner />;
  return (
    <div>
      <SectionTitle title="대회 이력" desc="대회별 참가 학급·문제 세트·결과가 보존됩니다. 현재 퀴즈를 초기화해도 종료된 대회 기록은 유지됩니다.">
        <button className="btn-ghost" disabled={selected.length < 2} onClick={() => setCompare(true)}>
          <BarChart3 className="h-4 w-4 text-[#2563EB]" /> 선택 대회 비교 ({selected.length})
        </button>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> 새 대회
        </button>
      </SectionTitle>
      <div className="space-y-3">
        {data.competitions.map((c) => (
          <div key={c.id} className="glass p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-2"
                  checked={selected.includes(c.id)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, c.id].slice(-6) : selected.filter((x) => x !== c.id))}
                  aria-label="비교 선택"
                />
                <div>
                  <div className="font-display text-xl text-slate-900">
                    #{c.id} {c.title}{' '}
                    <span className="ml-1 rounded-full border border-sky-200 bg-[#F3F9FF] px-2.5 py-0.5 align-middle font-sans text-xs font-bold text-sky-900">
                      {COMPETITION_STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-slate-500">
                    생성 {dateOnly(c.createdAt)} · 시작 {dateTime(c.startedAt)} · 종료 {dateTime(c.finishedAt)}
                  </div>
                  <div className="text-sm font-medium text-slate-600">문제 세트: {c.quizSets.join(', ') || '-'}</div>
                  {c.fairnessWarning && <div className="mt-1 text-xs font-bold text-amber-800">⚠️ 학급별로 다른 문제 세트 사용 — 전교 순위 비교 주의</div>}
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                <Link to={`/results/${c.id}`} className="btn-ghost btn-sm">
                  <ExternalLink className="h-4 w-4 text-[#2563EB]" /> 결과
                </Link>
                <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/projector/competition/${c.id}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                  <Monitor className="h-4 w-4 text-teal-600" /> 발표 화면
                </a>
                {c.status !== 'FINISHED' && (
                  <button className="btn-ghost btn-sm" onClick={() => setFinish(c)}>
                    <Flag className="h-4 w-4" /> 대회 종료
                  </button>
                )}
                <button className="btn-ghost btn-sm text-rose-600 hover:border-rose-200 hover:bg-rose-50" onClick={() => setDel(c)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {c.sessions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {c.sessions.map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 rounded-xl border border-sky-100 bg-[#F3F9FF] px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {s.className.replace('2학년 ', '')} <StatusBadge status={s.status as never} /> {s.participantCount}명
                    {!s.isCurrent && <span className="text-slate-400">(이전 세션)</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {creating && (
        <CreateCompetition
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {compare && <CompareModal ids={selected} onClose={() => setCompare(false)} />}
      <ConfirmDialog
        open={!!finish}
        title="대회 종료"
        message={`'${finish?.title}' 대회를 종료할까요? 아직 진행 중인 학급도 현재 점수로 종료됩니다.`}
        confirmText="종료"
        onClose={() => setFinish(null)}
        onConfirm={async () => {
          try {
            await api.post(`/competitions/${finish!.id}/finish`);
            toast('대회를 종료했습니다.', 'success');
            reload();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
      <ConfirmDialog
        open={!!del}
        danger
        title="대회 삭제"
        requireTyping={del?.title}
        confirmText="영구 삭제"
        message="대회와 모든 학급 세션, 참가자, 답안 기록이 영구 삭제됩니다. 되돌릴 수 없습니다. 삭제 전 결과를 내보내 두는 것을 권장합니다."
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await api.delete(`/competitions/${del!.id}`, { params: { confirm: del!.title } });
            toast('삭제했습니다.', 'success');
            reload();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </div>
  );
}

function CreateCompetition({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const sets = useApi<{ quizSets: QuizSet[] }>('/quiz-sets');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizSetId, setQuizSetId] = useState<number | ''>('');
  const [classIds, setClassIds] = useState<string[]>([...CLASS_IDS]);
  const submit = async () => {
    try {
      const r = await api.post('/competitions', { title, description: description || null, quizSetId: quizSetId || undefined, classIds: quizSetId ? classIds : [] });
      for (const e of r.data.errors) toast(`${e.classId}: ${e.message}`, 'error');
      toast('대회를 만들었습니다.', 'success');
      onDone();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title="새 대회" wide>
      <div className="space-y-4">
        <div>
          <label className="label">대회명</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="예) 11월 2학년 상식 왕 대회" />
        </div>
        <div>
          <label className="label">설명</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>
        <div>
          <label className="label">문제 세트 (모든 참가 학급 공통)</label>
          <select className="input" value={quizSetId} onChange={(e) => setQuizSetId(e.target.value ? Number(e.target.value) : '')}>
            <option value="" className="bg-white text-slate-900">나중에 학급 관리에서 배정</option>
            {sets.data?.quizSets.map((s) => (
              <option key={s.id} value={s.id} className="bg-white text-slate-900">
                {s.title} ({s.questionCount}문항)
              </option>
            ))}
          </select>
        </div>
        {quizSetId && (
          <div>
            <label className="label">참가 학급 (선택한 학급에 새 대기 세션이 생성됩니다)</label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {CLASS_IDS.map((id) => (
                <label
                  key={id}
                  className={`cursor-pointer rounded-xl border px-2 py-2 text-center text-sm font-bold transition ${
                    classIds.includes(id)
                      ? 'border-[#2563EB] bg-blue-50 text-[#1D4ED8]'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                  }`}
                >
                  <input type="checkbox" className="hidden" checked={classIds.includes(id)} onChange={(e) => setClassIds(e.target.checked ? [...classIds, id] : classIds.filter((x) => x !== id))} />
                  {id.replace('2-', '')}반
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" disabled={!title.trim()} onClick={submit}>
            만들기
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface CompareData {
  competitions: { id: number; title: string; averageScore: number; participants: number; participationRate: number; classes: Record<string, { averageScore: number; participants: number; accuracy: number }> }[];
  individuals: { classId: string; nickname: string; scores: (number | null)[]; ranks: (number | null)[] }[];
  note: string;
}

function CompareModal({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const { data, error } = useApi<CompareData>(`/competitions/compare?ids=${ids.join(',')}`);
  return (
    <Modal open onClose={onClose} title="대회 간 성적 비교" wide>
      {error && <p className="font-semibold text-rose-600">{error}</p>}
      {!data ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <table className="table-base">
            <thead>
              <tr>
                <th>대회</th>
                <th>평균 점수</th>
                <th>참가 인원</th>
                <th>참가율</th>
              </tr>
            </thead>
            <tbody>
              {data.competitions.map((c) => (
                <tr key={c.id}>
                  <td className="font-bold text-slate-900">{c.title}</td>
                  <td className="font-semibold text-teal-700">{num(c.averageScore)}</td>
                  <td>{c.participants}명</td>
                  <td>{pct(c.participationRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <h4 className="mb-2 font-bold text-slate-900">학급별 평균 점수 변화</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={CLASS_IDS.map((cid) => ({ name: cid.replace('2-', '') + '반', ...Object.fromEntries(data.competitions.map((c) => [c.title, c.classes[cid]?.averageScore ?? 0])) }))}>
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
                <Legend />
                {data.competitions.map((c, i) => (
                  <Bar key={c.id} dataKey={c.title} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="mb-1 font-bold text-slate-900">개인별 성적 변화</h4>
            <p className="mb-2 text-xs font-medium text-slate-500">{data.note}</p>
            <div className="max-h-64 overflow-y-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>학급</th>
                    <th>닉네임</th>
                    {data.competitions.map((c) => (
                      <th key={c.id}>{c.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.individuals.map((p) => (
                    <tr key={p.classId + p.nickname}>
                      <td>{classDisplayName(p.classId)}</td>
                      <td className="font-semibold text-slate-900">{p.nickname}</td>
                      {p.scores.map((s, i) => (
                        <td key={i}>{s === null ? '-' : `${num(s)} (${p.ranks[i]}위)`}</td>
                      ))}
                    </tr>
                  ))}
                  {!data.individuals.length && (
                    <tr>
                      <td colSpan={2 + data.competitions.length} className="py-4 text-center text-slate-500">
                        두 대회 이상에 참가한 학생이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
