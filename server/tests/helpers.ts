import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as ioc, type Socket } from 'socket.io-client';
import { loadConfig, type AppConfig } from '../src/config/index.js';
import { createServer } from '../src/server.js';
import { SAMPLE_QUESTIONS } from './fixtures.js';

export const NEW_PASSWORD = 'teacher-pass-2026!';

export interface TestServer {
  url: string;
  dir: string;
  config: AppConfig;
  server: Awaited<ReturnType<typeof createServer>>;
  clock: { offset: number };
  close: () => Promise<void>;
}

export async function startServer(opts: { dir?: string; overrides?: Partial<AppConfig> } = {}): Promise<TestServer> {
  process.env.NODE_ENV = 'test';
  const dir = opts.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'classquiz-test-'));
  const config = loadConfig({
    databasePath: path.join(dir, 'test.sqlite'),
    jwtSecret: 'test-secret-test-secret-test-secret-xx',
    apiRateLimitPerMinute: 100000,
    joinRateLimitPerMinute: 100000,
    loginRateLimitPerMinute: 1000,
    logToConsole: false,
    clientOrigins: ['http://localhost:5173'],
    ...opts.overrides,
  });
  const clock = { offset: 0 };
  const server = await createServer(config, () => Date.now() + clock.offset);
  await new Promise<void>((r) => server.httpServer.listen(0, '127.0.0.1', () => r()));
  const { port } = server.httpServer.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, dir, config, server, clock, close: () => server.close() };
}

/** 기본 관리자로 로그인하고 초기 비밀번호를 변경한 뒤 새 토큰을 반환 */
export async function adminToken(ts: TestServer): Promise<string> {
  let res = await request(ts.url).post('/api/admin/login').send({ username: 'admin', password: NEW_PASSWORD });
  if (res.status === 200) return res.body.token;
  res = await request(ts.url).post('/api/admin/login').send({ username: 'admin', password: '1234' });
  const changed = await request(ts.url)
    .post('/api/admin/change-password')
    .set('Authorization', `Bearer ${res.body.token}`)
    .send({ currentPassword: '1234', newPassword: NEW_PASSWORD });
  return changed.body.token;
}

export async function join(ts: TestServer, classId: string, nickname: string) {
  const res = await request(ts.url).post(`/api/classes/${classId}/join`).send({ nickname });
  return res;
}

export function connect(ts: TestServer, auth: Record<string, unknown>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(ts.url, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    s.once('connect', () => resolve(s));
    s.once('connect_error', (err) => {
      s.close();
      reject(err);
    });
  });
}

export function waitFor<T = any>(s: Socket, event: string, pred: (p: T) => boolean = () => true, timeout = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      s.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeout);
    const handler = (p: T) => {
      if (!pred(p)) return;
      clearTimeout(t);
      s.off(event, handler);
      resolve(p);
    };
    s.on(event, handler);
  });
}

export function emitAck<T = any>(s: Socket, event: string, payload: unknown): Promise<T> {
  return s.timeout(8000).emitWithAck(event, payload) as Promise<T>;
}

export async function studentSocket(ts: TestServer, classId: string, nickname: string) {
  const res = await join(ts, classId, nickname);
  if (res.status !== 201) throw new Error(`join failed ${res.status} ${JSON.stringify(res.body)}`);
  const conn = await connectStudent(ts, res.body.participantId, res.body.token);
  return { ...conn, participantId: res.body.participantId as number, token: res.body.token as string };
}

/** 학생 소켓 연결 후 최초 상태(quiz:state)까지 기다린다. */
export async function connectStudent(ts: TestServer, participantId: number, token: string, extra: Record<string, unknown> = {}) {
  const s = ioc(ts.url, { auth: { role: 'student', participantId, token, ...extra }, transports: ['websocket'], reconnection: false, forceNew: true, autoConnect: false });
  const initialP = new Promise<any>((resolve) => s.once('quiz:state', resolve));
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve());
    s.once('connect_error', (e) => {
      s.close();
      reject(e);
    });
    s.connect();
  });
  return { socket: s, initial: await initialP };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 테스트 전용 5문항(4지선다) 세트를 만들고, 대기 중인 모든 학급 세션을 이 세트로 바꾼다.
 * 기본 시드(고사성어 30문항)는 유형이 섞여 있어 정답 인덱스·제한시간이 고정된 진행 흐름 테스트에 맞지 않는다.
 */
export function useSampleQuiz(ts: TestServer): number {
  const { repos } = ts.server.ctx;
  const now = Date.now();
  const ids = SAMPLE_QUESTIONS.map((q, i) => repos.questions.create({ ...q, questionType: 'MULTIPLE_CHOICE', orderNum: 1000 + i }, now));
  const setId = repos.quizSets.create({ title: '테스트 5문항', description: null, category: null, questionIds: ids }, now);
  repos.db
    .prepare("UPDATE class_sessions SET quiz_set_id = ?, quiz_set_title = '테스트 5문항', question_count = ? WHERE status = 'WAITING'")
    .run(setId, ids.length);
  return setId;
}
