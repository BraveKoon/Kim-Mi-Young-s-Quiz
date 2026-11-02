import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Maximize, Minimize, PauseCircle, QrCode as QrCodeIcon, Trophy, Users, Wifi, WifiOff, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EVENTS, classDisplayName, isValidClassId, type ClassState, type ParticipantSummary } from '@shared/types/index';
import { DistributionChart } from '../components/charts/DistributionChart';
import { ClassroomAccentStrip, Logo } from '../components/common/Logo';
import { JoinQrModal, QrCode } from '../components/common/QrCode';
import { FullScreenSpinner } from '../components/common/Spinner';
import { StatusBadge } from '../components/common/StatusBadge';
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
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard?.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 미지원 환경에서는 무시
    }
  };

  return (
    <div className="flex min-h-screen flex-col p-4 md:p-8">
      <header className="glass mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Logo size="sm" />
          <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
          <span className="font-display text-3xl text-slate-900 md:text-4xl">{state.className}</span>
          <StatusBadge status={state.status} className="text-base" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-slate-600">
          {connected ? <Wifi className="h-5 w-5 text-teal-600" /> : <WifiOff className="h-5 w-5 text-rose-500" />}
          <span className="flex items-center gap-1 text-lg font-bold text-slate-800">
            <Users className="h-5 w-5 text-teal-600" /> {state.connectedCount || participants.filter((p) => p.connected).length}/{state.participantCount || participants.length}
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setQrOpen(true)}>
            <QrCodeIcon className="h-4 w-4 text-[#2563EB]" /> 참가 QR
          </button>
          <FullscreenButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {state.status === 'WAITING' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-[#FEF9C3] px-5 py-1.5 text-base font-bold text-amber-900 md:text-lg">
              <span>★ 스마트폰 카메라로 QR 코드를 스캔하거나 아래 주소로 접속하세요</span>
            </div>

            <div className="glass-strong w-full max-w-4xl overflow-hidden text-left">
              <ClassroomAccentStrip />
              <div className="grid items-center gap-6 p-6 md:grid-cols-[auto_1fr] md:gap-8 md:p-8">
                {/* QR 코드 영역 */}
                <div className="flex flex-col items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    className="group relative rounded-2xl border-2 border-sky-200 bg-white p-3 shadow-[0_10px_28px_-10px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:border-[#2563EB]"
                    title="QR 코드 크게 보기"
                  >
                    <QrCode value={joinUrl} size={216} label={`${state.className} 참가 QR 코드`} />
                    <span className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#F3F9FF] py-1.5 text-xs font-bold text-[#1D4ED8] transition group-hover:bg-blue-100/80">
                      <ZoomIn className="h-3.5 w-3.5" /> 클릭해서 크게 보기
                    </span>
                  </button>
                </div>

                {/* 접속 안내 영역 */}
                <div className="min-w-0 space-y-4 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-[#F3F9FF] px-3.5 py-1 text-xs font-extrabold text-[#1D4ED8]">
                    <QrCodeIcon className="h-3.5 w-3.5" />
                    <span>{state.className} 바로 입장 링크</span>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-500">접속 주소</div>
                    <div className="mt-1 break-all font-display text-3xl tracking-wide text-[#2563EB] md:text-5xl">
                      {joinUrl.replace(/^https?:\/\//, '')}
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-700 md:text-base">
                    <div>1. 카메라로 <b>QR 코드 스캔</b> 또는 위 주소 접속</div>
                    <div>2. <b>번호 · 이름</b>을 입력하고 바로 입장해요!</div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                    <button type="button" className="btn-primary btn-sm" onClick={() => setQrOpen(true)}>
                      <ZoomIn className="h-4 w-4" /> QR 크게 보기
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={copyJoinUrl}>
                      {copied ? <Check className="h-4 w-4 text-teal-600" /> : <Copy className="h-4 w-4 text-[#2563EB]" />}
                      {copied ? '주소 복사됨!' : '접속 주소 복사'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="font-display text-3xl text-slate-900 md:text-5xl">번호와 이름을 입력하고 입장하세요!</div>

            <div className="flex max-w-6xl flex-wrap justify-center gap-3">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.span
                    key={p.id}
                    layout
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={`rounded-full border border-sky-200 bg-white px-5 py-2 text-2xl font-bold text-slate-800 shadow-2xs ${p.connected ? '' : 'opacity-40'}`}
                  >
                    {p.nickname}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="rounded-full border border-teal-200 bg-teal-50 px-6 py-2 text-2xl font-extrabold text-teal-900 md:text-3xl">
              현재 {participants.length || state.participantCount}명 입장 완료
            </div>
          </div>
        )}
        {(state.status === 'PLAYING' || state.status === 'PAUSED') && state.question && <ProjectorQuestion state={state} answered={answered} timerSync={timerSync} />}
        {state.status === 'RESULT' && state.results && state.question && (
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <div className="glass-strong flex flex-col gap-4 p-6">
              <h2 className="text-center text-3xl font-black text-slate-900">{state.question.text}</h2>
              <DistributionChart
                options={state.question.questionType === 'SHORT_ANSWER' ? ['정답', '오답'] : state.question.options}
                distribution={state.results.distribution}
                correctIndex={state.question.questionType === 'SHORT_ANSWER' ? 0 : state.results.correctIndex}
                height={300}
              />
              {state.question.questionType === 'SHORT_ANSWER' ? (
                <div className="rounded-2xl border-2 border-teal-300 bg-teal-50 px-6 py-4 text-center text-2xl font-black text-teal-900">
                  정답: {(state.results.acceptedAnswers ?? []).join(' / ')}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {state.question.options.map((o, i) => (
                    <AnswerButton key={i} index={i} text={o} disabled mode={i === state.results!.correctIndex ? 'correct' : 'dim'} />
                  ))}
                </div>
              )}
              <div className="text-center text-xl font-bold text-slate-600">
                정답률 {state.results.answeredCount ? pct(state.results.correctCount / state.results.answeredCount) : '0%'} ({state.results.correctCount}/{state.results.answeredCount}명)
              </div>
              {state.results.explanation && (
                <p className="rounded-2xl border border-amber-200 bg-[#FFFDF2] p-4 text-xl font-medium text-slate-800">💡 {state.results.explanation}</p>
              )}
            </div>
            <div className="glass-strong p-6">
              <h3 className="mb-4 flex items-center gap-2 font-display text-3xl text-slate-900">
                <Trophy className="h-8 w-8 text-amber-500" /> 순위
              </h3>
              <Leaderboard entries={state.leaderboard} large />
            </div>
          </div>
        )}
        {state.status === 'FINISHED' && (
          <div className="flex flex-1 flex-col gap-8">
            <h2 className="text-center font-display text-5xl text-slate-900 md:text-6xl">🏆 최종 순위 발표</h2>
            <Podium entries={state.leaderboard} large confetti={false} />
            {state.leaderboard.some((e) => e.rank > 3) && (
              <div className="glass mx-auto w-full max-w-4xl p-4">
                <Leaderboard entries={state.leaderboard.filter((e) => e.rank > 3).slice(0, 7)} large showLast={false} />
              </div>
            )}
          </div>
        )}
        {state.status === 'NO_SESSION' && <div className="flex flex-1 items-center justify-center text-3xl font-bold text-slate-500">준비된 퀴즈가 없습니다.</div>}
      </main>

      <JoinQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={`${state.className} 참가 QR 코드`}
        subtitle="스마트폰 기본 카메라로 스캔하면 반 입장 화면이 바로 열립니다"
        url={joinUrl}
      />
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
      <div className="flex items-center justify-between text-2xl text-slate-800">
        <span className="font-display">
          문제 {q.index + 1} / {state.totalQuestions}
        </span>
        {q.isDoublePoints && <span className="rounded-full border border-amber-300 bg-[#FEF9C3] px-4 py-1 font-bold text-amber-900">⚡ 2배 점수</span>}
        <span className="font-bold">
          제출 {answered ?? state.answeredCount}/{state.participantCount}명
        </span>
      </div>
      <motion.div key={q.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-strong overflow-hidden text-center">
        <ClassroomAccentStrip />
        <div className="p-8">
          <h2 className="break-keep text-4xl font-black leading-tight text-slate-900 md:text-6xl">{q.text}</h2>
        </div>
      </motion.div>
      <TimerBar remainingMs={beforeStartMs > 0 ? q.timeLimit * 1000 : remainingMs} totalMs={q.timeLimit * 1000} large />
      {paused && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 py-3 text-4xl font-bold text-amber-900">
          <PauseCircle className="h-10 w-10 text-amber-600" /> 일시정지
        </div>
      )}
      {q.questionType === 'SHORT_ANSWER' ? (
        <div className="glass flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="font-display text-3xl text-[#2563EB] md:text-5xl">단답형 문제</div>
          <p className="text-xl font-medium text-slate-600 md:text-2xl">각자 화면에 정답을 직접 입력해 제출하세요!</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-4">
          {q.options.map((o, i) => (
            <AnswerButton key={i} index={i} text={o} disabled large mode="idle" />
          ))}
        </div>
      )}
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
  const [qrOpen, setQrOpen] = useState(false);
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
  const resultsUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/results/${competitionId}`;
  const podium = data.top.slice(0, 5).map((t, i) => ({ ...t, participantId: i, prevRank: null, correctCount: 0, lastAwarded: 0, lastCorrect: null }));
  return (
    <div className="flex min-h-screen flex-col gap-6 p-6 md:p-10">
      <header className="glass flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Logo size="sm" />
        <h1 className="font-display text-3xl text-slate-900 md:text-5xl">{data.competition.title}</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setQrOpen(true)}>
            <QrCodeIcon className="h-4 w-4 text-[#2563EB]" /> 결과 QR
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setView(view === 'class' ? 'individual' : 'class')}>
            {view === 'class' ? '개인 순위 보기' : '학급 순위 보기'}
          </button>
          <FullscreenButton />
        </div>
      </header>
      {data.fairnessWarning && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-lg font-semibold text-amber-900">⚠️ {data.fairnessWarning}</div>
      )}
      <AnimatePresence mode="wait">
        {view === 'class' ? (
          <motion.div key="class" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="glass-strong flex-1 p-6">
            <h2 className="mb-4 font-display text-4xl text-slate-900">🏫 학급 순위 (평균 점수)</h2>
            <div className="space-y-3">
              {data.classRanking.map((c, i) => {
                const max = Math.max(1, ...data.classRanking.map((x) => x.averageScore));
                return (
                  <motion.div key={c.classId} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-4 text-2xl text-slate-900">
                    <span className="w-14 font-display text-3xl text-[#2563EB]">{c.rank}위</span>
                    <span className="w-36 font-bold">{classDisplayName(c.classId)}</span>
                    <div className="h-10 flex-1 overflow-hidden rounded-full bg-sky-100">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(c.averageScore / max) * 100}%` }} transition={{ duration: 1, delay: i * 0.08 }} className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6]" />
                    </div>
                    <span className="w-32 text-right font-display">{num(Math.round(c.averageScore))}점</span>
                    <span className="w-20 text-right text-lg text-slate-500">{c.participantCount}명</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="ind" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex flex-1 flex-col gap-6">
            <h2 className="text-center font-display text-4xl text-slate-900">🏆 전체 개인 순위</h2>
            <Podium entries={podium} large confetti={false} />
            <div className="glass mx-auto w-full max-w-4xl p-4">
              <Leaderboard entries={podium.concat(data.top.slice(5).map((t, i) => ({ ...t, participantId: 100 + i, prevRank: null, correctCount: 0, lastAwarded: 0, lastCorrect: null }))).filter((e) => e.rank > 3)} large showClass showLast={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <JoinQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={`${data.competition.title} 결과 QR 코드`}
        subtitle="스마트폰으로 스캔하면 대회 공개 결과 페이지를 확인할 수 있습니다"
        url={resultsUrl}
      />
    </div>
  );
}
