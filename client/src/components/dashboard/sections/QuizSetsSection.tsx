import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, errorMessage } from '../../../services/api';
import type { Question, QuizSet } from '../../../types';
import { QUESTION_TYPE_LABEL } from '../../../utils/format';
import { ConfirmDialog, Modal } from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { SectionTitle } from '../CompetitionSelect';

export function QuizSetsSection() {
  const toast = useToast();
  const { data, reload } = useApi<{ quizSets: QuizSet[] }>('/quiz-sets');
  const [editing, setEditing] = useState<Partial<QuizSet> | null>(null);
  const [del, setDel] = useState<QuizSet | null>(null);
  if (!data) return <Spinner />;
  return (
    <div>
      <SectionTitle title="문제 세트 관리" desc="문제를 묶어 세트를 만들고 출제 순서를 정합니다. 퀴즈 시작 시점의 문제가 스냅샷으로 저장됩니다.">
        <button className="btn-primary" onClick={() => setEditing({ title: '', description: '', category: '', questions: [] })}>
          <Plus className="h-4 w-4" /> 새 세트
        </button>
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.quizSets.map((s) => (
          <div key={s.id} className="glass min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-xl text-slate-900 break-words">{s.title}</div>
                <div className="text-sm font-medium text-slate-500">
                  {s.questionCount}문항 {s.category && `· ${s.category}`}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-ghost btn-sm" onClick={() => setEditing(s)} aria-label={`${s.title} 수정`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="btn-ghost btn-sm text-rose-600 hover:border-rose-200 hover:bg-rose-50" onClick={() => setDel(s)} aria-label={`${s.title} 삭제`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {s.description && <p className="mt-2 text-sm text-slate-600 break-words">{s.description}</p>}
            <ol className="mt-3 space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-700">
              {s.questions.slice(0, 6).map((q, idx) => (
                <li key={q.id} className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-xs font-extrabold text-brand-600">{idx + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{q.questionText}</span>
                </li>
              ))}
              {s.questions.length > 6 && <li className="pt-0.5 text-xs font-semibold text-slate-500">… 외 {s.questions.length - 6}문항</li>}
            </ol>
          </div>
        ))}
      </div>
      {editing && (
        <QuizSetForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!del}
        danger
        title="문제 세트 삭제"
        message={`'${del?.title}' 세트를 삭제할까요? 문제 자체는 삭제되지 않습니다.`}
        confirmText="삭제"
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await api.delete(`/quiz-sets/${del!.id}`);
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

function QuizSetForm({ initial, onClose, onSaved }: { initial: Partial<QuizSet>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const all = useApi<{ questions: Question[] }>('/questions');
  const [title, setTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [ids, setIds] = useState<number[]>((initial.questions ?? []).map((q) => q.id));
  const [busy, setBusy] = useState(false);
  const byId = new Map((all.data?.questions ?? []).map((q) => [q.id, q]));
  const move = (i: number, d: number) => {
    const n = [...ids];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setIds(n);
  };
  const save = async () => {
    setBusy(true);
    try {
      const body = { title, description: description || null, category: category || null, questionIds: ids };
      if (initial.id) await api.put(`/quiz-sets/${initial.id}`, body);
      else await api.post('/quiz-sets', body);
      toast('저장했습니다.', 'success');
      onSaved();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={initial.id ? '문제 세트 수정' : '새 문제 세트'} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">제목</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className="label">분류</label>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={50} />
          </div>
        </div>
        <div>
          <label className="label">설명</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <div className="label">출제 순서 ({ids.length}문항)</div>
            <ol className="max-h-80 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
              {ids.map((id, i) => (
                <li key={id} className="flex min-w-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-2xs">
                  <span className="w-6 shrink-0 font-bold text-brand-600">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{byId.get(id)?.questionText ?? `#${id}`}</span>
                  <button disabled={i === 0} onClick={() => move(i, -1)} className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-25" aria-label="위로">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button disabled={i === ids.length - 1} onClick={() => move(i, 1)} className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-25" aria-label="아래로">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => setIds(ids.filter((x) => x !== id))} className="shrink-0 rounded p-1 text-rose-500 hover:bg-rose-50" aria-label="제거">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0">
            <div className="label">문제 은행 (클릭하여 추가)</div>
            <ul className="max-h-80 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
              {all.data?.questions
                .filter((q) => !ids.includes(q.id))
                .map((q) => (
                  <li key={q.id} className="min-w-0">
                    <button
                      type="button"
                      className="block w-full truncate rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-slate-800 transition hover:border-brand-300 hover:bg-brand-50/60"
                      onClick={() => setIds([...ids, q.id])}
                    >
                      + <span className="font-bold text-brand-600">[{QUESTION_TYPE_LABEL[q.questionType] ?? q.questionType}]</span>{' '}
                      {q.category && <span className="text-slate-500">[{q.category}] </span>}
                      {q.questionText}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" disabled={busy || !title.trim()} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </Modal>
  );
}
