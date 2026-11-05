import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as ioc, type Socket } from 'socket.io-client';
import { adminToken, emitAck, join, startServer, type TestServer } from './helpers.js';

let ts: TestServer;
let token: string;
const open: Socket[] = [];
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  ts = await startServer();
  token = await adminToken(ts);
});
afterAll(async () => {
  for (const s of open) s.close();
  await ts.close();
});

/** 프로젝터 소켓 연결 후 서버가 알려주는 컨트롤 사용 가능 여부(projector:control)까지 기다린다. */
async function projector(classId: string, controlKey?: string) {
  const s = ioc(ts.url, { auth: { role: 'projector', classId, controlKey }, transports: ['websocket'], reconnection: false, forceNew: true, autoConnect: false });
  open.push(s);
  const control = new Promise<{ enabled: boolean }>((resolve) => s.once('projector:control', resolve));
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve());
    s.once('connect_error', reject);
    s.connect();
  });
  return { socket: s, control: await control };
}

async function keyFor(classId: string) {
  const r = await request(ts.url).post(`/api/classes/${classId}/projector-key`).set(auth());
  expect(r.status).toBe(200);
  return r.body.key as string;
}

const status = async (classId: string) => (await request(ts.url).get(`/api/classes/${classId}/session`)).body.session.status;

describe('프로젝터 진행 컨트롤 키', () => {
  it('키 발급은 로그인한 관리자만 가능하다', async () => {
    expect((await request(ts.url).post('/api/classes/2-1/projector-key')).status).toBe(401);
    const st = await join(ts, '2-1', '학생');
    const res = await request(ts.url).post('/api/classes/2-1/projector-key').set('Authorization', `Bearer ${st.body.token}`);
    expect(res.status).toBe(401);
    const ok = await request(ts.url).post('/api/classes/2-13/projector-key').set(auth());
    expect(ok.status).toBe(400);
    expect(ts.server.ctx.repos.logs.query({ eventType: 'PROJECTOR_KEY_ISSUED' }).total).toBe(0);
    await keyFor('2-1');
    expect(ts.server.ctx.repos.logs.query({ eventType: 'PROJECTOR_KEY_ISSUED' }).total).toBe(1);
  });

  it('키가 있는 프로젝터는 비밀번호 없이 해당 학급의 진행 명령을 실행할 수 있다', async () => {
    const { socket, control } = await projector('2-1', await keyFor('2-1'));
    expect(control.enabled).toBe(true);
    expect(await emitAck(socket, 'admin:start_quiz', { classId: '2-1' })).toMatchObject({ ok: true });
    expect(await status('2-1')).toBe('PLAYING');
    expect(await emitAck(socket, 'admin:pause_quiz', { classId: '2-1' })).toMatchObject({ ok: true });
    expect(await status('2-1')).toBe('PAUSED');
    expect(await emitAck(socket, 'admin:resume_quiz', { classId: '2-1' })).toMatchObject({ ok: true });
    expect(await emitAck(socket, 'admin:show_results', { classId: '2-1' })).toMatchObject({ ok: true });
    expect(await emitAck(socket, 'admin:skip_question', { classId: '2-1' })).toMatchObject({ ok: true });
    expect(await emitAck(socket, 'admin:finish_quiz', { classId: '2-1' })).toMatchObject({ ok: true });
    expect(await status('2-1')).toBe('FINISHED');
  });

  it('키가 없거나 잘못되면 보기 전용이고, 진행 명령은 거부·기록된다', async () => {
    const before = ts.server.ctx.repos.logs.query({ eventType: 'UNAUTHORIZED_ADMIN_EVENT' }).total;
    const view = await projector('2-2');
    expect(view.control.enabled).toBe(false);
    expect(await emitAck(view.socket, 'admin:start_quiz', { classId: '2-2' })).toMatchObject({ ok: false, error: 'FORBIDDEN' });

    const bad = await projector('2-2', 'not-a-real-key');
    expect(bad.control.enabled).toBe(false);
    expect(await emitAck(bad.socket, 'admin:start_quiz', { classId: '2-2' })).toMatchObject({ ok: false, error: 'FORBIDDEN' });

    const expired = jwt.sign({ role: 'projector-control', classId: '2-2', exp: Math.floor(Date.now() / 1000) - 10 }, ts.config.jwtSecret, { subject: '1' });
    expect((await projector('2-2', expired)).control.enabled).toBe(false);

    expect(await status('2-2')).toBe('WAITING');
    expect(ts.server.ctx.repos.logs.query({ eventType: 'UNAUTHORIZED_ADMIN_EVENT' }).total).toBe(before + 2);
  });

  it('관리자 로그인 토큰은 프로젝터 키로 쓸 수 없고, 다른 학급 키도 통하지 않는다', async () => {
    expect((await projector('2-3', token)).control.enabled).toBe(false);
    expect((await projector('2-3', await keyFor('2-4'))).control.enabled).toBe(false);
  });

  it('키는 발급된 학급만 제어하며 전체 초기화·관전 이벤트와 참가자 삭제는 허용하지 않는다', async () => {
    const { socket } = await projector('2-5', await keyFor('2-5'));
    expect(await emitAck(socket, 'admin:start_quiz', { classId: '2-6' })).toMatchObject({ ok: false, error: 'FORBIDDEN' });
    expect(await status('2-6')).toBe('WAITING');
    expect(await emitAck(socket, 'admin:reset_all', { confirm: 'RESET_ALL' })).toMatchObject({ ok: false, error: 'FORBIDDEN' });
    expect(await emitAck(socket, 'admin:watch_class', { classId: '2-5' })).toMatchObject({ ok: false, error: 'FORBIDDEN' });

    // 초기화는 허용되지만 확인 문구가 필요하고, 참가자 목록은 지워지지 않는다
    await join(ts, '2-5', '남는학생');
    expect(await emitAck(socket, 'admin:reset_class', { classId: '2-5' })).toMatchObject({ ok: false, error: 'CONFIRM_REQUIRED' });
    expect(await emitAck(socket, 'admin:reset_class', { classId: '2-5', confirm: 'RESET', removeParticipants: true })).toMatchObject({ ok: true });
    const p = await request(ts.url).get('/api/classes/2-5/participants').set(auth());
    expect(p.body.participants.map((x: any) => x.nickname)).toEqual(['남는학생']);
  });

  it('발급 관리자의 비밀번호 변경 시각보다 오래된 키는 무효다', async () => {
    const change = await request(ts.url).post('/api/admin/change-password').set(auth()).send({ currentPassword: 'teacher-pass-2026!', newPassword: 'another-pass-2026!' });
    expect(change.status).toBe(200);
    token = change.body.token;
    const stale = jwt.sign({ role: 'projector-control', classId: '2-7', iat: Math.floor(Date.now() / 1000) - 60 }, ts.config.jwtSecret, { subject: '1', expiresIn: 3600 });
    expect((await projector('2-7', stale)).control.enabled).toBe(false);
    // 변경 이후에 새로 발급한 키는 정상 동작
    expect((await projector('2-7', await keyFor('2-7'))).control.enabled).toBe(true);
  });
});
