import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import type { AppContext } from './context.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/index.js';

export function createExpressApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');
  if (ctx.config.trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: ctx.config.serveClientDist
        ? {
            directives: {
              defaultSrc: ["'self'"],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              imgSrc: ["'self'", 'data:'],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || ctx.config.clientOrigins.includes(origin) || ctx.config.clientOrigins.includes('*')),
      credentials: false,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use('/api', createApiRouter(ctx));
  app.use('/api', notFoundHandler);

  // 선택: 같은 서버에서 프론트엔드 빌드 결과를 제공 (SPA fallback 포함)
  const dist = ctx.config.serveClientDist;
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler(ctx.config.isProduction));
  return app;
}
