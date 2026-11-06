import { autoFocusOnDesktop } from '../utils/pointer';
import { motion } from 'framer-motion';
import { Home, LogIn } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <header className="mb-6 flex flex-col items-center text-center">
        <Logo size="lg" />
        <p className="mt-3 text-sm font-medium text-slate-600">선생님 · 관리자 전용 공간</p>
      </header>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="glass-strong w-full overflow-hidden"
      >

        <div className="space-y-5 p-6 sm:p-8">
          <h1 className="text-center font-display text-2xl text-slate-900">관리자 로그인</h1>

          <div>
            <label className="label" htmlFor="username">
              아이디
            </label>
            <input
              id="username"
              className="input h-12 font-semibold"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              name="username"
              spellCheck={false}
              autoComplete="username"
              required
              maxLength={50}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              className="input h-12 font-semibold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus={autoFocusOnDesktop}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-center text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}

          <button className="btn-primary h-13 w-full rounded-2xl text-lg font-extrabold" disabled={busy}>
            <LogIn className="h-5 w-5" /> {busy ? '로그인 중…' : '로그인'}
          </button>

          <p className="text-center text-xs text-slate-500">초기 계정은 최초 로그인 후 비밀번호를 반드시 변경해야 합니다.</p>
        </div>
      </motion.form>

      <footer className="mt-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
        >
          <Home className="h-4 w-4 text-brand-600" /> 홈으로
        </Link>
      </footer>
    </div>
  );
}
