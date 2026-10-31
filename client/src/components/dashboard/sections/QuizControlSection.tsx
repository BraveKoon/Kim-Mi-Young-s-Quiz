import { Monitor, Users, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CLASS_IDS, EVENTS, classDisplayName, type ClassState, type ParticipantSummary } from '@shared/types/index';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useCountdown } from '../../../hooks/useCountdown';
import { OPTION_STYLES, pct, seconds } from '../../../utils/format';
import { Spinner } from '../../common/Spinner';
import { StatusBadge } from '../../common/StatusBadge';
import { DistributionChart } from '../../charts/DistributionChart';
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
        <select className="input w-40" value={classId} onChange={(e) => setParams({ class: e.target.value })}>
          {CLASS_IDS.map((id) => (
            <option key={id} value={id} className="bg-ink-800">
              {classDisplayName(id)}
            </option>
          ))}
        </select>
        <a className="btn-ghost" href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/projector/${classId}`} target="_blank" rel="noreferrer">
          <Monitor className="h-4 w-4" /> 프로젝터
        </a>
      </SectionTitle>
      {!state ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl">{state.className}</span>
                <StatusBadge status={state.status} />
                <span className="text-sm text-white/60">
                  {state.competitionTitle} · {state.quizSetTitle}
                </span>
              </div>
              <ClassControls classId={classId} status={state.status} questionIndex={state.questionIndex} totalQuestions={state.totalQuestions} />
            </div>
            {state.question ? <AdminQuestion state={state} answered={answered} sync={sync} /> : <div className="glass p-8 text-center text-white/60">{state.status === 'FINISHED' ? '퀴즈가 종료되었습니다.' : '퀴즈 시작 전입니다. 학생들이 입장하면 시작하세요.'}</div>}
          </div>
          <div className="space-y-4">
            <div className="glass p-4">
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <Users className="h-4 w-4" /> 참가자 {participants.length}/35 <Wifi className="ml-2 h-4 w-4 text-lime-300" /> {participants.filter((p) => p.connected).length}
              </h3>
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {participants.map((p) => (
                  <span key={p.id} className={`rounded-full px-2.5 py-0.5 text-xs ${p.connected ? 'bg-lime-400/20 text-lime-100' : 'bg-white/5 text-white/40 line-through'}`}>
                    {p.nickname}
                  </span>
                ))}
              </div>
            </div>
            <div className="glass p-4">
              <h3 className="mb-2 font-bold">순위 {state.status === 'PLAYING' || state.status === 'PAUSED' ? '(문제 진행 중에는 직전 결과 기준)' : ''}</h3>
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
  const paused = state.status === 'PAUSED';
  const playing = state.status === 'PLAYING' || paused;
  const { remainingMs } = useCountdown({ endTime: state.endTime, startTime: state.startTime, running: state.status === 'PLAYING', frozenMs: state.remainingMs, serverNow: sync ?? state.serverNow });
  const correct = state.answerKey?.correctIndex ?? state.results?.correctIndex;
  return (
    <div className="glass space-y-4 p-5">
      <div className="flex items-center justify-between text-sm text-white/70">
        <span className="font-display text-lg text-white">
          문제 {q.index + 1}/{state.totalQuestions}
        </span>
        {q.isDoublePoints && <span className="rounded-full bg-neon-yellow px-2 font-bold text-ink-950">⚡ 2배</span>}
        <span>
          제출 {state.status === 'RESULT' ? state.results?.answeredCount : answered}/{state.participantCount}명
        </span>
      </div>
      <h3 className="text-2xl font-black">{q.text}</h3>
      {playing && <TimerBar remainingMs={remainingMs} totalMs={q.timeLimit * 1000} />}
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${OPTION_STYLES[i].bg} ${i === correct ? 'ring-4 ring-lime-300' : 'opacity-70'}`}>
            <span>{OPTION_STYLES[i].shape}</span>
            <span className="flex-1 font-bold">{o}</span>
            {i === correct && <span className="rounded bg-black/30 px-2 text-xs">정답</span>}
            {state.results && <span className="rounded bg-black/30 px-2 text-xs">{state.results.distribution[i]}명</span>}
          </div>
        ))}
      </div>
      {state.results && (
        <>
          <DistributionChart options={q.options} distribution={state.results.distribution} correctIndex={state.results.correctIndex} />
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-white/5 p-2">
              정답률(응답자)
              <div className="font-display text-xl">{state.results.answeredCount ? pct(state.results.correctCount / state.results.answeredCount) : '-'}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              정답률(전체)
              <div className="font-display text-xl">{state.results.participantCount ? pct(state.results.correctCount / state.results.participantCount) : '-'}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              평균 응답 시간
              <div className="font-display text-xl">{seconds(state.results.averageElapsedMs)}</div>
            </div>
          </div>
        </>
      )}
      {(state.answerKey?.explanation || state.results?.explanation) && <p className="rounded-xl bg-white/5 p-3 text-sm">💡 {state.answerKey?.explanation ?? state.results?.explanation}</p>}
    </div>
  );
}
