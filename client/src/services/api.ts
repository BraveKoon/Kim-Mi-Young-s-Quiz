import axios, { AxiosError } from 'axios';

function normalizeApiOrigin(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProto.replace(/\/+$/, '').replace(/\/api$/i, '');
}

/** 백엔드 기본 주소. 비어 있으면 같은 출처(개발 시 Vite 프록시) 사용 */
export const API_ORIGIN = normalizeApiOrigin(import.meta.env.VITE_API_URL as string | undefined);

const ADMIN_TOKEN_KEY = 'classquiz.adminToken';

export const adminTokenStore = {
  get: () => {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
      else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const api = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 15000 });

api.interceptors.request.use((config) => {
  const t = adminTokenStore.get();
  if (t && !config.headers.Authorization && !config.headers['X-No-Admin']) config.headers.Authorization = `Bearer ${t}`;
  delete config.headers['X-No-Admin'];
  return config;
});

/** 관리자 토큰 만료 시 로그인 화면으로 */
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: string }>) => {
    const code = err.response?.data?.error;
    if (err.response?.status === 401 && adminTokenStore.get() && ['INVALID_TOKEN', 'TOKEN_REVOKED', 'TOKEN_STALE', 'UNAUTHORIZED'].includes(code ?? '')) {
      adminTokenStore.set(null);
      window.dispatchEvent(new Event('classquiz:admin-logout'));
    }
    return Promise.reject(err);
  },
);

/** 학생용 요청: 관리자 토큰을 붙이지 않는다 */
export const studentApi = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 15000 });

export function errorMessage(err: unknown, fallback = '요청을 처리하지 못했습니다.'): string {
  const e = err as AxiosError<{ message?: string; details?: { message: string }[] }>;
  if (e?.response?.data?.details?.length) return e.response.data.details[0].message;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ERR_NETWORK') return '서버에 연결할 수 없습니다. 네트워크를 확인하세요.';
  return fallback;
}

/** 인증이 필요한 파일 다운로드 (blob) */
export async function downloadFile(url: string, fallbackName: string) {
  const res = await api.get(url, { responseType: 'blob', timeout: 120000 });
  const cd = res.headers['content-disposition'] as string | undefined;
  const m = cd?.match(/filename\*=UTF-8''([^;]+)/);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  // 즉시 제거하면 일부 브라우저에서 파일명이 무시되므로 지연 후 정리
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(href);
  }, 1000);
}
