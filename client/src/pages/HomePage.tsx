import { ArrowRight, ChevronDown, Loader2, LogIn, PencilLine, Shield, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CLASS_CAPACITY, CLASS_COUNT, GRADE, classDisplayName, formatStudentNickname, type SessionStatus } from '@shared/types/index';
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

const NAME_PATTERN = /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.\-]+$/;

const CLASSROOM_STATUS_META: Record<
  SessionStatus | 'NO_SESSION',
  { label: string; badgeClass: string; dotClass: string; pulse?: boolean }
> = {
  WAITING: {
    label: '입장 가능 · 대기 중',
    badgeClass: 'border-teal-200 bg-teal-50 text-teal-800',
    dotClass: 'bg-teal-500',
  },
  PLAYING: {
    label: '퀴즈 진행 중',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-800',
    dotClass: 'bg-blue-600',
    pulse: true,
  },
  RESULT: {
    label: '결과 확인 중',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
    dotClass: 'bg-sky-500',
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
    meta?.setAttribute('content', '#EFF7FF');
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

  return (
    <div
      className="min-h-dvh w-full bg-gradient-to-b from-[#EFF7FF] via-[#FCFBF6] to-[#FAF6EC] text-slate-900"
      style={{
        backgroundImage:
          'radial-gradient(rgba(37, 99, 235, 0.065) 1px, transparent 1px), linear-gradient(180deg, #EFF7FF 0%, #FCFBF6 52%, #FAF6EC 100%)',
        backgroundSize: '24px 24px, 100% 100%',
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* 상단 브랜드 및 환영 문구 */}
        <header className="mb-6 flex flex-col items-center text-center sm:mb-7">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-[#FEF9C3] px-3.5 py-1 text-xs font-bold text-amber-900 shadow-2xs">
            <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.18 3.63a1 1 0 00.95.69h3.817c.969 0 1.371 1.24.588 1.81l-3.088 2.244a1 1 0 00-.364 1.118l1.18 3.63c.3.921-.755 1.688-1.54 1.118l-3.088-2.244a1 1 0 00-1.175 0l-3.088 2.244c-.784.57-1.838-.197-1.539-1.118l1.18-3.63a1 1 0 00-.364-1.118L2.5 9.057c-.783-.57-.38-1.81.588-1.81h3.817a1 1 0 00.95-.69l1.194-3.63z" />
            </svg>
            <span>신나는 우리 반 실시간 퀴즈</span>
          </div>

          <Link to="/" className="group inline-flex items-center gap-3 focus:outline-none">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-[0_6px_16px_-4px_rgba(37,99,235,0.45)] transition-transform group-hover:-translate-y-0.5">
              {/* 말풍선 아이콘 */}
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6.5 5.5h11A3.5 3.5 0 0121 9v6a3.5 3.5 0 01-3.5 3.5H12l-4.2 2.8c-.66.44-1.55-.03-1.55-.83V18.5A3.5 3.5 0 013 15V9a3.5 3.5 0 013.5-3.5z"
                  fill="currentColor"
                />
                <circle cx="9" cy="12" r="1.35" fill="#EFF7FF" />
                <circle cx="12.5" cy="12" r="1.35" fill="#FACC15" />
                <circle cx="16" cy="12" r="1.35" fill="#EFF7FF" />
              </svg>
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-[#EFF7FF] bg-[#FB7185]" />
            </span>
            <span className="font-display text-4xl tracking-tight text-slate-900 sm:text-[2.75rem]">ClassQuiz</span>
          </Link>

          <p className="mt-2.5 text-[15px] leading-relaxed font-medium text-slate-600 sm:text-base">
            반가워요! 학번과 이름을 입력하면 우리 반 퀴즈 교실로 바로 들어가요.
          </p>
        </header>

        {/* 메인 입장 카드 */}
        <form
          onSubmit={submit}
          className="w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_16px_40px_-14px_rgba(15,23,42,0.09),0_2px_10px_-3px_rgba(15,23,42,0.04)]"
        >
          {/* 상단 산뜻한 컬러 포인트 바 */}
          <div className="grid h-1.5 w-full grid-cols-4" aria-hidden="true">
            <div className="bg-[#2563EB]" />
            <div className="bg-[#14B8A6]" />
            <div className="bg-[#FACC15]" />
            <div className="bg-[#FB7185]" />
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            {/* 현재 학급 · 퀴즈 상태 · 참가 인원 패널 */}
            <div className="rounded-2xl border border-sky-100 bg-[#F3F9FF] px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <span className="block text-[11px] font-bold tracking-wide text-sky-700">현재 선택한 학급</span>
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
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
                      <span className="h-2 w-2 rounded-full bg-teal-500" />
                      입장 가능 · 대기 중
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    <Users className="h-3.5 w-3.5 text-teal-600" />
                    <span>참가</span>
                    <b className={full ? 'text-rose-600' : 'text-blue-700'}>
                      {participantCount}/{capacity}명
                    </b>
                  </span>
                </div>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sky-200/60" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    full ? 'bg-[#FB7185]' : 'bg-gradient-to-r from-[#2563EB] to-[#14B8A6]'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((participantCount / Math.max(1, capacity)) * 100))}%` }}
                />
              </div>
            </div>

            {/* 이전 입장 기록 빠른 복귀 배너 */}
            {savedCreds && (
              <Link
                to={`/${classId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm font-semibold text-teal-900 transition hover:bg-teal-100/70"
              >
                <span>
                  방금 입장한 기록이 있어요 (<b className="font-extrabold text-teal-800">{savedCreds.nickname}</b>)
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-teal-700">
                  이어하기 <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            )}

            {/* 1단계: 학년 · 반 · 번호 선택 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-700">
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
                      className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-8 text-base font-bold text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-500/15"
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
                      className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-8 text-base font-bold text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-500/15"
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
                      className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-8 text-base font-bold text-slate-900 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-500/15"
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
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-xs font-extrabold text-rose-600">
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
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#FB7185]"
                  aria-hidden="true"
                />
                <input
                  id="studentName"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 pr-4 pl-10 text-base font-bold text-slate-900 placeholder-slate-400 outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                    ? 'border-amber-200 bg-[#FFFDF2]'
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
                      ? 'border-blue-200 bg-white text-[#1D4ED8] shadow-2xs'
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
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 text-lg font-extrabold text-white shadow-[0_10px_22px_-6px_rgba(37,99,235,0.45)] transition hover:bg-[#1D4ED8] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
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
            <Shield className="h-4 w-4 text-[#2563EB]" />
            <span>선생님(관리자) 로그인</span>
          </Link>
        </footer>
      </div>
    </div>
  );
}
