import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, LogIn, PauseCircle, PartyPopper, RefreshCw, Trophy, Users, WifiOff, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CLASS_CAPACITY, classDisplayName, formatStudentNickname, isValidClassId, type ClassState } from '@shared/types/index';
import { Logo } from '../components/common/Logo';
import { StatusBadge } from '../components/common/StatusBadge';
import { FullScreenSpinner } from '../components/common/Spinner';
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
  NEW_SESSION: '선생님이 새 퀴즈를 준비했습니다. 다시 입장해 주세요.',
  REMOVED: '선생님이 참가 목록에서 제외했습니다.',
  PARTICIPANTS_REMOVED: '학급 기록이 초기화되었습니다. 다시 입장해 주세요.',
  SESSION_CHANGED: '퀴즈 세션이 변경되었습니다. 다시 입장해 주세요.',
  INVALID_PARTICIPANT: '입장 정보가 만료되었습니다. 다시 입장해 주세요.',
  INVALID_ROOM_ACCESS: '다른 학급의 입장 정보입니다. 다시 입장해 주세요.',
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

// ───────────────────────── 입장 폼 ─────────────────────────

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
    if (!trimmedName) return setError('이름을 입력하세요.');
    if (trimmedName.length > 14) return setError('이름은 14자 이하로 입력하세요.');
    if (!/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.\-]+$/.test(trimmedName)) {
      return setError('이름에는 한글, 영문, 숫자만 사용할 수 있습니다.');
    }
    const nickname = formatStudentNickname(grade, classNum, studentNum, trimmedName);
    setBusy(true);
    try {
      const r = await studentApi.post(`/classes/${classId}/join`, { nickname });
      onJoined({ participantId: r.data.participantId, token: r.data.token, nickname: r.data.nickname, sessionId: r.data.sessionId });
    } catch (err) {
      setError(errorMessage(err, '입장하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const full = info ? info.participantCount >= info.capacity : false;
  const closed = info?.status === 'FINISHED' || info?.status === 'NO_SESSION';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <motion.form onSubmit={submit} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong w-full max-w-md space-y-5 p-8 text-center">
        <div>
          <div className="font-display text-4xl text-white">{classDisplayName(classId)}</div>
          {info && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70">
              <StatusBadge status={info.status} />
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" /> {info.participantCount}/{info.capacity}명
              </span>
            </div>
          )}
          {info?.competitionTitle && <p className="mt-2 text-white/60">{info.competitionTitle}</p>}
        </div>
        {notice && <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-100">{notice}</p>}
        <div className="grid grid-cols-3 gap-2.5 text-left">
          <div>
            <label className="label" htmlFor="join-studentNum">
              번호
            </label>
            <select
              id="join-studentNum"
              className="input font-semibold"
              value={studentNum}
              onChange={(e) => {
                setStudentNum(Number(e.target.value));
                if (error) setError('');
              }}
              disabled={closed || full}
            >
              {Array.from({ length: info?.capacity ?? CLASS_CAPACITY }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}번
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="join-studentName">
              이름
            </label>
            <input
              id="join-studentName"
              className="input font-bold"
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
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-950/70 px-4 py-2.5 text-sm">
          <span className="text-slate-400">자동 생성 닉네임</span>
          <span className={`font-mono font-bold ${generatedNickname ? 'text-blue-300' : 'text-slate-500'}`}>
            {generatedNickname || `${studentIdPrefix} 홍길동`}
          </span>
        </div>
        {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <button className="btn-primary w-full py-3 text-xl" disabled={busy || closed || full}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          {closed ? (info?.status === 'FINISHED' ? '퀴즈가 종료되었습니다' : '퀴즈 준비 중') : full ? '정원 마감' : '입장하기'}
        </button>
        <Link to="/" className="block text-sm text-white/50 hover:text-white">
          ← 처음 화면으로
        </Link>
      </motion.form>
    </div>
  );
}

// ───────────────────────── 퀴즈 진행 화면 ─────────────────────────

function QuizRoom({ classId, creds, onInvalid }: { classId: string; creds: StudentCreds; onInvalid: (r: string) => void }) {
  const q = useStudentQuiz(classId, creds, onInvalid);
  const { state, conn } = q;

  if (conn === 'replaced') {
    return (
      <Centered>
        <WifiOff className="mx-auto h-14 w-14 text-amber-300" />
        <h2 className="font-display text-3xl">다른 창에서 접속 중</h2>
        <p className="text-white/70">같은 참가자가 다른 창(기기)에서 접속하여 이 화면의 연결이 종료되었습니다.</p>
        <button className="btn-primary" onClick={q.reconnect}>
          <RefreshCw className="h-5 w-5" /> 이 화면에서 계속하기
        </button>
      </Centered>
    );
  }
  if (!state) return <FullScreenSpinner label="퀴즈 서버에 연결하는 중…" />;

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-3 py-4 md:px-6">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl md:text-2xl">{state.className}</span>
          <StatusBadge status={state.status} />
        </div>
        <div className="glass flex items-center gap-3 rounded-2xl px-3 py-1.5 text-sm">
          <span className="max-w-44 truncate font-bold">{creds.nickname}</span>
          <span className="font-display text-lg text-neon-yellow tabular-nums">{num(q.myTotal)}점</span>
          {q.myRank && state.status !== 'PLAYING' && state.status !== 'PAUSED' && <span className="text-white/60">{q.myRank}위</span>}
        </div>
      </header>

      <AnimatePresence>
        {conn === 'reconnecting' && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 px-3 py-2 text-sm text-amber-100">
            <Loader2 className="h-4 w-4 animate-spin" /> 연결이 끊어졌습니다. 자동으로 재연결 중… (점수는 안전하게 저장되어 있어요)
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-1 flex-col">
        {state.status === 'WAITING' && <WaitingRoom state={state} participants={q.participants} me={creds.participantId} />}
        {state.status === 'NO_SESSION' && <Centered>퀴즈가 준비되지 않았습니다.</Centered>}
        {(state.status === 'PLAYING' || state.status === 'PAUSED') && state.question && (
          <QuestionScreen state={state} answered={q.answered} mySubmit={q.mySubmit} submit={q.submit} timerSync={q.timerSync} />
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
    <div className="flex flex-1 flex-col items-center gap-6 py-6 text-center">
      <div className="font-display text-4xl md:text-5xl">
        곧 퀴즈가 시작돼요!
      </div>
      <p className="text-white/70">
        {state.competitionTitle} · {state.quizSetTitle} ({state.totalQuestions}문항)
      </p>
      <div className="glass w-full p-4">
        <div className="mb-3 flex items-center justify-center gap-2 font-bold">
          <Users className="h-5 w-5" /> 참가자 {participants.length || state.participantCount}/{state.capacity}명
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
                className={`rounded-full px-3 py-1 text-sm font-bold ${p.id === me ? 'bg-cyan-400 text-ink-950' : 'bg-white/10'} ${p.connected ? '' : 'opacity-40'}`}
              >
                {p.nickname}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex items-center gap-2 text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" /> 선생님이 시작하기를 기다리는 중
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
}: {
  state: ClassState;
  answered: { answeredCount: number; participantCount: number } | null;
  mySubmit: MySubmission | null;
  submit: (qid: number, answer: number | string) => Promise<{ ok: boolean; message?: string }>;
  timerSync: { serverNow: number; endTime: number } | null;
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
    if (!text) return toast('답안을 입력하세요.', 'error');
    setSending(true);
    const r = await submit(question.id, text);
    setSending(false);
    if (!r.ok) toast(r.message ?? '제출하지 못했습니다.', 'error');
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DoublePointsBanner show={question.isDoublePoints && notStarted} />
      <div className="flex items-center justify-between text-sm text-white/70">
        <span className="font-display text-lg text-white">
          문제 {question.index + 1} / {state.totalQuestions}
        </span>
        {question.isDoublePoints && <span className="rounded-full bg-neon-yellow px-3 py-0.5 font-bold text-ink-950">⚡ 2배 점수</span>}
        {question.category && <span className="rounded-full bg-white/10 px-3 py-0.5">{question.category}</span>}
      </div>
      <motion.div key={question.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong p-5 text-center md:p-8">
        <h2 className="break-keep text-2xl font-black leading-snug md:text-4xl">{question.text}</h2>
      </motion.div>
      <TimerBar remainingMs={notStarted ? totalMs : remainingMs} totalMs={totalMs} />

      {paused && (
        <div className="glass flex items-center justify-center gap-2 py-3 text-lg font-bold text-amber-200">
          <PauseCircle className="h-6 w-6" /> 선생님이 퀴즈를 잠시 멈췄어요
        </div>
      )}

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-strong flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <CheckCircle2 className="h-20 w-20 text-emerald-400" />
            <div className="font-display text-3xl md:text-4xl">제출 완료!</div>
            {isShort ? (
              <div className="w-full max-w-md rounded-2xl border border-neon-cyan/50 bg-cyan-400/15 px-5 py-4 text-xl font-bold">
                내 답안: <span className="text-neon-cyan">{submitted.answerText ?? ''}</span>
              </div>
            ) : (
              submitted.selectedIndex !== null && (
                <AnswerButton index={submitted.selectedIndex} text={question.options[submitted.selectedIndex]} mode="selected" disabled />
              )
            )}
            <p className="text-white/60">
              다른 친구들을 기다리는 중… {answered && `(${answered.answeredCount}/${answered.participantCount}명 제출)`}
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
            <label className="label text-base" htmlFor="short-answer-input">
              정답을 직접 입력하세요
            </label>
            <input
              id="short-answer-input"
              className="input max-w-lg text-center text-2xl font-bold"
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
              className="btn-primary w-full max-w-lg py-3 text-xl"
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
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>{timeUp ? '시간 종료 — 결과를 기다리는 중' : notStarted ? '곧 시작합니다…' : `지금 맞히면 약 ${num(expected)}점 (예상)`}</span>
          {answered && (
            <span>
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
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={`flex flex-col items-center gap-2 rounded-2xl border p-6 text-center ${correct ? 'border-emerald-400/35 bg-emerald-500/15' : 'border-rose-400/35 bg-rose-500/15'}`}
      >
        {correct ? <CheckCircle2 className="h-16 w-16 text-lime-300" /> : <XCircle className="h-16 w-16 text-rose-300" />}
        <div className="font-display text-4xl">{correct ? '정답!' : submitted ? '아쉬워요!' : '시간 초과'}</div>
        {mine && (
          <div className="text-xl">
            <b className="text-neon-yellow">+{num(mine.awardedScore ?? 0)}점</b> · 총 {num(mine.totalScore)}점 · <b>{mine.rank}위</b>
            {mine.prevRank != null && mine.prevRank !== mine.rank && (
              <span className={mine.prevRank > mine.rank ? 'ml-2 text-lime-300' : 'ml-2 text-rose-300'}>
                ({mine.prevRank > mine.rank ? '▲' : '▼'}
                {Math.abs(mine.prevRank - mine.rank)})
              </span>
            )}
          </div>
        )}
      </motion.div>
      <div className="glass p-4">
        <p className="mb-3 text-center font-bold">{question.text}</p>
        {isShort ? (
          <div className="space-y-2 text-center">
            <div className="rounded-2xl bg-lime-400/20 px-4 py-3 text-lg font-bold text-lime-100 ring-1 ring-lime-300">
              정답: {(r.acceptedAnswers ?? []).join(' / ')}
            </div>
            {submitted && (
              <div className={`rounded-2xl px-4 py-2 text-base font-semibold ${correct ? 'bg-lime-400/10 text-lime-200' : 'bg-rose-500/15 text-rose-200'}`}>
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
        {r.explanation && <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-white/80">💡 {r.explanation}</p>}
      </div>
      <div className="glass p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xl">
          <Trophy className="h-5 w-5 text-neon-yellow" /> 현재 순위
        </h3>
        <Leaderboard entries={state.leaderboard} highlightId={me} />
      </div>
      <p className="text-center text-sm text-white/50">선생님이 다음 문제를 준비 중입니다…</p>
    </div>
  );
}

function FinalScreen({ state, me, myTotal, myRank }: { state: ClassState; me: number; myTotal: number; myRank: number | null }) {
  const mine = useMemo(() => state.leaderboard.find((e) => e.participantId === me), [state.leaderboard, me]);
  return (
    <div className="flex flex-1 flex-col gap-6 py-4">
      <div className="text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-amber-400" />
        <h2 className="mt-1 font-display text-4xl md:text-5xl">최종 결과</h2>
      </div>
      <Podium entries={state.leaderboard} />
      <div className="glass-strong p-5 text-center">
        <div className="text-white/60">나의 최종 기록</div>
        <div className="font-display text-5xl text-neon-yellow">{num(mine?.totalScore ?? myTotal)}점</div>
        <div className="text-xl font-bold">
          {mine?.rank ?? myRank ?? '-'}위 / {state.participantCount}명 · 정답 {mine?.correctCount ?? 0}/{state.totalQuestions}
        </div>
      </div>
      <div className="glass p-4">
        <Leaderboard entries={state.leaderboard} highlightId={me} showLast={false} />
      </div>
    </div>
  );
}
