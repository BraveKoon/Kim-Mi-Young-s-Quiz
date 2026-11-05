import { api } from '../services/api';

const keyName = (classId: string) => `classquiz.projectorKey.${classId}`;

/**
 * 프로젝터 진행 컨트롤 키.
 * 로그인한 관리자가 대시보드에서 프로젝터를 열 때 서버가 학급 전용 임시 키를 발급하고, 주소의 해시(#ck=...)로 전달한다.
 * 해시는 서버로 전송되지 않으며, 읽은 직후 주소에서 지우고 이 탭의 sessionStorage 에만 보관한다.
 */
export function captureProjectorKey(classId: string): string | null {
  try {
    const m = /(?:^|[#&])ck=([^&]+)/.exec(window.location.hash);
    if (m) {
      const key = decodeURIComponent(m[1]);
      sessionStorage.setItem(keyName(classId), key);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return key;
    }
    return sessionStorage.getItem(keyName(classId));
  } catch {
    return null;
  }
}

export function forgetProjectorKey(classId: string) {
  try {
    sessionStorage.removeItem(keyName(classId));
  } catch {
    /* ignore */
  }
}

/** 새 탭에서 학급 프로젝터를 연다(진행 컨트롤 키 포함). 키 발급에 실패하면 보기 전용으로 열고 false 를 반환한다. */
export async function openProjector(classId: string): Promise<boolean> {
  const base = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/projector/${classId}`;
  // 팝업 차단을 피하려고 클릭 직후 동기적으로 창을 먼저 연 뒤 주소를 바꾼다.
  const win = window.open('about:blank', '_blank');
  if (win) win.opener = null;
  try {
    const r = await api.post(`/classes/${classId}/projector-key`);
    const url = `${base}#ck=${encodeURIComponent(r.data.key as string)}`;
    if (win) win.location.href = url;
    else window.open(url, '_blank');
    return true;
  } catch {
    if (win) win.location.href = base;
    else window.open(base, '_blank');
    return false;
  }
}
