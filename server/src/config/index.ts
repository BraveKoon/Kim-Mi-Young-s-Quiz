import 'dotenv/config';
import path from 'node:path';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  databasePath: string;
  clientOrigins: string[];
  adminUsername: string;
  adminPassword: string;
  forcePasswordChange: boolean;
  participantTokenTtlHours: number;
  answerGraceMs: number;
  trustProxy: boolean;
  serveClientDist: string | null;
  /** REST 요청 속도 제한(분당). 테스트·부하 테스트에서 조정 가능 */
  apiRateLimitPerMinute: number;
  loginRateLimitPerMinute: number;
  joinRateLimitPerMinute: number;
  logToConsole: boolean;
}

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function normalizeOrigin(raw: string): string {
  const s = raw.trim();
  if (!s || s === '*') return s;
  try {
    return new URL(s).origin;
  } catch {
    return s.replace(/\/+$/, '');
  }
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const env = process.env;
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const jwtSecret = env.JWT_SECRET ?? 'dev-only-secret-change-me';
  const cfg: AppConfig = {
    port: Number(env.PORT ?? 3000),
    nodeEnv,
    isProduction,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '8h',
    databasePath: path.resolve(env.DATABASE_PATH ?? './data/classquiz.sqlite'),
    clientOrigins: (env.CLIENT_ORIGIN ?? 'http://localhost:5173,https://classquiz.bravekoon.workers.dev')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean),
    adminUsername: env.ADMIN_USERNAME ?? 'admin',
    adminPassword: env.ADMIN_PASSWORD ?? '1234',
    forcePasswordChange: bool(env.ADMIN_FORCE_PASSWORD_CHANGE, true),
    participantTokenTtlHours: Number(env.PARTICIPANT_TOKEN_TTL_HOURS ?? 12),
    answerGraceMs: Number(env.ANSWER_GRACE_MS ?? 500),
    trustProxy: bool(env.TRUST_PROXY, false),
    serveClientDist: env.SERVE_CLIENT_DIST ? path.resolve(env.SERVE_CLIENT_DIST) : null,
    apiRateLimitPerMinute: Number(env.API_RATE_LIMIT_PER_MINUTE ?? 3000),
    loginRateLimitPerMinute: Number(env.LOGIN_RATE_LIMIT_PER_MINUTE ?? 10),
    joinRateLimitPerMinute: Number(env.JOIN_RATE_LIMIT_PER_MINUTE ?? 600),
    logToConsole: nodeEnv !== 'test',
    ...overrides,
  };
  if (cfg.isProduction && (cfg.jwtSecret.length < 32 || /change|dev-only/i.test(cfg.jwtSecret))) {
    throw new Error('운영 환경에서는 JWT_SECRET을 32자 이상의 안전한 임의 값으로 설정해야 합니다.');
  }
  return cfg;
}
