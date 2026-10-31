import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN } from '../services/api';

export function createSocket(auth: Record<string, unknown>): Socket {
  return io(API_ORIGIN || undefined, {
    auth,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 15000,
  });
}

export function emitAck<T = any>(socket: Socket, event: string, payload: unknown, timeout = 8000): Promise<T> {
  return socket.timeout(timeout).emitWithAck(event, payload) as Promise<T>;
}
