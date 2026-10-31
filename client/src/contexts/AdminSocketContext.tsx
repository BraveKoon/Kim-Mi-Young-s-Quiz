import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { EVENTS, type ClassOverview } from '@shared/types/index';
import { createSocket, emitAck } from '../socket';
import { useToast } from './ToastContext';

export interface Overview {
  classes: ClassOverview[];
  totals: { classes: number; capacity: number; participants: number; connected: number; playing: number };
}

export interface LiveLog {
  id: number;
  class_id: string | null;
  participant_id: number | null;
  event_type: string;
  severity: string;
  details: Record<string, unknown> | null;
  created_at: number;
}

interface Ctx {
  socket: Socket | null;
  connected: boolean;
  overview: Overview | null;
  /** 관리자 명령 실행: 실패 시 토스트로 안내 */
  command: (event: string, payload: Record<string, unknown>, successMsg?: string) => Promise<any>;
  onLog: (fn: (l: LiveLog) => void) => () => void;
}

const AdminSocketContext = createContext<Ctx | null>(null);

export function AdminSocketProvider({ token, children }: { token: string; children: ReactNode }) {
  const toast = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const logListeners = useRef(new Set<(l: LiveLog) => void>());

  useEffect(() => {
    const s = createSocket({ role: 'admin', token });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (e) => {
      setConnected(false);
      if (e.message === 'UNAUTHORIZED' || e.message === 'PASSWORD_CHANGE_REQUIRED') s.disconnect();
    });
    s.on(EVENTS.ADMIN_OVERVIEW, (o: Overview) => setOverview(o));
    s.on(EVENTS.ADMIN_LOG, (l: LiveLog) => logListeners.current.forEach((fn) => fn(l)));
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, [token]);

  const command = useCallback(
    async (event: string, payload: Record<string, unknown>, successMsg?: string) => {
      if (!socket?.connected) {
        toast('서버와 연결되어 있지 않습니다.', 'error');
        return { ok: false };
      }
      try {
        const r = await emitAck(socket, event, payload, 15000);
        if (!r.ok) toast(r.message ?? '명령을 실행하지 못했습니다.', 'error');
        else if (successMsg) toast(successMsg, 'success');
        return r;
      } catch {
        toast('서버 응답이 없습니다.', 'error');
        return { ok: false };
      }
    },
    [socket, toast],
  );

  const onLog = useCallback((fn: (l: LiveLog) => void) => {
    logListeners.current.add(fn);
    return () => {
      logListeners.current.delete(fn);
    };
  }, []);

  return <AdminSocketContext.Provider value={{ socket, connected, overview, command, onLog }}>{children}</AdminSocketContext.Provider>;
}

export function useAdminSocket() {
  const c = useContext(AdminSocketContext);
  if (!c) throw new Error('AdminSocketProvider missing');
  return c;
}
