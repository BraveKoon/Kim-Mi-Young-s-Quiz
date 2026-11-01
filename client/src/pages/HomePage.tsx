import { ArrowRight, Loader2, LogIn, Shield, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CLASS_CAPACITY, CLASS_COUNT, GRADE, classDisplayName, formatStudentNickname, type SessionStatus } from '@shared/types/index';
import { Logo } from '../components/common/Logo';
import { StatusBadge } from '../components/common/StatusBadge';
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

  const classId = `${grade}-${classNum}`;
  const selectedClass = useMemo(() => classes?.find((c) => c.classId === classId) ?? null, [classes, classId]);
  const savedCreds = useMemo(() => credStore.get(classId), [classId]);

  const trimmedName = studentName.normalize('NFC').replace(/\s+/g, ' ').trim();
  const studentIdPrefix = `${grade}${String(classNum).padStart(2, '0')}${String(studentNum).padStart(2, '0')}`;
  const generatedNickname = trimmedName ? formatStudentNickname(grade, classNum, studentNum, trimmedName) : '';

  const full = selectedClass ? selectedClass.participantCount >= selectedClass.capacity : false;
  const closed = selectedClass ? selectedClass.status === 'FINISHED' || selectedClass.status === 'NO_SESSION' : false;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!trimmedName) return setFormError('이름을 입력하세요.');
    if (trimmedName.length > 14) return setFormError('이름은 14자 이하로 입력하세요.');
    if (!NAME_PATTERN.test(trimmedName)) return setFormError('이름에는 한글, 영문, 숫자만 사용할 수 있습니다.');

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
      setFormError(errorMessage(err, '입장하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-8">
      <header className="mb-7 flex flex-col items-center gap-2 text-center">
        <Logo size="lg" />
        <p className="text-sm text-slate-400 md:text-base">학년·반·번호와 이름을 입력해 우리 반 퀴즈에 입장하세요</p>
      </header>

      {serverError && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
          서버에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.
        </div>
      )}

      <form onSubmit={submit} className="glass-strong w-full space-y-5 p-6 md:p-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="font-display text-xl text-white">{classDisplayName(classId)}</div>
          {selectedClass ? (
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <StatusBadge status={selectedClass.status} />
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Users className="h-3.5 w-3.5" />
                <b className={full ? 'text-rose-300' : 'text-slate-200'}>
                  {selectedClass.participantCount}/{selectedClass.capacity}
                </b>
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">상태 확인 중…</span>
          )}
        </div>

        {savedCreds && (
          <Link
            to={`/${classId}`}
            className="flex items-center justify-between rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-200 transition hover:bg-blue-500/20"
          >
            <span>
              이전 입장 정보로 바로 들어가기 (<b>{savedCreds.nickname}</b>)
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="label" htmlFor="grade">
              학년
            </label>
            <select
              id="grade"
              className="input font-semibold"
              value={grade}
              onChange={(e) => {
                setGrade(Number(e.target.value));
                setFormError('');
              }}
            >
              <option value={GRADE}>{GRADE}학년</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="classNum">
              반
            </label>
            <select
              id="classNum"
              className="input font-semibold"
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
                  <option key={num} value={num}>
                    {num}반{suffix}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="studentNum">
              번호
            </label>
            <select
              id="studentNum"
              className="input font-semibold"
              value={studentNum}
              onChange={(e) => {
                setStudentNum(Number(e.target.value));
                setFormError('');
              }}
            >
              {Array.from({ length: selectedClass?.capacity ?? CLASS_CAPACITY }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}번
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="studentName">
            이름
          </label>
          <input
            id="studentName"
            className="input text-base font-bold"
            placeholder="예) 홍길동"
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

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-950/70 px-4 py-2.5 text-sm">
          <span className="text-slate-400">자동 생성 닉네임</span>
          <span className={`font-mono font-bold ${generatedNickname ? 'text-blue-300' : 'text-slate-500'}`} data-testid="generated-nickname">
            {generatedNickname || `${studentIdPrefix} 홍길동`}
          </span>
        </div>

        {formError && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-center text-sm text-rose-200">{formError}</p>}

        <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={busy || closed || full}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          {closed
            ? selectedClass?.status === 'FINISHED'
              ? '퀴즈가 종료된 학급입니다'
              : '아직 퀴즈 준비 중입니다'
            : full
              ? '정원 마감'
              : `${classDisplayName(classId)} 입장하기`}
        </button>
      </form>

      <footer className="mt-8 flex justify-center">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
          <Shield className="h-4 w-4" /> 선생님(관리자) 로그인
        </Link>
      </footer>
    </div>
  );
}
