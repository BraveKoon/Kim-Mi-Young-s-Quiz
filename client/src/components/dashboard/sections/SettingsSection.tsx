import { AlertTriangle, KeyRound, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { EVENTS } from '@shared/types/index';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useToast } from '../../../contexts/ToastContext';
import { api, errorMessage } from '../../../services/api';
import { ConfirmDialog } from '../../common/Modal';
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
