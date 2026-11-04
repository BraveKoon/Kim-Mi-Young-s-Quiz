import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Loader2,
  LogIn,
  PartyPopper,
  PauseCircle,
  PencilLine,
  RefreshCw,
  Trophy,
  Users,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CLASS_CAPACITY, classDisplayName, formatStudentNickname, isValidClassId, type ClassState } from '@shared/types/index';
import { ClassroomAccentStrip, Logo } from '../components/common/Logo';
import { FullScreenSpinner } from '../components/common/Spinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Leaderboard } from '../components/leaderboard/Leaderboard';
import { Podium } from '../components/leaderboard/Podium';
import { AnswerButton } from '../components/quiz/AnswerButton';
import { DoublePointsBanner } from '../components/quiz/DoublePointsBanner';
import { TimerBar } from '../components/quiz/TimerBar';
import { useToast } from '../contexts/ToastContext';
import { useCountdown } from '../hooks/useCountdown';
import { credStore, useStudentQuiz, type MyResult, type MySubmission, type StudentCreds } from '../hooks/useStudentQuiz';
import { errorMessage, studentApi } from '../services/api';
import { celebrate } from '../utils/confetti';
import { num } from '../utils/format';
import NotFoundPage from './NotFoundPage';

const KICK_MESSAGES: Record<string, string> = {
  NEW_SESSION: '선생님이 새 퀴즈를 준비했어요. 다시 입장해 주세요.',
  REMOVED: '선생님이 참가 목록에서 제외했어요.',
  PARTICIPANTS_REMOVED: '학급 기록이 초기화되었어요. 다시 입장해 주세요.',
  SESSION_CHANGED: '퀴즈 세션이 바뀌었어요. 다시 입장해 주세요.',
  INVALID_PARTICIPANT: '입장 정보가 만료되었어요. 다시 입장해 주세요.',
  INVALID_ROOM_ACCESS: '다른 학급의 입장 정보예요. 다시 입장해 주세요.',
};

export default function ClassPage() {
  const { classId = '' } = useParams();
  if (!isValidClassId(classId)) return <NotFoundPage />;
  return <ClassView key={classId} classId={classId} />;
}

function ClassView({ classId }: { classId: string }) {
  const [creds, setCreds] = useState<StudentCreds | null>(() => credStore.get(classId));
  const [notice, setNotice] = useState('');
  const onInvalid = useCallback(
    (reason: string) => {
      credStore.set(classId, null);
      setCreds(null);
      setNotice(KICK_MESSAGES[reason] ?? '다시 입장해 주세요.');
    },
    [classId],
  );
  if (!creds) {
    return (
      <JoinForm
        classId={classId}
        notice={notice}
        onJoined={(c) => {
          credStore.set(classId, c);
          setNotice('');
          setCreds(c);
        }}
      />
    );
  }
  return <QuizRoom classId={classId} creds={creds} onInvalid={onInvalid} />;
}

// ───────────────────────── 학급 직접 접속 입장 폼 ─────────────────────────

function JoinForm({ classId, notice, onJoined }: { classId: string; notice: string; onJoined: (c: StudentCreds) => void }) {
  const [gradeStr, classNumStr] = classId.split('-');
  const grade = Number(gradeStr);
  const classNum = Number(classNumStr);
  const [studentNum, setStudentNum] = useState<number>(1);
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ status: ClassState['status']; participantCount: number; capacity: number; competitionTitle: string | null } | null>(null);

  useEffect(() => {
    studentApi
      .get(`/classes/${classId}/session`)
      .then((r) => setInfo(r.data.session))
      .catch(() => setInfo(null));
  }, [classId]);

  const trimmedName = studentName.normalize('NFC').replace(/\s+/g, ' ').trim();
  const studentIdPrefix = `${grade}${String(classNum).padStart(2, '0')}${String(studentNum).padStart(2, '0')}`;
  const generatedNickname = trimmedName ? formatStudentNickname(grade, classNum, studentNum, trimmedName) : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!trimmedName) return setError('이름을 입력해 주세요.');
    if (trimmedName.length > 14) return setError('이름은 14자 이하로 입력해 주세요.');
    if (!/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.\-]+$/.test(trimmedName)) {
      return setError('이름에는 한글, 영문, 숫자만 사용할 수 있어요.');
    }
    const nickname = formatStudentNickname(grade, classNum, studentNum, trimmedName);
    setBusy(true);
    try {
      const r = await studentApi.post(`/classes/${classId}/join`, { nickname });
      onJoined({ participantId: r.data.participantId, token: r.data.token, nickname: r.data.nickname, sessionId: r.data.sessionId });
    } catch (err) {
      setError(errorMessage(err, '입장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const capacity = info?.capacity ?? CLASS_CAPACITY;
  const participantCount = info?.participantCount ?? 0;
  const full = info ? participantCount >= capacity : false;
  const closed = info?.status === 'FINISHED' || info?.status === 'NO_SESSION';

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-[#FEF9C3] px-3.5 py-1 text-xs font-bold text-amber-900 shadow-2xs">
          <span>★ {classDisplayName(classId)} 퀴즈 교실</span>
        </div>
        <Logo size="lg" />
        <p className="mt-2 text-sm font-medium text-slate-600 sm:text-base">번호와 이름을 입력하고 바로 퀴즈에 참여해요!</p>
      </header>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full overflow-hidden"
      >
        <ClassroomAccentStrip />

        <div className="space-y-5 p-5 sm:p-7">
          {/* 학급 현황 박스 */}
          <div className="rounded-2xl border border-sky-100 bg-[#F3F9FF] px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block text-[11px] font-bold text-sky-700">입장할 학급</span>
                <h1 className="font-display text-2xl text-slate-900">{classDisplayName(classId)}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {info && <StatusBadge status={info.status} />}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                  <Users className="h-3.5 w-3.5 text-teal-600" />
                  <span>참가</span>
                  <b className={full ? 'text-rose-600' : 'text-blue-700'}>
                    {participantCount}/{capacity}명
                  </b>
                </span>
              </div>
            </div>
            {info?.competitionTitle && <p className="mt-1.5 text-xs font-medium text-slate-600">{info.competitionTitle}</p>}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sky-200/60" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  full ? 'bg-[#FB7185]' : 'bg-gradient-to-r from-[#2563EB] to-[#14B8A6]'
                }`}
                style={{ width: `${Math.min(100, Math.round((participantCount / Math.max(1, capacity)) * 100))}%` }}
              />
            </div>
          </div>

          {notice && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-900">
              {notice}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="label" htmlFor="join-studentNum">
                번호
              </label>
              <div className="relative">
                <select
                  id="join-studentNum"
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-8 text-base font-bold text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100"
                  value={studentNum}
                  onChange={(e) => {
                    setStudentNum(Number(e.target.value));
                    if (error) setError('');
                  }}
                  disabled={closed || full}
                >
                  {Array.from({ length: capacity }, (_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-white text-slate-900">
                      {i + 1}번
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="join-studentName">
                이름
              </label>
              <div className="relative">
                <PencilLine className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#FB7185]" />
                <input
                  id="join-studentName"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 pr-4 pl-10 text-base font-bold text-slate-900 placeholder-slate-400 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="예) 홍길동"
                  value={studentName}
                  maxLength={14}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                  autoComplete="name"
                  disabled={closed || full}
                />
              </div>
            </div>
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 ${
              generatedNickname ? 'border-amber-200 bg-[#FFFDF2]' : 'border-slate-200/90 bg-slate-50/90'
            }`}
          >
            <span className="text-xs font-bold text-slate-700">내 퀴즈 이름표 (자동 생성)</span>
            <span
              className={`rounded-xl border bg-white px-3 py-1 font-mono text-sm font-extrabold ${
                generatedNickname ? 'border-blue-200 text-[#1D4ED8]' : 'border-slate-200 text-slate-400'
              }`}
            >
              {generatedNickname || `${studentIdPrefix} 홍길동`}
            </span>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-center text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}

          <button className="btn-primary h-14 w-full rounded-2xl text-lg font-extrabold" disabled={busy || closed || full || !generatedNickname}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            {closed ? (info?.status === 'FINISHED' ? '이번 퀴즈가 끝났어요' : '선생님이 퀴즈를 준비 중이에요') : full ? '정원 마감' : '입장하기'}
          </button>
        </div>
      </motion.form>

      <footer className="mt-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" /> 다른 학급 선택하기
        </Link>
      </footer>
    </div>
  );
}

// ───────────────────────── 실시간 퀴즈 교실 화면 ─────────────────────────

function QuizRoom({ classId, creds, onInvalid }: { classId: string; creds: StudentCreds; onInvalid: (r: string) => void }) {
  const q = useStudentQuiz(classId, creds, onInvalid);
  const { state, conn } = q;
  // 문제 진행 중의 등수는 서버가 현재 문제 점수를 뺀 "직전 문제까지" 기준이라 정답 여부가 드러나지 않는다. 첫 문제 전에는 등수가 의미 없으므로 숨긴다.
  const hasRank = !!state && (state.questionIndex > 0 || ['RESULT', 'FINISHED'].includes(state.status));

  if (conn === 'replaced') {
    return (
      <Centered>
        <div className="glass-strong max-w-md space-y-4 p-8">
          <WifiOff className="mx-auto h-14 w-14 text-amber-500" />
          <h2 className="font-display text-3xl text-slate-900">다른 창에서 접속 중이에요</h2>
          <p className="text-sm leading-relaxed text-slate-600">같은 참가자가 다른 창이나 기기에서 접속해서 이 화면의 연결이 잠시 멈췄어요.</p>
          <button className="btn-primary w-full" onClick={q.reconnect}>
            <RefreshCw className="h-5 w-5" /> 이 화면에서 계속하기
          </button>
        </div>
      </Centered>
    );
  }
  if (!state) return <FullScreenSpinner label="우리 반 퀴즈 교실에 연결하는 중…" />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-3 py-4 md:px-6 md:py-6">
      <header className="glass mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
          <span className="font-display text-lg text-slate-900 md:text-xl">{state.className}</span>
          <StatusBadge status={state.status} />
        </div>
        <div className="flex items-center gap-2.5 rounded-full border border-sky-200/90 bg-[#F3F9FF] px-3.5 py-1.5 text-sm" aria-label="내 점수와 등수">
          <span className="max-w-44 truncate font-bold text-slate-800">{creds.nickname}</span>
          <span className="font-display text-base text-[#1D4ED8] tabular-nums">{num(q.myTotal)}점</span>
          {q.myRank && hasRank && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-900">{q.myRank}위</span>
          )}
        </div>
      </header>

      <AnimatePresence>
        {conn === 'reconnecting' && (
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-3 flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900"
          >
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" /> 연결이 잠깐 끊어졌어요. 자동으로 다시 연결 중… (점수는 안전하게 저장돼요!)
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-1 flex-col">
        {state.status === 'WAITING' && <WaitingRoom state={state} participants={q.participants} me={creds.participantId} />}
        {state.status === 'NO_SESSION' && (
          <Centered>
            <div className="glass-strong max-w-md p-8">
              <p className="font-display text-2xl text-slate-800">아직 준비된 퀴즈가 없어요</p>
              <p className="mt-2 text-sm text-slate-600">선생님이 세션을 열면 자동으로 화면이 바뀝니다.</p>
            </div>
          </Centered>
        )}
        {(state.status === 'PLAYING' || state.status === 'PAUSED') && state.question && (
          <QuestionScreen state={state} answered={q.answered} mySubmit={q.mySubmit} submit={q.submit} timerSync={q.timerSync} myRank={hasRank ? q.myRank : null} myTotal={q.myTotal} />
        )}
        {state.status === 'RESULT' && <ResultScreen state={state} myResult={q.myResult} mySubmit={q.mySubmit} me={creds.participantId} />}
        {state.status === 'FINISHED' && <FinalScreen state={state} me={creds.participantId} myTotal={q.myTotal} myRank={q.myRank} />}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>;
}

function WaitingRoom({ state, participants, me }: { state: ClassState; participants: { id: number; nickname: string; connected: boolean }[]; me: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-[#FEF9C3] px-3.5 py-1 text-xs font-bold text-amber-900">
        <span>★ 입장 완료! 잠시만 기다려 주세요</span>
      </div>
      <div className="font-display text-4xl text-slate-900 md:text-5xl">곧 퀴즈가 시작돼요!</div>
      <p className="text-sm font-semibold text-slate-600 md:text-base">
        {state.competitionTitle} · {state.quizSetTitle} ({state.totalQuestions}문항)
      </p>

      <div className="glass-strong w-full overflow-hidden">
        <ClassroomAccentStrip />
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-center gap-2 text-sm font-extrabold text-slate-800">
            <Users className="h-5 w-5 text-teal-600" /> 함께 모인 우리 반 친구들 ({participants.length || state.participantCount}/{state.capacity}명)
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <AnimatePresence>
              {participants.map((p) => (
                <motion.span
                  key={p.id}
                  layout
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${
                    p.id === me
                      ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-xs'
                      : 'border-sky-200 bg-[#F3F9FF] text-slate-800'
                  } ${p.connected ? '' : 'opacity-45'}`}
                >
                  {p.nickname}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-2xs">
        <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" /> 선생님이 퀴즈를 시작하기를 기다리는 중이에요
      </div>
    </div>
  );
}

function QuestionScreen({
  state,
  answered,
  mySubmit,
  submit,
  timerSync,
  myRank,
  myTotal,
}: {
  state: ClassState;
  answered: { answeredCount: number; participantCount: number } | null;
  mySubmit: MySubmission | null;
  submit: (qid: number, answer: number | string) => Promise<{ ok: boolean; message?: string }>;
  timerSync: { serverNow: number; endTime: number } | null;
  myRank: number | null;
  myTotal: number;
}) {
  const toast = useToast();
  const question = state.question!;
  const isShort = question.questionType === 'SHORT_ANSWER';
  const paused = state.status === 'PAUSED';
  const syncNow = timerSync && timerSync.endTime === state.endTime ? timerSync.serverNow : state.serverNow;
  const { remainingMs, beforeStartMs } = useCountdown({ endTime: state.endTime, startTime: state.startTime, running: !paused, frozenMs: state.remainingMs, serverNow: syncNow });
  const totalMs = question.timeLimit * 1000;
  const submitted = mySubmit?.questionId === question.id ? mySubmit : null;
  const [sending, setSending] = useState(false);
  const [shortText, setShortText] = useState('');
  const notStarted = beforeStartMs > 0;
  const timeUp = remainingMs <= 0 && !paused;

  useEffect(() => {
    setShortText('');
  }, [question.id]);

  // 예상 점수(참고용): 실제 점수는 서버 계산값
  const elapsedSec = Math.max(0, totalMs - remainingMs) / 1000;
  const expected = Math.max(500, Math.round(1000 * (1 - elapsedSec / (question.timeLimit * 2)))) * (question.isDoublePoints ? 2 : 1);

  const choose = async (idx: number) => {
    if (submitted || sending || paused || notStarted || timeUp) return;
    setSending(true);
    const r = await submit(question.id, idx);
    setSending(false);
    if (!r.ok) toast(r.message ?? '제출하지 못했습니다.', 'error');
  };

  const submitShort = async (e: FormEvent) => {
    e.preventDefault();
    if (submitted || sending || paused || notStarted || timeUp) return;
    const text = shortText.trim();
    if (!text) return toast('답안을 입력해 주세요.', 'error');
    setSending(true);
    const r = await submit(question.id, text);
    setSending(false);
    if (!r.ok) toast(r.message ?? '제출하지 못했습니다.', 'error');
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DoublePointsBanner show={question.isDoublePoints && notStarted} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span className="font-display text-lg text-slate-900">
          문제 {question.index + 1} / {state.totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          {question.isDoublePoints && (
            <span className="rounded-full border border-amber-300 bg-[#FEF9C3] px-3 py-0.5 text-xs font-extrabold text-amber-900">
              ⚡ 2배 점수 찬스
            </span>
          )}
          {question.category && (
            <span className="rounded-full border border-sky-200 bg-[#F3F9FF] px-3 py-0.5 text-xs font-bold text-sky-800">
              {question.category}
            </span>
          )}
        </div>
      </div>

      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong overflow-hidden text-center"
      >
        <ClassroomAccentStrip />
        <div className="p-5 md:p-8">
          <h2 className="break-keep text-2xl font-black leading-snug text-slate-900 md:text-4xl">{question.text}</h2>
        </div>
      </motion.div>

      <TimerBar remainingMs={notStarted ? totalMs : remainingMs} totalMs={totalMs} />

      {paused && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 py-3 text-lg font-bold text-amber-900">
          <PauseCircle className="h-6 w-6 text-amber-600" /> 선생님이 퀴즈를 잠시 멈췄어요
        </div>
      )}

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="done"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-strong flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
          >
            <CheckCircle2 className="h-20 w-20 text-teal-500" />
            <div className="font-display text-3xl text-slate-900 md:text-4xl">답안 제출 완료!</div>
            {isShort ? (
              <div className="w-full max-w-md rounded-2xl border border-sky-200 bg-[#F3F9FF] px-5 py-4 text-xl font-bold text-slate-800">
                내 답안: <span className="text-[#1D4ED8]">{submitted.answerText ?? ''}</span>
              </div>
            ) : (
              submitted.selectedIndex !== null && (
                <AnswerButton index={submitted.selectedIndex} text={question.options[submitted.selectedIndex]} mode="selected" disabled />
              )
            )}
            {myRank !== null && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-[#FEF9C3] px-5 py-3 text-amber-900" data-testid="my-rank-card">
                <Trophy className="h-6 w-6 text-amber-600" />
                <div className="text-left leading-tight">
                  <div className="text-xs font-bold">내 등수 (직전 문제까지)</div>
                  <div className="font-display text-2xl tabular-nums">
                    {myRank}위 <span className="text-base font-bold text-amber-800">/ {state.participantCount}명 · {num(myTotal)}점</span>
                  </div>
                </div>
              </div>
            )}
            <p className="text-sm font-medium text-slate-600">
              다른 친구들을 기다리는 중이에요… {answered && `(${answered.answeredCount}/${answered.participantCount}명 제출)`}
            </p>
          </motion.div>
        ) : isShort ? (
          <motion.form
            key="short-form"
            onSubmit={submitShort}
            className="glass-strong flex flex-1 flex-col items-center justify-center gap-4 p-6 md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <label className="text-base font-bold text-slate-700" htmlFor="short-answer-input">
              정답을 직접 입력해 주세요
            </label>
            <input
              id="short-answer-input"
              className="input h-14 max-w-lg text-center text-2xl font-bold"
              placeholder="정답 입력 (최대 120자)"
              value={shortText}
              maxLength={120}
              onChange={(e) => setShortText(e.target.value)}
              autoFocus
              autoComplete="off"
              disabled={sending || paused || notStarted || timeUp}
            />
            <button
              type="submit"
              className="btn-primary h-14 w-full max-w-lg rounded-2xl text-xl font-extrabold"
              disabled={sending || paused || notStarted || timeUp || !shortText.trim()}
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              답안 제출하기
            </button>
          </motion.form>
        ) : (
          <motion.div key="choices" className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {question.options.map((opt, i) => (
              <AnswerButton key={i} index={i} text={opt} mode={sending ? 'dim' : 'idle'} disabled={sending || paused || notStarted || timeUp} onClick={() => choose(i)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!submitted && (
        <div className="flex items-center justify-between text-sm font-medium text-slate-600">
          <span>{timeUp ? '시간 종료 — 결과를 기다리는 중이에요' : notStarted ? '곧 시작합니다…' : `지금 맞히면 약 ${num(expected)}점 (예상)`}</span>
          {answered && (
            <span className="font-bold text-slate-700">
              {answered.answeredCount}/{answered.participantCount}명 제출
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ResultScreen({ state, myResult, mySubmit, me }: { state: ClassState; myResult: MyResult | null; mySubmit: MySubmission | null; me: number }) {
  const r = state.results!;
  const question = state.question!;
  const isShort = question.questionType === 'SHORT_ANSWER';
  const mine = myResult && myResult.questionId === question.id ? myResult : null;
  const selected = mine?.selectedIndex ?? (mySubmit?.questionId === question.id ? mySubmit.selectedIndex : null);
  const myAnswerText = mine?.answerText ?? (mySubmit?.questionId === question.id ? mySubmit.answerText : null);
  const correct = mine?.isCorrect ?? (!isShort && selected !== null && selected === r.correctIndex);
  const submitted = mine?.submitted ?? (isShort ? !!myAnswerText : selected !== null);

  useEffect(() => {
    if (correct) celebrate(false);
  }, [correct, question.id]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={`flex flex-col items-center gap-2 rounded-3xl border p-6 text-center shadow-xs ${
          correct ? 'border-teal-200 bg-teal-50/90 text-teal-950' : 'border-rose-200 bg-rose-50/90 text-rose-950'
        }`}
      >
        {correct ? <CheckCircle2 className="h-16 w-16 text-teal-600" /> : <XCircle className="h-16 w-16 text-rose-500" />}
        <div className="font-display text-4xl">{correct ? '정답이에요!' : submitted ? '아쉬워요!' : '시간이 지났어요'}</div>
        {mine && (
          <div className="text-lg font-semibold text-slate-800 sm:text-xl">
            <b className="text-[#1D4ED8]">+{num(mine.awardedScore ?? 0)}점</b> · 총 {num(mine.totalScore)}점 · <b>{mine.rank}위</b>
            {mine.prevRank != null && mine.prevRank !== mine.rank && (
              <span className={mine.prevRank > mine.rank ? 'ml-2 font-extrabold text-teal-700' : 'ml-2 font-extrabold text-rose-600'}>
                ({mine.prevRank > mine.rank ? '▲' : '▼'}
                {Math.abs(mine.prevRank - mine.rank)})
              </span>
            )}
          </div>
        )}
      </motion.div>

      <div className="glass p-4 sm:p-5">
        <p className="mb-3 text-center text-lg font-extrabold text-slate-900">{question.text}</p>
        {isShort ? (
          <div className="space-y-2 text-center">
            <div className="rounded-2xl border border-teal-300 bg-teal-50 px-4 py-3 text-lg font-extrabold text-teal-900">
              정답: {(r.acceptedAnswers ?? []).join(' / ')}
            </div>
            {submitted && (
              <div
                className={`rounded-2xl border px-4 py-2 text-base font-bold ${
                  correct ? 'border-teal-200 bg-teal-50/60 text-teal-800' : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                내 답안: {myAnswerText ?? '-'}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {question.options.map((o, i) => (
              <AnswerButton key={i} index={i} text={o} disabled count={r.distribution[i]} mode={i === r.correctIndex ? 'correct' : i === selected ? 'wrong' : 'dim'} />
            ))}
          </div>
        )}
        {r.explanation && (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-[#FFFDF2] p-3.5 text-sm leading-relaxed font-medium text-slate-800">
            💡 {r.explanation}
          </p>
        )}
      </div>

      <div className="glass p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xl text-slate-900">
          <Trophy className="h-5 w-5 text-amber-500" /> 우리 반 현재 순위
        </h3>
        <Leaderboard entries={state.leaderboard} highlightId={me} />
      </div>
      <p className="text-center text-sm font-medium text-slate-500">선생님이 다음 문제를 준비하고 있어요…</p>
    </div>
  );
}

function FinalScreen({ state, me, myTotal, myRank }: { state: ClassState; me: number; myTotal: number; myRank: number | null }) {
  const mine = useMemo(() => state.leaderboard.find((e) => e.participantId === me), [state.leaderboard, me]);
  return (
    <div className="flex flex-1 flex-col gap-6 py-4">
      <div className="text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-[#FB7185]" />
        <h2 className="mt-1 font-display text-4xl text-slate-900 md:text-5xl">최종 결과 발표</h2>
      </div>
      <Podium entries={state.leaderboard} />
      <div className="glass-strong overflow-hidden text-center">
        <ClassroomAccentStrip />
        <div className="p-6">
          <div className="text-sm font-bold text-slate-500">나의 최종 기록</div>
          <div className="mt-1 font-display text-5xl text-[#2563EB]">{num(mine?.totalScore ?? myTotal)}점</div>
          <div className="mt-1 text-lg font-extrabold text-slate-800">
            {mine?.rank ?? myRank ?? '-'}위 / {state.participantCount}명 · 정답 {mine?.correctCount ?? 0}/{state.totalQuestions}
          </div>
        </div>
      </div>
      <div className="glass p-4 sm:p-5">
        <Leaderboard entries={state.leaderboard} highlightId={me} showLast={false} />
      </div>
    </div>
  );
}
