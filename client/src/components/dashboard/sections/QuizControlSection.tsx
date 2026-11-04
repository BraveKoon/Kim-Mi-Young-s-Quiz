import { Monitor, QrCode as QrCodeIcon, Users, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CLASS_IDS, EVENTS, classDisplayName, type ClassState, type ParticipantSummary } from '@shared/types/index';
import { openProjector } from '../../../utils/projector';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useCountdown } from '../../../hooks/useCountdown';
import { OPTION_STYLES, QUESTION_TYPE_LABEL, pct, seconds } from '../../../utils/format';
import { DistributionChart } from '../../charts/DistributionChart';
import { JoinQrModal } from '../../common/QrCode';
import { Spinner } from '../../common/Spinner';
import { StatusBadge } from '../../common/StatusBadge';
import { Leaderboard } from '../../leaderboard/Leaderboard';
import { TimerBar } from '../../quiz/TimerBar';
import { ClassControls } from '../ClassControls';
import { SectionTitle } from '../CompetitionSelect';

const STATE_EVENTS = [EVENTS.STARTED, EVENTS.QUESTION, EVENTS.PAUSED, EVENTS.RESUMED, EVENTS.RESULTS, EVENTS.LEADERBOARD, EVENTS.FINISHED, EVENTS.RESET];

export function QuizControlSection() {
  const [params, setParams] = useSearchParams();
  const classId = CLASS_IDS.includes(params.get('class') ?? '') ? params.get('class')! : '2-1';
  const { socket, connected } = useAdminSocket();
  const [state, setState] = useState<ClassState | null>(null);
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [answered, setAnswered] = useState(0);
  const [sync, setSync] = useState<number | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/${classId}`;

  useEffect(() => {
    if (!socket || !connected) return;
    setState(null);
    socket.emit(EVENTS.ADMIN_WATCH, { classId }, (r: { ok: boolean; state: ClassState; participants: { participants: ParticipantSummary[] } }) => {
      if (r.ok) {
        setState(r.state);
        setAnswered(r.state.answeredCount);
        setParticipants(r.participants.participants);
      }
    });
    const onState = (p: { state: ClassState }) => {
      if (p.state.classId !== classId) return;
      setState(p.state);
      setAnswered(p.state.answeredCount);
    };
    const onParts = (p: { classId: string; participants: ParticipantSummary[] }) => p.classId === classId && setParticipants(p.participants);
    const onAns = (p: { classId: string; answeredCount: number }) => p.classId === classId && setAnswered(p.answeredCount);
    const onTimer = (p: { classId: string; serverNow: number }) => p.classId === classId && setSync(p.serverNow);
    STATE_EVENTS.forEach((e) => socket.on(e, onState));
    socket.on(EVENTS.PARTICIPANTS, onParts);
    socket.on(EVENTS.ANSWER_RECEIVED, onAns);
    socket.on(EVENTS.TIMER, onTimer);
    return () => {
      STATE_EVENTS.forEach((e) => socket.off(e, onState));
      socket.off(EVENTS.PARTICIPANTS, onParts);
      socket.off(EVENTS.ANSWER_RECEIVED, onAns);
      socket.off(EVENTS.TIMER, onTimer);
    };
  }, [socket, connected, classId]);

  return (
    <div>
      <SectionTitle title="퀴즈 진행 관리" desc="학급 하나를 선택해 실시간으로 진행합니다. 한 학급의 조작은 다른 학급에 영향을 주지 않습니다.">
        <select className="input w-40 font-semibold" value={classId} onChange={(e) => setParams({ class: e.target.value })}>
          {CLASS_IDS.map((id) => (
            <option key={id} value={id} className="bg-white text-slate-900">
              {classDisplayName(id)}
            </option>
          ))}
        </select>
        <button type="button" className="btn-ghost" onClick={() => setQrOpen(true)}>
          <QrCodeIcon className="h-4 w-4 text-[#2563EB]" /> 참가 QR
        </button>
        <button type="button" className="btn-ghost" onClick={() => openProjector(classId)}>
          <Monitor className="h-4 w-4 text-teal-600" /> 프로젝터
        </button>
      </SectionTitle>
      <JoinQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={`${classDisplayName(classId)} 참가 QR 코드`}
        subtitle="스마트폰 카메라로 스캔하면 반 입장 화면이 바로 열립니다"
        url={joinUrl}
      />
      {!state ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-2xl text-slate-900">{state.className}</span>
                <StatusBadge status={state.status} />
                <span className="text-sm font-medium text-slate-500">
                  {state.competitionTitle} · {state.quizSetTitle}
                </span>
              </div>
              <ClassControls classId={classId} status={state.status} questionIndex={state.questionIndex} totalQuestions={state.totalQuestions} />
            </div>
            {state.question ? (
              <AdminQuestion state={state} answered={answered} sync={sync} />
            ) : (
              <div className="glass p-8 text-center font-medium text-slate-500">
                {state.status === 'FINISHED' ? '퀴즈가 종료되었습니다.' : '퀴즈 시작 전입니다. 학생들이 입장하면 시작하세요.'}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="glass p-4">
              <h3 className="mb-2 flex items-center gap-2 font-bold text-slate-900">
                <Users className="h-4 w-4 text-[#2563EB]" /> 참가자 {participants.length}/35 <Wifi className="ml-2 h-4 w-4 text-teal-600" /> {participants.filter((p) => p.connected).length}
              </h3>
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {participants.map((p) => (
                  <span
                    key={p.id}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      p.connected ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-slate-200 bg-slate-100 text-slate-400 line-through'
                    }`}
                  >
                    {p.nickname}
                  </span>
                ))}
              </div>
            </div>
            <div className="glass p-4">
              <h3 className="mb-2 font-bold text-slate-900">순위 {state.status === 'PLAYING' || state.status === 'PAUSED' ? '(문제 진행 중에는 직전 결과 기준)' : ''}</h3>
              <div className="max-h-[480px] overflow-y-auto pr-1">
                <Leaderboard entries={state.leaderboard} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminQuestion({ state, answered, sync }: { state: ClassState; answered: number; sync: number | null }) {
  const q = state.question!;
  const isShort = q.questionType === 'SHORT_ANSWER';
  const paused = state.status === 'PAUSED';
  const playing = state.status === 'PLAYING' || paused;
  const { remainingMs } = useCountdown({ endTime: state.endTime, startTime: state.startTime, running: state.status === 'PLAYING', frozenMs: state.remainingMs, serverNow: sync ?? state.serverNow });
  const correct = state.answerKey?.correctIndex ?? state.results?.correctIndex;
  const acceptedAnswers = state.answerKey?.acceptedAnswers ?? state.results?.acceptedAnswers ?? [];
  return (
    <div className="glass space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg text-[#1D4ED8]">
            문제 {q.index + 1}/{state.totalQuestions}
          </span>
          <span className="rounded-full border border-sky-200 bg-[#F3F9FF] px-2.5 py-0.5 text-xs font-bold text-sky-900">{QUESTION_TYPE_LABEL[q.questionType] ?? q.questionType}</span>
          {q.isDoublePoints && <span className="rounded-full border border-amber-300 bg-[#FEF9C3] px-2.5 py-0.5 text-xs font-extrabold text-amber-950">⚡ 2배</span>}
        </div>
        <span className="font-semibold">
          제출 {state.status === 'RESULT' ? state.results?.answeredCount : answered}/{state.participantCount}명
        </span>
      </div>
      <h3 className="text-2xl font-black text-slate-900">{q.text}</h3>
      {playing && <TimerBar remainingMs={remainingMs} totalMs={q.timeLimit * 1000} />}
      {isShort ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm">
          <span className="font-semibold text-teal-800">인정 답안: </span>
          <b className="text-base text-slate-900">{acceptedAnswers.join(' / ')}</b>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-white ${OPTION_STYLES[i].bg} ${i === correct ? 'ring-4 ring-emerald-500 shadow-sm' : 'opacity-80'}`}>
              <span>{OPTION_STYLES[i].shape}</span>
              <span className="flex-1 font-bold">{o}</span>
              {i === correct && <span className="rounded-md bg-white px-2 py-0.5 text-xs font-extrabold text-slate-900">정답</span>}
              {state.results && <span className="rounded-md bg-black/25 px-2 py-0.5 text-xs font-bold">{state.results.distribution[i]}명</span>}
            </div>
          ))}
        </div>
      )}
      {state.results && (
        <>
          <DistributionChart
            options={isShort ? ['정답', '오답'] : q.options}
            distribution={state.results.distribution}
            correctIndex={isShort ? 0 : state.results.correctIndex}
          />
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl border border-sky-100 bg-[#F3F9FF] p-2.5 font-medium text-slate-600">
              정답률(응답자)
              <div className="font-display text-xl text-slate-900">{state.results.answeredCount ? pct(state.results.correctCount / state.results.answeredCount) : '-'}</div>
            </div>
            <div className="rounded-xl border border-sky-100 bg-[#F3F9FF] p-2.5 font-medium text-slate-600">
              정답률(전체)
              <div className="font-display text-xl text-slate-900">{state.results.participantCount ? pct(state.results.correctCount / state.results.participantCount) : '-'}</div>
            </div>
            <div className="rounded-xl border border-sky-100 bg-[#F3F9FF] p-2.5 font-medium text-slate-600">
              평균 응답 시간
              <div className="font-display text-xl text-slate-900">{seconds(state.results.averageElapsedMs)}</div>
            </div>
          </div>
        </>
      )}
      {(state.answerKey?.explanation || state.results?.explanation) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm font-medium text-slate-800">
          💡 {state.answerKey?.explanation ?? state.results?.explanation}
        </p>
      )}
    </div>
  );
}
