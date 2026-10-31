import { AnimatePresence, motion } from 'framer-motion';
import { Maximize, Minimize, PauseCircle, Trophy, Users, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EVENTS, classDisplayName, isValidClassId, type ClassState, type ParticipantSummary } from '@shared/types/index';
import { Logo } from '../components/common/Logo';
import { StatusBadge } from '../components/common/StatusBadge';
import { FullScreenSpinner } from '../components/common/Spinner';
import { DistributionChart } from '../components/charts/DistributionChart';
import { Leaderboard } from '../components/leaderboard/Leaderboard';
import { Podium } from '../components/leaderboard/Podium';
import { AnswerButton } from '../components/quiz/AnswerButton';
import { DoublePointsBanner } from '../components/quiz/DoublePointsBanner';
import { TimerBar } from '../components/quiz/TimerBar';
import { useCountdown } from '../hooks/useCountdown';
import { useInterval } from '../hooks/useInterval';
import { studentApi } from '../services/api';
import { createSocket } from '../socket';
import { celebrate } from '../utils/confetti';
import { num, pct } from '../utils/format';
import NotFoundPage from './NotFoundPage';

function useFullscreen() {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch?.(() => {});
  return { fs, toggle };
}

function FullscreenButton() {
  const { fs, toggle } = useFullscreen();
  return (
    <button className="btn-ghost btn-sm" onClick={toggle} title="전체 화면">
      {fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />} {fs ? '전체 화면 종료' : '전체 화면'}
    </button>
  );
}

/** 학급 프로젝터: 공개 가능한 데이터만 수신(이름 공개 방식은 서버 설정을 따름) */
export default function ProjectorPage() {
  const { classId = '' } = useParams();
  if (!isValidClassId(classId)) return <NotFoundPage />;
  return <ClassProjector key={classId} classId={classId} />;
}

function ClassProjector({ classId }: { classId: string }) {
  const [state, setState] = useState<ClassState | null>(null);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timerSync, setTimerSync] = useState<number | null>(null);

  useEffect(() => {
    const s = createSocket({ role: 'projector', classId });
    const apply = (p: { state: ClassState }) => {
      setState(p.state);
      setAnswered(p.state.answeredCount);
    };
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    for (const ev of [EVENTS.STATE, EVENTS.STARTED, EVENTS.QUESTION, EVENTS.PAUSED, EVENTS.RESUMED, EVENTS.RESULTS, EVENTS.LEADERBOARD, EVENTS.FINISHED, EVENTS.RESET]) s.on(ev, apply);
    s.on(EVENTS.PARTICIPANTS, (p: { participants: ParticipantSummary[] }) => setParticipants(p.participants));
    s.on(EVENTS.ANSWER_RECEIVED, (p: { answeredCount: number }) => setAnswered(p.answeredCount));
    s.on(EVENTS.TIMER, (p: { serverNow: number }) => setTimerSync(p.serverNow));
    // 초기 참가자 목록
    studentApi.get(`/public/projector/${classId}`).then((r) => setState((cur) => cur ?? r.data.state)).catch(() => {});
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, [classId]);

  useEffect(() => {
    if (state?.status === 'FINISHED') celebrate(true);
  }, [state?.status]);

  if (!state) return <FullScreenSpinner label="프로젝터 화면을 준비하는 중…" />;
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/${classId}`;

  return (
    <div className="flex min-h-screen flex-col p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <span className="font-display text-3xl md:text-4xl">{state.className}</span>
          <StatusBadge status={state.status} className="text-base" />
        </div>
        <div className="flex items-center gap-3 text-white/60">
          {connected ? <Wifi className="h-5 w-5 text-lime-300" /> : <WifiOff className="h-5 w-5 text-rose-300" />}
          <span className="flex items-center gap-1 text-lg">
            <Users className="h-5 w-5" /> {state.connectedCount || participants.filter((p) => p.connected).length}/{state.participantCount || participants.length}
          </span>
          <FullscreenButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {state.status === 'WAITING' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
            <div className="text-2xl text-white/70">접속 주소</div>
            <div className="glass-strong px-8 py-5 font-display text-4xl tracking-wide text-neon-cyan md:text-6xl">{joinUrl.replace(/^https?:\/\//, '')}</div>
            <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="font-display text-5xl neon-text md:text-7xl">
              닉네임을 입력하고 입장하세요!
            </motion.div>
            <div className="flex max-w-6xl flex-wrap justify-center gap-3">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.span key={p.id} layout initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className={`rounded-full bg-white/10 px-5 py-2 text-2xl font-bold ${p.connected ? '' : 'opacity-40'}`}>
                    {p.nickname}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="text-3xl font-bold">{participants.length || state.participantCount}명 참가</div>
          </div>
        )}
        {(state.status === 'PLAYING' || state.status === 'PAUSED') && state.question && <ProjectorQuestion state={state} answered={answered} timerSync={timerSync} />}
        {state.status === 'RESULT' && state.results && state.question && (
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <div className="glass-strong flex flex-col gap-4 p-6">
              <h2 className="text-center text-3xl font-black">{state.question.text}</h2>
              <DistributionChart options={state.question.options} distribution={state.results.distribution} correctIndex={state.results.correctIndex} height={300} />
              <div className="grid grid-cols-2 gap-3">
                {state.question.options.map((o, i) => (
                  <AnswerButton key={i} index={i} text={o} disabled mode={i === state.results!.correctIndex ? 'correct' : 'dim'} />
                ))}
              </div>
              <div className="text-center text-xl text-white/70">
                정답률 {state.results.answeredCount ? pct(state.results.correctCount / state.results.answeredCount) : '0%'} ({state.results.correctCount}/{state.results.answeredCount}명)
              </div>
              {state.results.explanation && <p className="rounded-2xl bg-white/5 p-4 text-xl">💡 {state.results.explanation}</p>}
            </div>
            <div className="glass-strong p-6">
              <h3 className="mb-4 flex items-center gap-2 font-display text-3xl">
                <Trophy className="h-8 w-8 text-neon-yellow" /> 순위
              </h3>
              <Leaderboard entries={state.leaderboard} large />
            </div>
          </div>
        )}
        {state.status === 'FINISHED' && (
          <div className="flex flex-1 flex-col gap-8">
            <h2 className="text-center font-display text-6xl neon-text">🏆 최종 순위 발표 🏆</h2>
            <Podium entries={state.leaderboard} large confetti={false} />
            {state.leaderboard.some((e) => e.rank > 3) && (
              <div className="glass mx-auto w-full max-w-4xl p-4">
                <Leaderboard entries={state.leaderboard.filter((e) => e.rank > 3).slice(0, 7)} large showLast={false} />
              </div>
            )}
          </div>
        )}
        {state.status === 'NO_SESSION' && <div className="flex flex-1 items-center justify-center text-3xl text-white/60">준비된 퀴즈가 없습니다.</div>}
      </main>
    </div>
  );
}

function ProjectorQuestion({ state, answered, timerSync }: { state: ClassState; answered: number | null; timerSync: number | null }) {
  const q = state.question!;
  const paused = state.status === 'PAUSED';
  const { remainingMs, beforeStartMs } = useCountdown({ endTime: state.endTime, startTime: state.startTime, running: !paused, frozenMs: state.remainingMs, serverNow: timerSync ?? state.serverNow });
  return (
    <div className="flex flex-1 flex-col gap-6">
      <DoublePointsBanner show={q.isDoublePoints && beforeStartMs > 0} />
      <div className="flex items-center justify-between text-2xl">
        <span className="font-display">
          문제 {q.index + 1} / {state.totalQuestions}
        </span>
        {q.isDoublePoints && <span className="rounded-full bg-neon-yellow px-4 py-1 font-bold text-ink-950">⚡ 2배 점수</span>}
        <span className="font-bold">
          제출 {answered ?? state.answeredCount}/{state.participantCount}명
        </span>
      </div>
      <motion.div key={q.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-strong p-8 text-center">
        <h2 className="break-keep text-4xl font-black leading-tight md:text-6xl">{q.text}</h2>
      </motion.div>
      <TimerBar remainingMs={beforeStartMs > 0 ? q.timeLimit * 1000 : remainingMs} totalMs={q.timeLimit * 1000} large />
      {paused && (
        <div className="flex items-center justify-center gap-3 text-4xl font-bold text-amber-200">
          <PauseCircle className="h-10 w-10" /> 일시정지
        </div>
      )}
      <div className="grid flex-1 grid-cols-2 gap-4">
        {q.options.map((o, i) => (
          <AnswerButton key={i} index={i} text={o} disabled large mode="idle" />
        ))}
      </div>
    </div>
  );
}

// ───────────────────── 전체 대회 발표 화면 ─────────────────────

interface PublicResults {
  competition: { id: number; title: string; description: string | null; status: string };
  top: { rank: number; classId: string; nickname: string; totalScore: number }[];
  classRanking: { rank: number; classId: string; averageScore: number; participantCount: number; status: string }[];
  comparable: boolean;
  fairnessWarning: string | null;
}

export function CompetitionProjectorPage() {
  const { competitionId = '' } = useParams();
  const [data, setData] = useState<PublicResults | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<'class' | 'individual'>('class');
  const load = () =>
    studentApi
      .get(`/public/competitions/${Number(competitionId)}/results`)
      .then((r) => setData(r.data))
      .catch(() => setError(true));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);
  useInterval(load, 5000);
  useInterval(() => setView((v) => (v === 'class' ? 'individual' : 'class')), 15000);

  if (error && !data) return <NotFoundPage />;
  if (!data) return <FullScreenSpinner />;
  const podium = data.top.slice(0, 5).map((t, i) => ({ ...t, participantId: i, prevRank: null, correctCount: 0, lastAwarded: 0, lastCorrect: null }));
  return (
    <div className="flex min-h-screen flex-col gap-6 p-6 md:p-10">
      <header className="flex items-center justify-between">
        <Logo size="sm" />
        <h1 className="font-display text-4xl md:text-5xl">{data.competition.title}</h1>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setView(view === 'class' ? 'individual' : 'class')}>
            {view === 'class' ? '개인 순위 보기' : '학급 순위 보기'}
          </button>
          <FullscreenButton />
        </div>
      </header>
      {data.fairnessWarning && <div className="rounded-2xl bg-amber-400/15 p-3 text-center text-lg text-amber-100">⚠️ {data.fairnessWarning}</div>}
      <AnimatePresence mode="wait">
        {view === 'class' ? (
          <motion.div key="class" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="glass-strong flex-1 p-6">
            <h2 className="mb-4 font-display text-4xl">🏫 학급 순위 (평균 점수)</h2>
            <div className="space-y-3">
              {data.classRanking.map((c, i) => {
                const max = Math.max(1, ...data.classRanking.map((x) => x.averageScore));
                return (
                  <motion.div key={c.classId} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-4 text-2xl">
                    <span className="w-14 font-display text-3xl">{c.rank}위</span>
                    <span className="w-36 font-bold">{classDisplayName(c.classId)}</span>
                    <div className="h-10 flex-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(c.averageScore / max) * 100}%` }} transition={{ duration: 1, delay: i * 0.08 }} className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400" />
                    </div>
                    <span className="w-32 text-right font-display">{num(Math.round(c.averageScore))}점</span>
                    <span className="w-20 text-right text-lg text-white/50">{c.participantCount}명</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="ind" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex flex-1 flex-col gap-6">
            <h2 className="text-center font-display text-4xl">🏆 전체 개인 순위</h2>
            <Podium entries={podium} large confetti={false} />
            <div className="glass mx-auto w-full max-w-4xl p-4">
              <Leaderboard entries={podium.concat(data.top.slice(5).map((t, i) => ({ ...t, participantId: 100 + i, prevRank: null, correctCount: 0, lastAwarded: 0, lastCorrect: null }))).filter((e) => e.rank > 3)} large showClass showLast={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
