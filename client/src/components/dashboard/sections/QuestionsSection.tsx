import { Pencil, Plus, Trash2, X, Zap } from 'lucide-react';
import { useState } from 'react';
import type { QuestionType } from '@shared/types/index';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, errorMessage } from '../../../services/api';
import type { Question } from '../../../types';
import { OPTION_STYLES, QUESTION_TYPE_LABEL } from '../../../utils/format';
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

const TYPE_BADGE: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'bg-violet-400/20 text-violet-200',
  OX: 'bg-cyan-400/20 text-cyan-200',
  SHORT_ANSWER: 'bg-amber-400/20 text-amber-200',
};

export function QuestionsSection() {
  const toast = useToast();
  const { data, reload } = useApi<{ questions: Question[] }>('/questions');
  const [editing, setEditing] = useState<Partial<Question> | null>(null);
  const [del, setDel] = useState<Question | null>(null);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  if (!data) return <Spinner />;
  const list = data.questions.filter(
    (q) =>
      (typeFilter === 'ALL' || q.questionType === typeFilter) &&
      (!filter || q.questionText.includes(filter) || (q.category ?? '').includes(filter)),
  );
  return (
    <div>
      <SectionTitle
        title="문제 관리"
        desc="4지선다형, O/X, 단답형 문제를 만들고 수정합니다. 정답과 해설은 학생에게 결과 공개 전까지 전송되지 않습니다."
      >
        <select
          className="input w-36"
          aria-label="유형 필터"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL" className="bg-ink-800">전체 유형</option>
          <option value="MULTIPLE_CHOICE" className="bg-ink-800">4지선다</option>
          <option value="OX" className="bg-ink-800">O/X</option>
          <option value="SHORT_ANSWER" className="bg-ink-800">단답형</option>
        </select>
        <input className="input w-56" placeholder="검색 (문제/분류)" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button
          className="btn-primary"
          onClick={() => setEditing({ ...EMPTY, options: [...EMPTY.options], orderNum: (data.questions.at(-1)?.orderNum ?? 0) + 1 })}
        >
          <Plus className="h-4 w-4" /> 새 문제
        </button>
      </SectionTitle>
      <div className="grid gap-3">
        {list.map((q) => (
          <div key={q.id} className="glass flex flex-col gap-2 p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span>#{q.id}</span>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${TYPE_BADGE[q.questionType] ?? 'bg-white/10 text-white/80'}`}>
                  {QUESTION_TYPE_LABEL[q.questionType] ?? q.questionType}
                </span>
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
                {q.questionType === 'SHORT_ANSWER' ? (
                  <>
                    <span className="text-xs text-white/50 self-center">인정 답안:</span>
                    {q.options.map((ans, i) => (
                      <span key={i} className="rounded-lg bg-lime-400/25 px-2 py-0.5 text-lime-100 ring-1 ring-lime-300">
                        {ans}
                      </span>
                    ))}
                  </>
                ) : (
                  q.options.map((o, i) => (
                    <span
                      key={i}
                      className={`rounded-lg px-2 py-0.5 ${i === q.correctIndex ? 'bg-lime-400/25 text-lime-100 ring-1 ring-lime-300' : 'bg-white/5 text-white/70'}`}
                    >
                      {OPTION_STYLES[i]?.shape} {o}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setEditing({ ...q, options: [...q.options] })}>
                <Pencil className="h-4 w-4" /> 수정
              </button>
              <button className="btn-ghost btn-sm text-rose-200" onClick={() => setDel(q)} aria-label={`문제 #${q.id} 삭제`}>
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

const QUESTION_TYPE_TABS: { type: QuestionType; label: string; desc: string }[] = [
  { type: 'MULTIPLE_CHOICE', label: '4지선다형', desc: '4개 보기 중 정답 1개 선택' },
  { type: 'OX', label: 'O/X 문제', desc: 'O 또는 X 두 가지 보기' },
  { type: 'SHORT_ANSWER', label: '단답형', desc: '학생이 직접 정답 입력' },
];

function QuestionForm({ initial, onClose, onSaved }: { initial: Partial<Question>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState<Partial<Question>>({
    ...EMPTY,
    ...initial,
    questionType: initial.questionType ?? 'MULTIPLE_CHOICE',
    options: initial.options ? [...initial.options] : [...EMPTY.options],
  });
  const [busy, setBusy] = useState(false);

  const qType: QuestionType = q.questionType ?? 'MULTIPLE_CHOICE';
  const options = q.options ?? [];

  const set = <K extends keyof Question>(k: K, v: Question[K]) => setQ((cur) => ({ ...cur, [k]: v }));

  const switchType = (nextType: QuestionType) => {
    if (nextType === qType) return;
    setQ((cur) => {
      const prevType = cur.questionType ?? 'MULTIPLE_CHOICE';
      const prevOpts = cur.options ?? [];
      if (nextType === 'OX') {
        const nextOpts = prevType === 'OX' && prevOpts.length === 2 ? prevOpts : ['O', 'X'];
        const nextCorrect = (cur.correctIndex ?? 0) <= 1 ? (cur.correctIndex ?? 0) : 0;
        return { ...cur, questionType: 'OX', options: nextOpts, correctIndex: nextCorrect };
      }
      if (nextType === 'SHORT_ANSWER') {
        const cleaned = prevType === 'OX' ? [] : prevOpts.filter((x) => x.trim().length > 0).slice(0, 5);
        return { ...cur, questionType: 'SHORT_ANSWER', options: cleaned.length ? cleaned : [''], correctIndex: 0 };
      }
      // MULTIPLE_CHOICE
      const base = prevType === 'OX' ? ['', '', '', ''] : [...prevOpts.slice(0, 4)];
      while (base.length < 4) base.push('');
      return {
        ...cur,
        questionType: 'MULTIPLE_CHOICE',
        options: base,
        correctIndex: Math.min(3, Math.max(0, cur.correctIndex ?? 0)),
      };
    });
  };

  const save = async () => {
    setBusy(true);
    const preparedOptions =
      qType === 'SHORT_ANSWER' ? options.map((s) => s.trim()).filter(Boolean) : options.map((s) => s.trim());
    const body = {
      questionType: qType,
      questionText: q.questionText,
      options: preparedOptions,
      correctIndex: qType === 'SHORT_ANSWER' ? 0 : (q.correctIndex ?? 0),
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
          <span className="label">문제 유형</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="문제 유형">
            {QUESTION_TYPE_TABS.map((t) => {
              const active = qType === t.type;
              return (
                <button
                  key={t.type}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => switchType(t.type)}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                    active
                      ? 'border-neon-cyan bg-cyan-400/20 text-white shadow-[0_0_16px_rgba(34,227,255,0.25)]'
                      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="font-bold text-sm">{t.label}</div>
                  <div className="text-xs text-white/50">{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="question-text">문제</label>
          <textarea
            id="question-text"
            className="input min-h-20"
            value={q.questionText}
            onChange={(e) => set('questionText', e.target.value)}
            maxLength={500}
            placeholder="출제할 문제를 입력하세요"
          />
        </div>

        {qType === 'MULTIPLE_CHOICE' && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label className={`flex cursor-pointer items-center gap-1 rounded-xl px-2 py-2 ${OPTION_STYLES[i].bg}`} title="정답으로 지정">
                    <input type="radio" name="correct" checked={q.correctIndex === i} onChange={() => set('correctIndex', i)} />
                    <span>{OPTION_STYLES[i].shape}</span>
                  </label>
                  <input
                    className="input"
                    placeholder={`보기 ${i + 1}`}
                    value={o}
                    maxLength={120}
                    onChange={(e) => set('options', options.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-white/50">
              왼쪽 라디오 버튼으로 정답 보기를 선택합니다. 현재 정답: {OPTION_STYLES[q.correctIndex ?? 0].shape} {OPTION_STYLES[q.correctIndex ?? 0].name}
            </p>
          </>
        )}

        {qType === 'OX' && (
          <div className="space-y-2">
            <span className="label">정답 선택 및 보기 문구</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => {
                const selected = (q.correctIndex ?? 0) === i;
                const defaultLabel = i === 0 ? 'O' : 'X';
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border p-3 transition ${
                      selected ? 'border-lime-300 bg-lime-400/15 ring-2 ring-lime-300/60' : 'border-white/15 bg-white/5'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => set('correctIndex', i)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${OPTION_STYLES[i].bg}`}
                      >
                        <input
                          type="radio"
                          name="correct-ox"
                          checked={selected}
                          onChange={() => set('correctIndex', i)}
                          aria-label={`${defaultLabel} 정답 지정`}
                        />
                        <span>{OPTION_STYLES[i].shape}</span>
                        <span>{selected ? `${defaultLabel} (정답)` : `${defaultLabel} 선택`}</span>
                      </button>
                    </div>
                    <input
                      className="input"
                      aria-label={`${defaultLabel} 보기 문구`}
                      placeholder={defaultLabel}
                      value={options[i] ?? defaultLabel}
                      maxLength={120}
                      onChange={(e) => set('options', [0, 1].map((idx) => (idx === i ? e.target.value : (options[idx] ?? (idx === 0 ? 'O' : 'X')))))}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-white/50">
              기본 보기는 O / X 이며 필요 시 &apos;O (맞다)&apos;, &apos;X (틀리다)&apos; 등으로 바꿀 수 있습니다. 현재 정답: {options[q.correctIndex ?? 0] || ((q.correctIndex ?? 0) === 0 ? 'O' : 'X')}
            </p>
          </div>
        )}

        {qType === 'SHORT_ANSWER' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label mb-0">인정 답안 ({options.length}/5)</span>
              {options.length < 5 && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => set('options', [...options, ''])}>
                  <Plus className="h-3.5 w-3.5" /> 인정 답안 추가
                </button>
              )}
            </div>
            <div className="space-y-2">
              {options.map((ans, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input"
                    placeholder={i === 0 ? '대표 정답 (예: 세종대왕)' : `추가 인정 답안 ${i + 1} (예: 세종)`}
                    aria-label={`인정 답안 ${i + 1}`}
                    value={ans}
                    maxLength={120}
                    onChange={(e) => set('options', options.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-rose-200"
                      aria-label={`인정 답안 ${i + 1} 삭제`}
                      onClick={() => set('options', options.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-white/50">
              앞뒤·연속 공백과 영문 대소문자는 구분하지 않고 채점합니다. 같은 뜻의 표기가 여러 개라면 최대 5개까지 등록하세요.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="question-time-limit">제한시간(초)</label>
            <input
              id="question-time-limit"
              type="number"
              min={5}
              max={300}
              className="input"
              value={q.timeLimit}
              onChange={(e) => set('timeLimit', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="question-category">분류</label>
            <input
              id="question-category"
              className="input"
              value={q.category ?? ''}
              onChange={(e) => set('category', e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <label className="label" htmlFor="question-order">정렬 순서</label>
            <input
              id="question-order"
              type="number"
              className="input"
              value={q.orderNum}
              onChange={(e) => set('orderNum', Number(e.target.value))}
            />
          </div>
          <label className="mt-6 flex items-center gap-2">
            <input type="checkbox" checked={!!q.isDoublePoints} onChange={(e) => set('isDoublePoints', e.target.checked)} /> ⚡ 2배 점수
          </label>
        </div>
        <div>
          <label className="label" htmlFor="question-explanation">해설 (결과 공개 시 표시)</label>
          <textarea
            id="question-explanation"
            className="input"
            value={q.explanation ?? ''}
            onChange={(e) => set('explanation', e.target.value)}
            maxLength={1000}
          />
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
