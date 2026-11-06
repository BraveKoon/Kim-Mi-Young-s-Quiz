import { ArrowRight, ChevronDown, Loader2, LogIn, PencilLine, Shield, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CLASS_CAPACITY, CLASS_COUNT, GRADE, classDisplayName, formatStudentNickname, type SessionStatus } from '@shared/types/index';
import { Logo } from '../components/common/Logo';
import { StartScreen } from '../components/common/StartScreen';
import { useInterval } from '../hooks/useInterval';
import { credStore } from '../hooks/useStudentQuiz';
import { errorMessage, studentApi } from '../services/api';

interface LobbyClass {
  classId: string;
  className: string;
  capacity: number;
  status: SessionStatus | 'NO_SESSION';
  participantCount: number;
  connectedCount: number;
  joinable: boolean;
}

/** 같은 탭에서는 시작 화면을 한 번만 보여 주기 위한 표시 (새 탭·새 방문에서는 다시 보임) */
const START_KEY = 'quizbeat.started';

const NAME_PATTERN = /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.\-]+$/;

const CLASSROOM_STATUS_META: Record<
  SessionStatus | 'NO_SESSION',
  { label: string; badgeClass: string; dotClass: string; pulse?: boolean }
> = {
  WAITING: {
    label: '입장 가능 · 대기 중',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  PLAYING: {
    label: '퀴즈 진행 중',
    badgeClass: 'border-brand-200 bg-brand-50 text-brand-800',
    dotClass: 'bg-brand-600',
    pulse: true,
  },
  RESULT: {
    label: '결과 확인 중',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-800',
    dotClass: 'bg-brand-500',
  },
  PAUSED: {
    label: '잠시 멈춤',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    dotClass: 'bg-amber-500',
  },
  FINISHED: {
    label: '퀴즈 종료',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
    dotClass: 'bg-slate-400',
  },
  NO_SESSION: {
    label: '선생님 준비 중',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    dotClass: 'bg-amber-400',
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<number>(GRADE);
  const [classNum, setClassNum] = useState<number>(1);
  const [studentNum, setStudentNum] = useState<number>(1);
  const [studentName, setStudentName] = useState('');
  const [classes, setClasses] = useState<LobbyClass[] | null>(null);
  const [serverError, setServerError] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(() => {
    try {
      return sessionStorage.getItem(START_KEY) === '1';
    } catch {
      return false;
    }
  });
  const start = () => {
    try {
      sessionStorage.setItem(START_KEY, '1');
    } catch {
      /* 저장소를 쓸 수 없어도 시작 화면만 넘어가면 된다 */
    }
    setStarted(true);
  };

  const load = () =>
    studentApi
      .get('/classes')
      .then((r) => {
        setClasses(r.data.classes);
        setServerError(false);
      })
      .catch(() => setServerError(true));

  useEffect(() => {
    load();
  }, []);
  useInterval(load, 5000);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    meta?.setAttribute('content', '#f6f6f8');
    return () => {
      if (prev) meta?.setAttribute('content', prev);
    };
  }, []);

  const classId = `${grade}-${classNum}`;
  const selectedClass = useMemo(() => classes?.find((c) => c.classId === classId) ?? null, [classes, classId]);
  const savedCreds = useMemo(() => credStore.get(classId), [classId]);

  const trimmedName = studentName.normalize('NFC').replace(/\s+/g, ' ').trim();
  const studentIdPrefix = `${grade}${String(classNum).padStart(2, '0')}${String(studentNum).padStart(2, '0')}`;
  const generatedNickname = trimmedName ? formatStudentNickname(grade, classNum, studentNum, trimmedName) : '';

  const capacity = selectedClass?.capacity ?? CLASS_CAPACITY;
  const participantCount = selectedClass?.participantCount ?? 0;
  const full = selectedClass ? participantCount >= capacity : false;
  const closed = selectedClass ? selectedClass.status === 'FINISHED' || selectedClass.status === 'NO_SESSION' : false;
  const statusMeta = CLASSROOM_STATUS_META[selectedClass?.status ?? 'WAITING'];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!trimmedName) return setFormError('이름을 입력해 주세요.');
    if (trimmedName.length > 14) return setFormError('이름은 14자 이하로 입력해 주세요.');
    if (!NAME_PATTERN.test(trimmedName)) return setFormError('이름에는 한글, 영문, 숫자만 사용할 수 있어요.');

    const nickname = formatStudentNickname(grade, classNum, studentNum, trimmedName);
    setBusy(true);
    try {
      const r = await studentApi.post(`/classes/${classId}/join`, { nickname });
      credStore.set(classId, {
        participantId: r.data.participantId,
        token: r.data.token,
        nickname: r.data.nickname,
        sessionId: r.data.sessionId,
      });
      navigate(`/${classId}`);
    } catch (err) {
      setFormError(errorMessage(err, '입장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  if (!started) return <StartScreen onStart={start} />;

  return (
    <div className="min-h-dvh w-full bg-[#f6f6f8] text-slate-900">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* 상단 브랜드 및 환영 문구 */}
        <header className="mb-7 flex flex-col items-center text-center sm:mb-8">
          <Logo size="lg" />
          <p className="mt-3 text-[15px] leading-relaxed font-medium text-slate-600 sm:text-base">
            학번과 이름을 입력하고 우리 반 퀴즈에 참여하세요.
          </p>
        </header>

        {/* 메인 입장 카드 */}
        <form
          onSubmit={submit}
          className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="space-y-6 p-5 sm:p-7">
            {/* 현재 학급 · 퀴즈 상태 · 참가 인원 패널 */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <span className="block text-[11px] font-bold tracking-wide text-slate-700">현재 선택한 학급</span>
                  <div className="mt-0.5 font-display text-2xl text-slate-900">{classDisplayName(classId)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedClass ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusMeta.badgeClass}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${statusMeta.dotClass} ${statusMeta.pulse ? 'animate-pulse' : ''}`}
                      />
                      {statusMeta.label}
                    </span>
                  ) : serverError ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      교실 연결 확인 중
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      입장 가능 · 대기 중
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>참가</span>
                    <b className={full ? 'text-rose-600' : 'text-brand-700'}>
                      {participantCount}/{capacity}명
                    </b>
                  </span>
                </div>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    full ? 'bg-rose-400' : 'bg-brand-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((participantCount / Math.max(1, capacity)) * 100))}%` }}
                />
              </div>
            </div>

            {/* 이전 입장 기록 빠른 복귀 배너 */}
            {savedCreds && (
              <Link
                to={`/${classId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100/70"
              >
                <span>
                  방금 입장한 기록이 있어요 (<b className="font-extrabold text-emerald-800">{savedCreds.nickname}</b>)
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700">
                  이어하기 <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            )}

            {/* 1단계: 학년 · 반 · 번호 선택 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                  1
                </span>
                <span className="text-sm font-bold text-slate-800">우리 반과 번호를 골라 주세요</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600" htmlFor="grade">
                    학년
                  </label>
                  <div className="relative">
                    <select
                      id="grade"
                      className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-8 text-base font-bold text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-brand-600 focus:bg-white focus:ring-3 focus:ring-brand-500/15"
                      value={grade}
                      onChange={(e) => {
                        setGrade(Number(e.target.value));
                        setFormError('');
                      }}
                    >
                      <option value={GRADE} className="bg-white text-slate-900">
                        {GRADE}학년
                      </option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600" htmlFor="classNum">
                    반
                  </label>
                  <div className="relative">
                    <select
                      id="classNum"
                      className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-8 text-base font-bold text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-brand-600 focus:bg-white focus:ring-3 focus:ring-brand-500/15"
                      value={classNum}
                      onChange={(e) => {
                        setClassNum(Number(e.target.value));
                        setFormError('');
                      }}
                    >
                      {Array.from({ length: CLASS_COUNT }, (_, i) => {
                        const num = i + 1;
                        const info = classes?.find((c) => c.classId === `${grade}-${num}`);
                        const suffix = info
                          ? info.participantCount >= info.capacity
                            ? ' (마감)'
                            : info.status === 'FINISHED'
                              ? ' (종료)'
                              : info.status === 'NO_SESSION'
                                ? ' (준비중)'
                                : ''
                          : '';
                        return (
                          <option key={num} value={num} className="bg-white text-slate-900">
                            {num}반{suffix}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600" htmlFor="studentNum">
                    번호
                  </label>
                  <div className="relative">
                    <select
                      id="studentNum"
                      className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-8 text-base font-bold text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-brand-600 focus:bg-white focus:ring-3 focus:ring-brand-500/15"
                      value={studentNum}
                      onChange={(e) => {
                        setStudentNum(Number(e.target.value));
                        setFormError('');
                      }}
                    >
                      {Array.from({ length: capacity }, (_, i) => (
                        <option key={i + 1} value={i + 1} className="bg-white text-slate-900">
                          {i + 1}번
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2단계: 이름 입력 및 자동 생성 닉네임 미리보기 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                    2
                  </span>
                  <label className="text-sm font-bold text-slate-800" htmlFor="studentName">
                    이름
                  </label>
                </div>
                <span className="text-xs font-medium text-slate-500">실명으로 입력해 주세요</span>
              </div>

              <div className="relative">
                <PencilLine
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="studentName"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 pr-4 pl-10 text-base font-bold text-slate-900 placeholder-slate-400 outline-none transition hover:border-slate-300 hover:bg-white focus:border-brand-600 focus:bg-white focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="이름을 입력해 주세요 (예: 홍길동)"
                  value={studentName}
                  maxLength={14}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  autoComplete="name"
                  disabled={closed || full}
                />
              </div>

              {/* 자동 생성 닉네임 이름표 */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 transition ${
                  generatedNickname
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200/90 bg-slate-50/90'
                }`}
              >
                <div>
                  <span className="block text-xs font-bold text-slate-700">내 퀴즈 이름표 (자동 생성)</span>
                  <span className="block text-[11px] text-slate-500">퀴즈 화면에 이 닉네임으로 표시돼요</span>
                </div>
                <span
                  data-testid="generated-nickname"
                  className={`inline-flex items-center rounded-xl border px-3 py-1.5 font-mono text-sm font-extrabold tracking-tight sm:text-base ${
                    generatedNickname
                      ? 'border-brand-200 bg-white text-brand-700 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {generatedNickname || `${studentIdPrefix} 홍길동`}
                </span>
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-center text-sm font-semibold text-rose-700"
              >
                {formError}
              </p>
            )}

            {/* 퀴즈 입장 버튼 */}
            <button
              type="submit"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-lg font-extrabold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              disabled={busy || closed || full}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              <span>
                {closed
                  ? selectedClass?.status === 'FINISHED'
                    ? '이번 퀴즈가 끝난 학급이에요'
                    : '선생님이 퀴즈를 준비하고 있어요'
                  : full
                    ? '우리 반 정원이 가득 찼어요'
                    : `${classDisplayName(classId)} 입장하기`}
              </span>
            </button>
          </div>
        </form>

        {/* 하단 선생님(관리자) 로그인 링크 */}
        <footer className="mt-6 flex justify-center">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
          >
            <Shield className="h-4 w-4 text-brand-600" />
            <span>선생님(관리자) 로그인</span>
          </Link>
        </footer>
      </div>
    </div>
  );
}
