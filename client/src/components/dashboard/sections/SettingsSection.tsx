import { AlertTriangle, KeyRound, Save, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { EVENTS } from '@shared/types/index';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, errorMessage } from '../../../services/api';
import type { AdminInfo } from '../../../types';
import { dateOnly } from '../../../utils/format';
import { ConfirmDialog } from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { SectionTitle } from '../CompetitionSelect';

export function ChangePasswordForm() {
  const { changePassword } = useAdminAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 8) return setError('새 비밀번호는 8자 이상이어야 합니다.');
    if (next !== confirm) return setError('새 비밀번호 확인이 일치하지 않습니다.');
    try {
      await changePassword(cur, next);
      toast('비밀번호를 변경했습니다.', 'success');
      setCur('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="password" className="input" placeholder="현재 비밀번호" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
      <input type="password" className="input" placeholder="새 비밀번호 (8자 이상)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
      <input type="password" className="input" placeholder="새 비밀번호 확인" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
      <button className="btn-primary w-full">
        <KeyRound className="h-4 w-4" /> 비밀번호 변경
      </button>
    </form>
  );
}

export function AdminAccountsCard() {
  const { admin: currentAdmin } = useAdminAuth();
  const toast = useToast();
  const { data, reload } = useApi<{ admins: AdminInfo[] }>('/admins');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [delTarget, setDelTarget] = useState<AdminInfo | null>(null);

  const admins = data?.admins ?? [];

  const addAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const trimmed = username.trim();
    if (trimmed.length < 3) return setFormError('아이디는 3자 이상이어야 합니다.');
    if (password.length < 8) return setFormError('초기 비밀번호는 8자 이상이어야 합니다.');
    setBusy(true);
    try {
      await api.post('/admins', { username: trimmed, password });
      toast(`관리자 '${trimmed}' 계정을 추가했습니다.`, 'success');
      setUsername('');
      setPassword('');
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass space-y-4 p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-xl">
          <ShieldCheck className="h-5 w-5 text-neon-cyan" /> 관리자 계정 관리
        </h3>
        <span className="text-xs text-white/50">총 {admins.length}명 · 마지막 관리자 계정은 삭제할 수 없습니다.</span>
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>아이디</th>
                <th>상태</th>
                <th>생성일</th>
                <th className="text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isSelf = a.id === currentAdmin?.id;
                const isLast = admins.length <= 1;
                const disableDelete = isLast || isSelf;
                const disableReason = isLast
                  ? '마지막 관리자 계정은 삭제할 수 없습니다.'
                  : isSelf
                    ? '현재 로그인한 본인 계정은 삭제할 수 없습니다.'
                    : '관리자 계정 삭제';
                return (
                  <tr key={a.id}>
                    <td className="font-bold">
                      {a.username}
                      {isSelf && <span className="ml-2 rounded-full bg-cyan-400/20 px-2 py-0.5 text-xs text-cyan-200">본인</span>}
                    </td>
                    <td>
                      {a.mustChangePassword ? (
                        <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs text-amber-200">초기 비밀번호 변경 대기</span>
                      ) : (
                        <span className="rounded-full bg-lime-400/20 px-2.5 py-0.5 text-xs text-lime-200">사용 중</span>
                      )}
                    </td>
                    <td className="text-white/60">{dateOnly(a.createdAt)}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-rose-200"
                        disabled={disableDelete}
                        title={disableReason}
                        aria-label={`${a.username} 계정 삭제`}
                        onClick={() => setDelTarget(a)}
                      >
                        <Trash2 className="h-4 w-4" /> 삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={addAdmin} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="font-bold text-sm">새 관리자 추가</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="input"
            placeholder="아이디 (영문·숫자·._- 3~30자)"
            aria-label="새 관리자 아이디"
            value={username}
            maxLength={30}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            required
          />
          <input
            type="password"
            className="input"
            placeholder="초기 비밀번호 (8자 이상)"
            aria-label="새 관리자 초기 비밀번호"
            value={password}
            maxLength={200}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={busy}>
            <UserPlus className="h-4 w-4" /> 관리자 추가
          </button>
        </div>
        {formError && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{formError}</p>}
        <p className="text-xs text-white/50">새로 추가한 관리자는 첫 로그인 시 비밀번호 변경이 강제됩니다.</p>
      </form>

      <ConfirmDialog
        open={!!delTarget}
        danger
        title="관리자 계정 삭제"
        confirmText="삭제"
        message={`관리자 '${delTarget?.username}' 계정을 삭제할까요? 해당 계정의 로그인 세션도 즉시 종료됩니다.`}
        onClose={() => setDelTarget(null)}
        onConfirm={async () => {
          try {
            await api.delete(`/admins/${delTarget!.id}`);
            toast(`관리자 '${delTarget!.username}' 계정을 삭제했습니다.`, 'success');
            reload();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </div>
  );
}

export function SettingsSection() {
  const toast = useToast();
  const { command } = useAdminSocket();
  const [mode, setMode] = useState('MASKED');
  const [size, setSize] = useState(10);
  const [resetAll, setResetAll] = useState(false);
  const [removeParticipants, setRemove] = useState(false);
  useEffect(() => {
    api.get('/settings').then((r) => {
      setMode(r.data.projectorNameMode);
      setSize(r.data.leaderboardSize);
    });
  }, []);
  const save = async () => {
    try {
      await api.put('/settings', { projectorNameMode: mode, leaderboardSize: size });
      toast('저장했습니다.', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div>
      <SectionTitle title="설정" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass space-y-4 p-5">
          <h3 className="font-display text-xl">프로젝터 · 공개 화면</h3>
          <div>
            <label className="label">학생 이름 공개 방식</label>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="FULL" className="bg-ink-800">닉네임 전체 공개</option>
              <option value="MASKED" className="bg-ink-800">일부 마스킹 (예: 김*수)</option>
              <option value="HIDDEN" className="bg-ink-800">비공개 (예: 1위 참가자)</option>
            </select>
            <p className="mt-1 text-xs text-white/50">프로젝터와 공개 결과 페이지에 적용됩니다. 서버에서 마스킹한 뒤 전송합니다.</p>
          </div>
          <div>
            <label className="label">문제별 결과 화면 순위 표시 인원</label>
            <input type="number" min={3} max={35} className="input" value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
          <button className="btn-primary" onClick={save}>
            <Save className="h-4 w-4" /> 저장
          </button>
        </div>
        <div className="glass space-y-4 p-5">
          <h3 className="font-display text-xl">관리자 비밀번호 변경</h3>
          <ChangePasswordForm />
        </div>
        <AdminAccountsCard />
        <div className="glass space-y-3 border-rose-400/30 p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-display text-xl text-rose-200">
            <AlertTriangle className="h-5 w-5" /> 위험 구역
          </h3>
          <p className="text-sm text-white/70">모든 학급의 현재 세션 답안과 점수를 초기화합니다. 종료된 대회의 학급은 기록 보존을 위해 건너뜁니다.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={removeParticipants} onChange={(e) => setRemove(e.target.checked)} /> 참가 학생 목록도 삭제
          </label>
          <button className="btn-danger" onClick={() => setResetAll(true)}>
            전체 학급 초기화
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={resetAll}
        danger
        title="전체 학급 초기화"
        requireTyping="RESET_ALL"
        confirmText="전체 초기화"
        message="12개 학급 모두의 현재 진행 상태와 점수를 초기화합니다. 이 작업은 되돌릴 수 없습니다."
        onClose={() => setResetAll(false)}
        onConfirm={async () => {
          const r = await command(EVENTS.ADMIN_RESET_ALL, { confirm: 'RESET_ALL', removeParticipants }, '전체 초기화를 실행했습니다.');
          for (const x of r.result ?? []) if (!x.ok) toast(`${x.classId}: ${x.error}`, 'info');
        }}
      />
    </div>
  );
}
