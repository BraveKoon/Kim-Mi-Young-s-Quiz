import http from 'node:http';
import { createExpressApp } from './app.js';
import type { AppConfig } from './config/index.js';
import { createContext } from './context.js';
import { seed } from './database/seeds/index.js';
import { createSocketServer } from './socket/index.js';
import type { Clock } from './utils/clock.js';

/** 서버 조립: DB 초기화 → 시드 → Express → Socket.io → 세션 복구 */
export async function createServer(config: AppConfig, clock?: Clock) {
  const ctx = createContext(config, clock);
  const seeded = await seed(ctx.repos, config);
  const app = createExpressApp(ctx);
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer, ctx);
  const recovered = ctx.sessions.recover();

  // 주기적 정리: 만료된 토큰
  const cleanup = setInterval(() => {
    const now = ctx.clock();
    ctx.repos.admins.purgeExpiredRevocations(now);
    ctx.repos.participants.purgeExpiredTokens(now);
  }, 3600_000);
  cleanup.unref();

  const close = async () => {
    clearInterval(cleanup);
    ctx.sessions.shutdown();
    await new Promise<void>((r) => io.close(() => r()));
    await new Promise<void>((r) => (httpServer.listening ? httpServer.close(() => r()) : r()));
    try {
      ctx.repos.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      /* noop */
    }
    ctx.repos.db.close();
  };
  return { ctx, app, httpServer, io, close, seeded, recovered };
}
