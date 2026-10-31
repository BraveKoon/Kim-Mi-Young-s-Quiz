import { Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, errorMessage } from '../../../services/api';
import type { Question } from '../../../types';
import { OPTION_STYLES } from '../../../utils/format';
import { ConfirmDialog, Modal } from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { SectionTitle } from '../CompetitionSelect';

const EMPTY: Omit<Question, 'id'> = {
  questionType: 'MULTIPLE_CHOICE',
  questionText: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  timeLimit: 20,
  isDoublePoints: false,
  orderNum: 0,
  explanation: '',
  category: '',
};

export function QuestionsSection() {
  const toast = useToast();
  const { data, reload } = useApi<{ questions: Question[] }>('/questions');
  const [editing, setEditing] = useState<Partial<Question> | null>(null);
  const [del, setDel] = useState<Question | null>(null);
  const [filter, setFilter] = useState('');
  if (!data) return <Spinner />;
  const list = data.questions.filter((q) => !filter || q.questionText.includes(filter) || (q.category ?? '').includes(filter));
  return (
    <div>
      <SectionTitle title="문제 관리" desc="4지선다형 문제를 만들고 수정합니다. 정답과 해설은 학생에게 결과 공개 전까지 전송되지 않습니다.">
        <input className="input w-56" placeholder="검색 (문제/분류)" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY, options: [...EMPTY.options], orderNum: (data.questions.at(-1)?.orderNum ?? 0) + 1 })}>
          <Plus className="h-4 w-4" /> 새 문제
        </button>
      </SectionTitle>
      <div className="grid gap-3">
        {list.map((q) => (
          <div key={q.id} className="glass flex flex-col gap-2 p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span>#{q.id}</span>
                {q.category && <span className="rounded-full bg-white/10 px-2">{q.category}</span>}
                <span>{q.timeLimit}초</span>
                {q.isDoublePoints && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-neon-yellow px-2 font-bold text-ink-950">
                    <Zap className="h-3 w-3" /> 2배
                  </span>
                )}
              </div>
              <div className="font-bold">{q.questionText}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                {q.options.map((o, i) => (
                  <span key={i} className={`rounded-lg px-2 py-0.5 ${i === q.correctIndex ? 'bg-lime-400/25 text-lime-100 ring-1 ring-lime-300' : 'bg-white/5 text-white/70'}`}>
                    {OPTION_STYLES[i].shape} {o}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setEditing({ ...q, options: [...q.options] })}>
                <Pencil className="h-4 w-4" /> 수정
              </button>
              <button className="btn-ghost btn-sm text-rose-200" onClick={() => setDel(q)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!list.length && <p className="py-8 text-center text-white/50">문제가 없습니다.</p>}
      </div>
      {editing && (
        <QuestionForm
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
        title="문제 삭제"
        message="이 문제를 삭제할까요? 문제 세트에서도 제거됩니다. 이미 진행된 대회 기록(통계)은 그대로 보존됩니다."
        confirmText="삭제"
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await api.delete(`/questions/${del!.id}`);
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

function QuestionForm({ initial, onClose, onSaved }: { initial: Partial<Question>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Question>(k: K, v: Question[K]) => setQ((cur) => ({ ...cur, [k]: v }));
  const save = async () => {
    setBusy(true);
    const body = {
      questionType: 'MULTIPLE_CHOICE',
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      timeLimit: Number(q.timeLimit),
      isDoublePoints: !!q.isDoublePoints,
      orderNum: Number(q.orderNum ?? 0),
      explanation: q.explanation || null,
      category: q.category || null,
    };
    try {
      if (q.id) await api.put(`/questions/${q.id}`, body);
      else await api.post('/questions', body);
      toast('저장했습니다.', 'success');
      onSaved();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={q.id ? `문제 수정 #${q.id}` : '새 문제'} wide>
      <div className="space-y-4">
        <div>
          <label className="label">문제</label>
          <textarea className="input min-h-20" value={q.questionText} onChange={(e) => set('questionText', e.target.value)} maxLength={500} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options!.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className={`flex cursor-pointer items-center gap-1 rounded-xl px-2 py-2 ${OPTION_STYLES[i].bg}`} title="정답으로 지정">
                <input type="radio" name="correct" checked={q.correctIndex === i} onChange={() => set('correctIndex', i)} />
                <span>{OPTION_STYLES[i].shape}</span>
              </label>
              <input className="input" placeholder={`보기 ${i + 1}`} value={o} maxLength={120} onChange={(e) => set('options', q.options!.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </div>
        <p className="text-xs text-white/50">왼쪽 라디오 버튼으로 정답 보기를 선택합니다. 현재 정답: {OPTION_STYLES[q.correctIndex ?? 0].shape} {OPTION_STYLES[q.correctIndex ?? 0].name}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">제한시간(초)</label>
            <input type="number" min={5} max={300} className="input" value={q.timeLimit} onChange={(e) => set('timeLimit', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">분류</label>
            <input className="input" value={q.category ?? ''} onChange={(e) => set('category', e.target.value)} maxLength={50} />
          </div>
          <div>
            <label className="label">정렬 순서</label>
            <input type="number" className="input" value={q.orderNum} onChange={(e) => set('orderNum', Number(e.target.value))} />
          </div>
          <label className="mt-6 flex items-center gap-2">
            <input type="checkbox" checked={!!q.isDoublePoints} onChange={(e) => set('isDoublePoints', e.target.checked)} /> ⚡ 2배 점수
          </label>
        </div>
        <div>
          <label className="label">해설 (결과 공개 시 표시)</label>
          <textarea className="input" value={q.explanation ?? ''} onChange={(e) => set('explanation', e.target.value)} maxLength={1000} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </Modal>
  );
}
