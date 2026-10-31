import { motion } from 'framer-motion';
import { KeyRound, LogIn } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { errorMessage } from '../services/api';

export default function AdminLoginPage() {
  const { login, admin } = useAdminAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (admin) nav('/admin/dashboard', { replace: true });
  }, [admin, nav]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      nav('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, '로그인에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full max-w-md space-y-5 p-8">
        <div className="text-center">
          <Logo />
          <h1 className="mt-3 flex items-center justify-center gap-2 text-xl font-bold">
            <KeyRound className="h-5 w-5 text-neon-cyan" /> 관리자 로그인
          </h1>
        </div>
        <div>
          <label className="label" htmlFor="username">
            아이디
          </label>
          <input id="username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required maxLength={50} />
        </div>
        <div>
          <label className="label" htmlFor="password">
            비밀번호
          </label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus />
        </div>
        {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <button className="btn-primary w-full py-3 text-lg" disabled={busy}>
          <LogIn className="h-5 w-5" /> {busy ? '로그인 중…' : '로그인'}
        </button>
        <p className="text-center text-xs text-white/40">초기 계정은 최초 로그인 후 비밀번호를 반드시 변경해야 합니다.</p>
      </motion.form>
    </div>
  );
}
