import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { adminTokenStore, api } from '../services/api';
import type { AdminInfo } from '../types';

interface Ctx {
  token: string | null;
  admin: AdminInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AdminInfo>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AdminAuthContext = createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(adminTokenStore.get());
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(!!token);

  const apply = (t: string | null, a: AdminInfo | null) => {
    adminTokenStore.set(t);
    setToken(t);
    setAdmin(a);
  };

  useEffect(() => {
    if (!token) return setLoading(false);
    api
      .get('/admin/me')
      .then((r) => setAdmin(r.data.admin))
      .catch(() => apply(null, null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onLogout = () => apply(null, null);
    window.addEventListener('classquiz:admin-logout', onLogout);
    return () => window.removeEventListener('classquiz:admin-logout', onLogout);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.post('/admin/login', { username, password }, { headers: { 'X-No-Admin': '1' } });
    apply(r.data.token, r.data.admin);
    return r.data.admin as AdminInfo;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/admin/logout');
    } catch {
      /* 이미 만료된 경우 무시 */
    }
    apply(null, null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const r = await api.post('/admin/change-password', { currentPassword, newPassword });
    apply(r.data.token, r.data.admin);
  }, []);

  return <AdminAuthContext.Provider value={{ token, admin, loading, login, logout, changePassword }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('AdminAuthProvider missing');
  return ctx;
}
