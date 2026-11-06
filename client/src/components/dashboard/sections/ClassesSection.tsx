import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CLASS_IDS, classDisplayName } from '@shared/types/index';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, errorMessage } from '../../../services/api';
import type { Competition, QuizSet } from '../../../types';
import { Modal } from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { StatusBadge } from '../../common/StatusBadge';
import { ClassControls } from '../ClassControls';
import { SectionTitle } from '../CompetitionSelect';

export function ClassesSection() {
  const { overview } = useAdminSocket();
  const [open, setOpen] = useState<string[] | null>(null);
  if (!overview) return <Spinner />;
  return (
    <div>
      <SectionTitle title="학급 관리" desc="학급별 현재 세션(대회·문제 세트)을 확인하고 새 세션을 배정합니다. 진행 중인 학급은 종료 후 배정할 수 있습니다.">
        <button className="btn-primary" onClick={() => setOpen([])}>
          <Plus className="h-4 w-4" /> 세션 배정
        </button>
      </SectionTitle>
      <div className="glass overflow-x-auto p-2">
        <table className="table-base">
          <thead>
            <tr>
              <th>학급</th>
              <th>상태</th>
              <th>대회</th>
              <th>문제 세트</th>
              <th>참가/정원</th>
              <th>접속</th>
              <th>제어</th>
            </tr>
          </thead>
          <tbody>
            {overview.classes.map((c) => (
              <tr key={c.classId}>
                <td className="font-bold text-slate-900">{c.className}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>{c.competitionTitle ?? '-'}</td>
                <td>{c.quizSetTitle ?? '-'}</td>
                <td>
                  {c.participantCount}/{c.capacity}
                </td>
                <td>{c.connectedCount}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <ClassControls classId={c.classId} status={c.status} questionIndex={c.questionIndex} totalQuestions={c.totalQuestions} compact />
                    <button className="btn-ghost btn-sm" onClick={() => setOpen([c.classId])} disabled={['PLAYING', 'PAUSED', 'RESULT'].includes(c.status)}>
                      새 세션
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <AssignSessionModal initial={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AssignSessionModal({ initial, onClose }: { initial: string[]; onClose: () => void }) {
  const toast = useToast();
  const comps = useApi<{ competitions: Competition[] }>('/competitions');
  const sets = useApi<{ quizSets: QuizSet[] }>('/quiz-sets');
  const [competitionId, setCompetitionId] = useState<number | 'new'>('new');
  const [newTitle, setNewTitle] = useState('');
  const [quizSetId, setQuizSetId] = useState<number | null>(null);
  const [classIds, setClassIds] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!quizSetId) return toast('문제 세트를 선택하세요.', 'error');
    if (!classIds.length) return toast('학급을 선택하세요.', 'error');
    setBusy(true);
    try {
      if (competitionId === 'new') {
        if (!newTitle.trim()) return toast('대회명을 입력하세요.', 'error');
        const r = await api.post('/competitions', { title: newTitle.trim(), quizSetId, classIds });
        if (r.data.errors.length) r.data.errors.forEach((e: { classId: string; message: string }) => toast(`${e.classId}: ${e.message}`, 'error'));
      } else {
        for (const classId of classIds) {
          try {
            await api.post(`/classes/${classId}/session`, { competitionId, quizSetId });
          } catch (e) {
            toast(`${classId}: ${errorMessage(e)}`, 'error');
          }
        }
      }
      toast('세션을 배정했습니다. 해당 학급 학생들은 새로 입장해야 합니다.', 'success');
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="학급 세션 배정" wide>
      <div className="space-y-4">
        <div>
          <label className="label">대회</label>
          <select className="input" value={competitionId} onChange={(e) => setCompetitionId(e.target.value === 'new' ? 'new' : Number(e.target.value))}>
            <option value="new" className="bg-white text-slate-900">+ 새 대회 만들기</option>
            {comps.data?.competitions.map((c) => (
              <option key={c.id} value={c.id} className="bg-white text-slate-900">
                #{c.id} {c.title}
              </option>
            ))}
          </select>
          {competitionId === 'new' && <input className="input mt-2" aria-label="새 대회 이름" placeholder="대회명 (예: 11월 상식 퀴즈 대회)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={100} />}
        </div>
        <div>
          <label className="label">문제 세트</label>
          <select className="input" value={quizSetId ?? ''} onChange={(e) => setQuizSetId(Number(e.target.value))}>
            <option value="" className="bg-white text-slate-900">선택하세요</option>
            {sets.data?.quizSets.map((s) => (
              <option key={s.id} value={s.id} className="bg-white text-slate-900" disabled={!s.questionCount}>
                {s.title} ({s.questionCount}문항)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">전교 순위를 공정하게 비교하려면 같은 대회의 모든 학급에 같은 문제 세트를 사용하세요.</p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label">학급</label>
            <button type="button" className="text-xs font-bold text-brand-600 hover:underline" onClick={() => setClassIds(classIds.length === 12 ? [] : [...CLASS_IDS])}>
              {classIds.length === 12 ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {CLASS_IDS.map((id) => (
              <label
                key={id}
                className={`cursor-pointer rounded-xl border px-2 py-2 text-center text-sm font-bold transition ${
                  classIds.includes(id)
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                }`}
              >
                <input type="checkbox" className="hidden" checked={classIds.includes(id)} onChange={(e) => setClassIds(e.target.checked ? [...classIds, id] : classIds.filter((x) => x !== id))} />
                {classDisplayName(id).replace('2학년 ', '')}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" disabled={busy} onClick={submit}>
            배정
          </button>
        </div>
      </div>
    </Modal>
  );
}
