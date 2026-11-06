import { Lightbulb as TipIcon, School as SchoolIcon, Trophy as CupIcon, TriangleAlert as WarnIcon, Zap as BoltIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  FastForward,
  Flag,
  KeyRound,
  LogIn,
  Maximize,
  Minimize,
  Pause,
  PauseCircle,
  Play,
  QrCode as QrCodeIcon,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  ZoomIn,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { EVENTS, classDisplayName, isValidClassId, type ClassState, type ParticipantSummary } from '@shared/types/index';
import { DistributionChart } from '../components/charts/DistributionChart';
import { Logo } from '../components/common/Logo';
import { ConfirmDialog, Modal } from '../components/common/Modal';
import { JoinQrModal, QrCode } from '../components/common/QrCode';
import { FullScreenSpinner } from '../components/common/Spinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Leaderboard } from '../components/leaderboard/Leaderboard';
import { Podium } from '../components/leaderboard/Podium';
import { AnswerButton } from '../components/quiz/AnswerButton';
import { DoublePointsBanner } from '../components/quiz/DoublePointsBanner';
import { TimerBar } from '../components/quiz/TimerBar';
import { useOptionalAdminAuth } from '../contexts/AdminAuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCountdown } from '../hooks/useCountdown';
import { useInterval } from '../hooks/useInterval';
import { errorMessage, studentApi } from '../services/api';
import { createSocket, emitAck } from '../socket';
import { captureProjectorKey, forgetProjectorKey } from '../utils/projector';
import { celebrate } from '../utils/confetti';
import { num, pct } from '../utils/format';
import NotFoundPage from './NotFoundPage';

/** 세로 820px 이하(1280x720, 1366x768 등) 프로젝터 여부 — CSS 로 표현할 수 없는 숫자 값(차트 높이)에 사용 */
function useShortScreen() {
  const query = '(max-height: 820px)';
  const [short, setShort] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const h = () => setShort(mq.matches);
    h();
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return short;
}

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
    <button className="btn-ghost" onClick={toggle} title="전체 화면">
      {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />} {fs ? '전체 화면 종료' : '전체 화면'}
    </button>
  );
}

/**
 * 프로젝터 진행 명령 전송.
 * - keySocket: 대시보드에서 발급한 컨트롤 키로 연결된 프로젝터 소켓(비밀번호 입력 불필요) — 있으면 이 소켓으로 명령을 보낸다.
 * - 그 외에는 로그인한 교사 토큰으로 별도 관리자 소켓을 연결한다.
 */
function useProjectorAdminControls(token: string | null, enabled: boolean, keySocket: Socket | null) {
  const toast = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [adminConnected, setAdminConnected] = useState(false);
  const [keyConnected, setKeyConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!keySocket) {
      setKeyConnected(false);
      return;
    }
    setKeyConnected(keySocket.connected);
    const on = () => setKeyConnected(true);
    const off = () => setKeyConnected(false);
    keySocket.on('connect', on);
    keySocket.on('disconnect', off);
    return () => {
      keySocket.off('connect', on);
      keySocket.off('disconnect', off);
    };
  }, [keySocket]);

  useEffect(() => {
    if (!token || !enabled || keySocket) {
      setAdminConnected(false);
      return;
    }
    const s = createSocket({ role: 'admin', token });
    socketRef.current = s;
    s.on('connect', () => setAdminConnected(true));
    s.on('disconnect', () => setAdminConnected(false));
    s.on('connect_error', (e) => {
      setAdminConnected(false);
      if (e.message === 'UNAUTHORIZED' || e.message === 'PASSWORD_CHANGE_REQUIRED') s.disconnect();
    });
    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      setAdminConnected(false);
    };
  }, [token, enabled, keySocket]);

  const sendCommand = useCallback(
    async (event: string, payload: Record<string, unknown>, successMsg?: string) => {
      const s = keySocket ?? socketRef.current;
      if (!s?.connected) {
        toast('진행 제어 연결 중입니다. 잠시 후 다시 눌러 주세요.', 'error');
        return { ok: false };
      }
      setBusy(true);
      try {
        const r = await emitAck<{ ok: boolean; message?: string }>(s, event, payload, 15000);
        if (!r.ok) toast(r.message ?? '명령을 실행하지 못했습니다.', 'error');
        else if (successMsg) toast(successMsg, 'success');
        return r;
      } catch {
        toast('서버 응답이 없습니다.', 'error');
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [toast, keySocket],
  );

  return { adminConnected: keySocket ? keyConnected : adminConnected, busy, sendCommand };
}

/** 학급 프로젝터: 공개 가능한 데이터만 수신하며, 교사 로그인 시 화면에서 바로 진행 제어 가능 */
export default function ProjectorPage() {
  const { classId = '' } = useParams();
  if (!isValidClassId(classId)) return <NotFoundPage />;
  return <ClassProjector key={classId} classId={classId} />;
}

function ClassProjector({ classId }: { classId: string }) {
  const auth = useOptionalAdminAuth();
  const [state, setState] = useState<ClassState | null>(null);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timerSync, setTimerSync] = useState<number | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  // 대시보드에서 프로젝터를 열면 주소에 학급 전용 컨트롤 키가 실려 와서, 비밀번호 없이 진행 컨트롤이 열린다.
  const shortScreen = useShortScreen();
  const [controlKey] = useState(() => captureProjectorKey(classId));
  const [viewSocket, setViewSocket] = useState<Socket | null>(null);
  const [keyControl, setKeyControl] = useState(false);

  const adminLogin = Boolean(auth?.admin && auth?.token && !auth.admin.mustChangePassword);
  const canControl = adminLogin || keyControl;
  const { adminConnected, busy, sendCommand } = useProjectorAdminControls(auth?.token ?? null, adminLogin, keyControl ? viewSocket : null);

  useEffect(() => {
    const s = createSocket({ role: 'projector', classId, controlKey: controlKey ?? undefined });
    setViewSocket(s);
    s.on(EVENTS.PROJECTOR_CONTROL, (p: { enabled: boolean }) => {
      setKeyControl(p.enabled);
      if (!p.enabled && controlKey) forgetProjectorKey(classId); // 만료·무효 키는 버린다(보기 전용으로 전환)
    });
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
      setViewSocket(null);
      setKeyControl(false);
    };
  }, [classId, controlKey]);

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
      <header className="glass mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4 [@media(max-height:820px)]:mb-3 [@media(max-height:820px)]:py-2">
        <div className="flex flex-wrap items-center gap-4">
          <Logo size="md" />
          <span className="h-7 w-px bg-slate-200" aria-hidden="true" />
          <span className="font-display text-4xl text-slate-900 md:text-5xl [@media(max-height:820px)]:text-3xl">{state.className}</span>
          <StatusBadge status={state.status} className="text-lg! px-4! py-1!" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-slate-600">
          {connected ? <Wifi className="h-6 w-6 text-emerald-600" /> : <WifiOff className="h-6 w-6 text-rose-500" />}
          <span className="flex items-center gap-1.5 text-2xl font-bold text-slate-800">
            <Users className="h-6 w-6 text-slate-600" /> {state.connectedCount || participants.filter((p) => p.connected).length}/{state.participantCount || participants.length}
          </span>
          <button type="button" className="btn-ghost" onClick={() => setQrOpen(true)}>
            <QrCodeIcon className="h-5 w-5 text-brand-600" /> 참가 QR
          </button>
          {auth &&
            (canControl ? (
              <button
                type="button"
                className="btn-ghost border-brand-200 bg-brand-50 text-brand-700"
                onClick={() => setDockVisible((v) => !v)}
              >
                <ShieldCheck className="h-5 w-5 text-brand-600" />
                {dockVisible ? '진행 바 접기' : '진행 바 펼치기'}
                {dockVisible ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setAuthModalOpen(true)}>
                <KeyRound className="h-5 w-5 text-brand-600" /> 선생님 진행 모드
              </button>
            ))}
          <FullscreenButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {state.status === 'WAITING' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center [@media(max-height:820px)]:gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2 text-xl font-bold text-slate-800 md:text-2xl">
              <span>스마트폰 카메라로 QR 코드를 스캔하거나 아래 주소로 접속하세요</span>
            </div>

            <div className="glass-strong w-full max-w-5xl overflow-hidden text-left">
              <div className="grid items-center gap-6 p-6 md:grid-cols-[auto_1fr] md:gap-8 md:p-8 [@media(max-height:820px)]:p-4 [@media(max-height:820px)]:gap-4">
                {/* QR 코드 영역 */}
                <div className="flex flex-col items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    className="group relative rounded-2xl border-2 border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand-600"
                    title="QR 코드 크게 보기"
                  >
                    <QrCode value={joinUrl} size={shortScreen ? 220 : 288} label={`${state.className} 참가 QR 코드`} />
                    <span className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-sm font-bold text-brand-700 transition group-hover:bg-brand-100/80">
                      <ZoomIn className="h-3.5 w-3.5" /> 클릭해서 크게 보기
                    </span>
                  </button>
                </div>

                {/* 접속 안내 영역 */}
                <div className="min-w-0 space-y-4 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-extrabold text-brand-700">
                    <QrCodeIcon className="h-3.5 w-3.5" />
                    <span>{state.className} 바로 입장 링크</span>
                  </div>

                  <div>
                    <div className="text-base font-bold text-slate-500">접속 주소</div>
                    <div className="mt-1 break-all font-display text-3xl tracking-wide text-brand-600 md:text-5xl">
                      {joinUrl.replace(/^https?:\/\//, '')}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-semibold text-slate-700 md:text-xl">
                    <div>1. 카메라로 <b>QR 코드 스캔</b> 또는 위 주소 접속</div>
                    <div>2. <b>번호 · 이름</b>을 입력하고 바로 입장해요!</div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                    <button type="button" className="btn-primary" onClick={() => setQrOpen(true)}>
                      <ZoomIn className="h-5 w-5" /> QR 크게 보기
                    </button>
                    <button type="button" className="btn-ghost" onClick={copyJoinUrl}>
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-brand-600" />}
                      {copied ? '주소 복사됨!' : '접속 주소 복사'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="font-display text-3xl text-slate-900 md:text-5xl [@media(max-height:820px)]:text-3xl">번호와 이름을 입력하고 입장하세요!</div>

            <div className="flex max-w-6xl flex-wrap justify-center gap-3">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.span
                    key={p.id}
                    layout
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    className={`rounded-full border border-slate-200 bg-white px-6 py-2.5 text-3xl font-bold text-slate-800 ${p.connected ? '' : 'opacity-40'}`}
                  >
                    {p.nickname}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-6 py-2 text-2xl font-extrabold text-emerald-900 md:text-3xl">
                현재 {participants.length || state.participantCount}명 입장 완료
              </div>
              {canControl && (
                <button
                  type="button"
                  disabled={busy || !adminConnected}
                  onClick={() => sendCommand(EVENTS.ADMIN_START, { classId }, '퀴즈를 시작했습니다.')}
                  className="btn-primary h-12 rounded-full px-7 text-xl font-extrabold"
                >
                  <Play className="h-5 w-5" /> 지금 퀴즈 시작
                </button>
              )}
            </div>
          </div>
        )}
        {(state.status === 'PLAYING' || state.status === 'PAUSED') && state.question && <ProjectorQuestion state={state} answered={answered} timerSync={timerSync} />}
        {state.status === 'RESULT' && state.results && state.question && (
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <div className="glass-strong flex flex-col gap-4 p-6 [@media(max-height:820px)]:gap-2 [@media(max-height:820px)]:p-4">
              <h2 className="text-center text-3xl font-black text-slate-900 [@media(max-height:820px)]:text-2xl">{state.question.text}</h2>
              <DistributionChart
                options={state.question.questionType === 'SHORT_ANSWER' ? ['정답', '오답'] : state.question.options}
                distribution={state.results.distribution}
                correctIndex={state.question.questionType === 'SHORT_ANSWER' ? 0 : state.results.correctIndex}
                height={shortScreen ? 150 : 300}
                large
              />
              {state.question.questionType === 'SHORT_ANSWER' ? (
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-6 py-4 text-center text-2xl font-black text-emerald-900">
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
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-2xl leading-relaxed font-medium text-slate-800 [@media(max-height:820px)]:p-3 [@media(max-height:820px)]:text-lg"><TipIcon className="mr-2 inline h-7 w-7 text-amber-600" aria-hidden="true" />{state.results.explanation}</p>
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
            <h2 className="text-center font-display text-5xl text-slate-900 md:text-6xl"><CupIcon className="mr-3 inline h-12 w-12 text-amber-500" aria-hidden="true" />최종 순위 발표</h2>
            <Podium entries={state.leaderboard} large confetti={false} />
            {state.leaderboard.some((e) => e.rank > 3) && (
              <div className="glass mx-auto w-full max-w-4xl p-4">
                <Leaderboard entries={state.leaderboard.filter((e) => e.rank > 3).slice(0, 7)} large showLast={false} />
              </div>
            )}
          </div>
        )}
        {state.status === 'NO_SESSION' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-3xl font-bold text-slate-500">준비된 퀴즈가 없습니다.</div>
            {canControl && (
              <Link to="/admin/dashboard/classes" className="btn-primary">
                관리자 학급 관리에서 세션 배정하기
              </Link>
            )}
          </div>
        )}
      </main>

      {canControl && dockVisible && (
        <ProjectorControlDock
          classId={classId}
          state={state}
          answered={answered}
          username={auth?.admin?.username ?? '선생님'}
          adminConnected={adminConnected}
          busy={busy}
          sendCommand={sendCommand}
        />
      )}

      <JoinQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={`${state.className} 참가 QR 코드`}
        subtitle="스마트폰 기본 카메라로 스캔하면 반 입장 화면이 바로 열립니다"
        url={joinUrl}
      />

      {auth && (
        <ProjectorAdminAuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onActivated={() => {
            setAuthModalOpen(false);
            setDockVisible(true);
          }}
        />
      )}
    </div>
  );
}

/** 프로젝터 화면 하단 선생님 진행 컨트롤 도크 */
function ProjectorControlDock({
  classId,
  state,
  answered,
  username,
  adminConnected,
  busy,
  sendCommand,
}: {
  classId: string;
  state: ClassState;
  answered: number | null;
  username: string;
  adminConnected: boolean;
  busy: boolean;
  sendCommand: (event: string, payload: Record<string, unknown>, successMsg?: string) => Promise<{ ok: boolean }>;
}) {
  const [confirm, setConfirm] = useState<'finish' | 'reset' | null>(null);
  const [removeParticipants, setRemoveParticipants] = useState(false);

  const isLast = state.questionIndex + 1 >= state.totalQuestions;
  const disabled = busy || !adminConnected;

  const summary =
    state.status === 'WAITING'
      ? `대기 중 · 총 ${state.totalQuestions}문항 준비됨`
      : state.status === 'PLAYING' || state.status === 'PAUSED'
        ? `문제 ${state.questionIndex + 1} / ${state.totalQuestions} · 제출 ${answered ?? state.answeredCount}/${state.participantCount}명`
        : state.status === 'RESULT'
          ? `문제 ${state.questionIndex + 1} / ${state.totalQuestions} 결과 발표 중`
          : state.status === 'FINISHED'
            ? '퀴즈 종료 · 최종 순위 화면'
            : '세션 없음';

  return (
    <div
      className="glass-strong sticky bottom-3 z-30 mt-6 overflow-hidden"
      role="region"
      aria-label="프로젝터 퀴즈 진행 컨트롤"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-700">
            <span className={`h-2 w-2 rounded-full ${adminConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            선생님 진행 모드 ({username})
          </span>
          <span className="font-semibold text-slate-600">{summary}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {state.status === 'WAITING' && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_START, { classId }, '퀴즈를 시작했습니다.')}
              >
                <Play className="h-4 w-4" /> 퀴즈 시작
              </button>
              <button type="button" className="btn-ghost" disabled={disabled} onClick={() => setConfirm('finish')}>
                <Flag className="h-4 w-4" /> 종료
              </button>
              <button
                type="button"
                className="btn-ghost text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                disabled={disabled}
                onClick={() => setConfirm('reset')}
              >
                <RotateCcw className="h-4 w-4" /> 초기화
              </button>
            </>
          )}

          {state.status === 'PLAYING' && (
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_PAUSE, { classId })}
              >
                <Pause className="h-4 w-4" /> 일시정지
              </button>
              <button
                type="button"
                className="btn-cyan"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_SHOW_RESULTS, { classId })}
              >
                <CheckSquare className="h-4 w-4" /> 결과 발표
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_SKIP, { classId }, isLast ? '마지막 문제를 건너뛰고 종료했습니다.' : '다음 문제로 건너뛰었습니다.')}
              >
                <FastForward className="h-4 w-4 text-brand-600" /> 건너뛰기
              </button>
              <button type="button" className="btn-ghost" disabled={disabled} onClick={() => setConfirm('finish')}>
                <Flag className="h-4 w-4" /> 종료
              </button>
            </>
          )}

          {state.status === 'PAUSED' && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_RESUME, { classId })}
              >
                <Play className="h-4 w-4" /> 재개
              </button>
              <button
                type="button"
                className="btn-cyan"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_SHOW_RESULTS, { classId })}
              >
                <CheckSquare className="h-4 w-4" /> 결과 발표
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_SKIP, { classId }, isLast ? '마지막 문제를 건너뛰고 종료했습니다.' : '다음 문제로 건너뛰었습니다.')}
              >
                <FastForward className="h-4 w-4 text-brand-600" /> 건너뛰기
              </button>
              <button type="button" className="btn-ghost" disabled={disabled} onClick={() => setConfirm('finish')}>
                <Flag className="h-4 w-4" /> 종료
              </button>
            </>
          )}

          {state.status === 'RESULT' && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={disabled}
                onClick={() => sendCommand(EVENTS.ADMIN_NEXT, { classId })}
              >
                {isLast ? <Trophy className="h-4 w-4" /> : <SkipForward className="h-4 w-4" />}
                {isLast ? '최종 순위 발표' : '다음 문제'}
              </button>
              <button type="button" className="btn-ghost" disabled={disabled} onClick={() => setConfirm('finish')}>
                <Flag className="h-4 w-4" /> 종료
              </button>
            </>
          )}

          {state.status === 'FINISHED' && (
            <button
              type="button"
              className="btn-ghost text-rose-600 hover:border-rose-200 hover:bg-rose-50"
              disabled={disabled}
              onClick={() => setConfirm('reset')}
            >
              <RotateCcw className="h-4 w-4" /> 대기 화면으로 초기화
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'finish'}
        title="퀴즈 종료"
        message={`${state.className} 퀴즈를 지금 종료할까요? 현재까지의 점수로 최종 순위가 발표됩니다.`}
        confirmText="종료"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await sendCommand(EVENTS.ADMIN_FINISH, { classId }, '퀴즈를 종료했습니다.');
        }}
      />

      <ConfirmDialog
        open={confirm === 'reset'}
        danger
        title="학급 진행 상태 초기화"
        requireTyping="RESET"
        confirmText="초기화"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await sendCommand(EVENTS.ADMIN_RESET_CLASS, { classId, confirm: 'RESET', removeParticipants }, '초기화했습니다.');
        }}
        message={
          <div className="space-y-3">
            <p>{state.className}의 현재 세션 답안과 점수를 모두 지우고 대기 상태로 되돌립니다.</p>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={removeParticipants}
                onChange={(e) => setRemoveParticipants(e.target.checked)}
              />
              참가 학생 목록도 함께 비우기 (학생들이 다시 입장해야 함)
            </label>
          </div>
        }
      />
    </div>
  );
}

/** 프로젝터 화면을 벗어나지 않고 바로 선생님 진행 권한을 켜는 모달 */
function ProjectorAdminAuthModal({
  open,
  onClose,
  onActivated,
}: {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
}) {
  const auth = useOptionalAdminAuth()!;
  const toast = useToast();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [curPw, setCurPw] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const needPwChange = Boolean(auth.admin?.mustChangePassword);

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const info = await auth.login(username.trim(), password);
      setCurPw(password);
      setPassword('');
      if (!info.mustChangePassword) {
        toast('선생님 진행 모드가 켜졌습니다.', 'success');
        onActivated();
      }
    } catch (err) {
      setError(errorMessage(err, '로그인하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const submitChangePw = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (nextPw.length < 8) return setError('새 비밀번호는 8자 이상이어야 합니다.');
    if (nextPw !== confirmPw) return setError('새 비밀번호 확인이 일치하지 않습니다.');
    setBusy(true);
    try {
      await auth.changePassword(curPw, nextPw);
      setCurPw('');
      setNextPw('');
      setConfirmPw('');
      toast('비밀번호 변경 완료! 선생님 진행 모드가 켜졌습니다.', 'success');
      onActivated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={needPwChange ? '초기 비밀번호 변경' : '선생님 진행 모드 로그인'}>
      {needPwChange ? (
        <form onSubmit={submitChangePw} className="space-y-3.5">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-900">
            보안을 위해 초기 비밀번호를 변경하면 프로젝터 화면에서 바로 퀴즈를 진행할 수 있습니다.
          </p>
          <div>
            <label className="label" htmlFor="proj-cur-pw">현재 비밀번호</label>
            <input
              id="proj-cur-pw"
              type="password"
              className="input"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="proj-next-pw">새 비밀번호 (8자 이상)</label>
            <input
              id="proj-next-pw"
              type="password"
              className="input"
              value={nextPw}
              onChange={(e) => setNextPw(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="proj-confirm-pw">새 비밀번호 확인</label>
            <input
              id="proj-confirm-pw"
              type="password"
              className="input"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            <KeyRound className="h-4 w-4" /> 비밀번호 변경 후 진행 시작
          </button>
        </form>
      ) : (
        <form onSubmit={submitLogin} className="space-y-3.5">
          <p className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700">
            선생님 계정으로 인증하면 이 프로젝터 화면에서 <b>시작, 일시정지, 결과 발표, 건너뛰기, 다음 문제</b>를 바로 조작할 수 있습니다.
          </p>
          <div>
            <label className="label" htmlFor="proj-admin-id">관리자 아이디</label>
            <input
              id="proj-admin-id"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="proj-admin-pw">비밀번호</label>
            <input
              id="proj-admin-pw"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>
              취소
            </button>
            <button className="btn-primary" disabled={busy}>
              <LogIn className="h-4 w-4" /> 진행 모드 켜기
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ProjectorQuestion({ state, answered, timerSync }: { state: ClassState; answered: number | null; timerSync: number | null }) {
  const q = state.question!;
  const paused = state.status === 'PAUSED';
  const { remainingMs, beforeStartMs } = useCountdown({ endTime: state.endTime, startTime: state.startTime, running: !paused, frozenMs: state.remainingMs, serverNow: timerSync ?? state.serverNow });
  return (
    <div className="flex flex-1 flex-col gap-6 [@media(max-height:820px)]:gap-3">
      <DoublePointsBanner show={q.isDoublePoints && beforeStartMs > 0} />
      <div className="flex items-center justify-between text-3xl text-slate-800 md:text-4xl [@media(max-height:820px)]:text-2xl">
        <span className="font-display">
          문제 {q.index + 1} / {state.totalQuestions}
        </span>
        {q.isDoublePoints && <span className="rounded-full border border-amber-300 bg-amber-50 px-4 py-1 font-bold text-amber-900"><BoltIcon className="mr-1 inline h-5 w-5" aria-hidden="true" />2배 점수</span>}
        <span className="font-bold">
          제출 {answered ?? state.answeredCount}/{state.participantCount}명
        </span>
      </div>
      <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="glass-strong overflow-hidden text-center">
        <div className="p-8 [@media(max-height:820px)]:p-4">
          <h2 className="break-keep text-4xl font-black leading-tight text-slate-900 md:text-6xl [@media(max-height:820px)]:text-4xl">{q.text}</h2>
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
          <div className="font-display text-3xl text-brand-600 md:text-5xl">단답형 문제</div>
          <p className="text-xl font-medium text-slate-600 md:text-2xl">각자 화면에 정답을 직접 입력해 제출하세요!</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-4 [@media(max-height:820px)]:gap-3">
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
        <Logo size="md" />
        <h1 className="font-display text-3xl text-slate-900 md:text-5xl">{data.competition.title}</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setQrOpen(true)}>
            <QrCodeIcon className="h-4 w-4 text-brand-600" /> 결과 QR
          </button>
          <button className="btn-ghost" onClick={() => setView(view === 'class' ? 'individual' : 'class')}>
            {view === 'class' ? '개인 순위 보기' : '학급 순위 보기'}
          </button>
          <FullscreenButton />
        </div>
      </header>
      {data.fairnessWarning && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-lg font-semibold text-amber-900"><WarnIcon className="mr-1.5 inline h-6 w-6 align-[-4px]" aria-hidden="true" />{data.fairnessWarning}</div>
      )}
      <AnimatePresence mode="wait">
        {view === 'class' ? (
          <motion.div key="class" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }} className="glass-strong flex-1 p-6">
            <h2 className="mb-4 font-display text-4xl text-slate-900"><SchoolIcon className="mr-2 inline h-9 w-9 text-brand-600" aria-hidden="true" />학급 순위 (평균 점수)</h2>
            <div className="space-y-3">
              {data.classRanking.map((c, i) => {
                const max = Math.max(1, ...data.classRanking.map((x) => x.averageScore));
                return (
                  <motion.div key={c.classId} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.25, ease: [0.23, 1, 0.32, 1] }} className="flex items-center gap-4 text-2xl text-slate-900">
                    <span className="w-14 font-display text-3xl text-brand-600">{c.rank}위</span>
                    <span className="w-36 font-bold">{classDisplayName(c.classId)}</span>
                    <div className="h-10 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: c.averageScore / max }} transition={{ duration: 0.6, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }} style={{ transformOrigin: 'left' }} className="h-full rounded-full bg-brand-600" />
                    </div>
                    <span className="w-32 text-right font-display">{num(Math.round(c.averageScore))}점</span>
                    <span className="w-20 text-right text-lg text-slate-500">{c.participantCount}명</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="ind" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }} className="flex flex-1 flex-col gap-6">
            <h2 className="text-center font-display text-4xl text-slate-900"><CupIcon className="mr-2 inline h-9 w-9 text-amber-500" aria-hidden="true" />전체 개인 순위</h2>
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
