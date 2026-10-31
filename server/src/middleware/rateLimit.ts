import rateLimit from 'express-rate-limit';
import type { AppContext } from '../context.js';

const message = (msg: string) => ({ error: 'RATE_LIMITED', message: msg });

export function createLimiters(ctx: AppContext) {
  const onLimit = (kind: string) => (req: { ip?: string; path: string }) =>
    ctx.logger.log('RATE_LIMITED', { severity: 'warning', details: { kind, ip: req.ip, path: req.path } });
  return {
    api: rateLimit({
      windowMs: 60_000,
      limit: ctx.config.apiRateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: message('요청이 너무 많습니다. 잠시 후 다시 시도하세요.'),
      handler: (req, res, _next, opts) => {
        onLimit('api')(req);
        res.status(opts.statusCode).json(opts.message);
      },
    }),
    login: rateLimit({
      windowMs: 60_000,
      limit: ctx.config.loginRateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) => {
        onLimit('login')(req);
        res.status(429).json(message('로그인 시도가 너무 많습니다. 1분 후 다시 시도하세요.'));
      },
    }),
    join: rateLimit({
      windowMs: 60_000,
      limit: ctx.config.joinRateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) => {
        onLimit('join')(req);
        res.status(429).json(message('입장 요청이 너무 많습니다. 잠시 후 다시 시도하세요.'));
      },
    }),
  };
}
