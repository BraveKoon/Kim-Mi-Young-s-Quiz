import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { NEW_PASSWORD, adminToken, join, startServer, type TestServer } from './helpers.js';

let ts: TestServer;
let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  ts = await startServer();
});
afterAll(async () => {
  await ts.close();
});

describe('초기화 및 시드', () => {
  it('12개 학급과 기본 세션, 샘플 문제 5개가 생성된다', async () => {
    const res = await request(ts.url).get('/api/classes');
    expect(res.status).toBe(200);
    expect(res.body.classes).toHaveLength(12);
    expect(res.body.classes[0]).toMatchObject({ classId: '2-1', className: '2학년 1반', capacity: 35, status: 'WAITING' });
    expect(res.body.totals.capacity).toBe(420);
    expect(ts.server.ctx.repos.questions.count()).toBe(5);
  });
  it('관리자 비밀번호는 bcrypt 해시로 저장된다', () => {
    const a = ts.server.ctx.repos.admins.findByUsername('admin')!;
    expect(a.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(a.password_hash).not.toContain('1234');
  });
  it('시드는 멱등이다 (재실행 시 중복 생성 없음)', async () => {
    const { seed } = await import('../src/database/seeds/index.js');
    const done = await seed(ts.server.ctx.repos, ts.config);
    expect(done).toEqual([]);
  });
});

describe('관리자 인증', () => {
  it('잘못된 비밀번호는 401', async () => {
    const res = await request(ts.url).post('/api/admin/login').send({ username: 'admin', password: 'nope' });
    expect(res.status).toBe(401);
  });
  it('기본 비밀번호 로그인 후에는 비밀번호 변경 전까지 관리자 API 차단', async () => {
    const res = await request(ts.url).post('/api/admin/login').send({ username: 'admin', password: '1234' });
    expect(res.status).toBe(200);
    expect(res.body.admin.mustChangePassword).toBe(true);
    const q = await request(ts.url).get('/api/questions').set('Authorization', `Bearer ${res.body.token}`);
    expect(q.status).toBe(403);
    expect(q.body.error).toBe('PASSWORD_CHANGE_REQUIRED');
    const me = await request(ts.url).get('/api/admin/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    // 약한 비밀번호 거부
    const weak = await request(ts.url)
      .post('/api/admin/change-password')
      .set('Authorization', `Bearer ${res.body.token}`)
      .send({ currentPassword: '1234', newPassword: 'short' });
    expect(weak.status).toBe(400);
    const ok = await request(ts.url)
      .post('/api/admin/change-password')
      .set('Authorization', `Bearer ${res.body.token}`)
      .send({ currentPassword: '1234', newPassword: NEW_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.admin.mustChangePassword).toBe(false);
    token = ok.body.token;
    // 이전 토큰은 폐기됨
    const old = await request(ts.url).get('/api/admin/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(old.status).toBe(401);
    // 이전 비밀번호로 로그인 불가
    const oldPw = await request(ts.url).post('/api/admin/login').send({ username: 'admin', password: '1234' });
    expect(oldPw.status).toBe(401);
  });
  it('토큰 없음/위조/만료 JWT 차단', async () => {
    expect((await request(ts.url).get('/api/questions')).status).toBe(401);
    expect((await request(ts.url).get('/api/questions').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    const forged = jwt.sign({ username: 'admin', role: 'admin' }, 'wrong-secret', { subject: '1', jwtid: 'x' });
    expect((await request(ts.url).get('/api/questions').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
    const expired = jwt.sign({ username: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 }, ts.config.jwtSecret, { subject: '1', jwtid: 'y' });
    expect((await request(ts.url).get('/api/questions').set('Authorization', `Bearer ${expired}`)).status).toBe(401);
    const noneAlg = jwt.sign({ username: 'admin', role: 'admin', sub: '1', jti: 'z' }, '', { algorithm: 'none' } as any);
    expect((await request(ts.url).get('/api/questions').set('Authorization', `Bearer ${noneAlg}`)).status).toBe(401);
  });
  it('로그아웃한 토큰은 재사용 불가', async () => {
    const t = await adminToken(ts);
    expect((await request(ts.url).post('/api/admin/logout').set('Authorization', `Bearer ${t}`)).status).toBe(200);
    expect((await request(ts.url).get('/api/admin/me').set('Authorization', `Bearer ${t}`)).status).toBe(401);
  });
});

describe('문제 및 문제 세트 관리', () => {
  let qid: number;
  it('문제 생성', async () => {
    const res = await request(ts.url).post('/api/questions').set(auth()).send({
      questionText: '1 + 1 = ?',
      options: ['1', '2', '3', '4'],
      correctIndex: 1,
      timeLimit: 10,
      isDoublePoints: false,
      explanation: '1 더하기 1은 2',
      category: '수학',
    });
    expect(res.status).toBe(201);
    qid = res.body.question.id;
    expect(res.body.question.correctIndex).toBe(1);
  });
  it('잘못된 문제 입력 거부', async () => {
    const res = await request(ts.url).post('/api/questions').set(auth()).send({ questionText: '', options: ['a'], correctIndex: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
  it('문제 수정', async () => {
    const res = await request(ts.url).put(`/api/questions/${qid}`).set(auth()).send({
      questionText: '2 + 2 = ?',
      options: ['3', '4', '5', '6'],
      correctIndex: 1,
      timeLimit: 15,
    });
    expect(res.status).toBe(200);
    expect(res.body.question.questionText).toBe('2 + 2 = ?');
  });
  it('문제 세트 생성/수정/삭제', async () => {
    const created = await request(ts.url).post('/api/quiz-sets').set(auth()).send({ title: '테스트 세트', questionIds: [qid] });
    expect(created.status).toBe(201);
    expect(created.body.quizSet.questionCount).toBe(1);
    const updated = await request(ts.url).put(`/api/quiz-sets/${created.body.quizSet.id}`).set(auth()).send({ title: '테스트 세트2', questionIds: [qid, 1] });
    expect(updated.body.quizSet.questions.map((q: any) => q.id)).toEqual([qid, 1]);
    const dup = await request(ts.url).post('/api/quiz-sets').set(auth()).send({ title: 'dup', questionIds: [qid, qid] });
    expect(dup.status).toBe(400);
    expect((await request(ts.url).delete(`/api/quiz-sets/${created.body.quizSet.id}`).set(auth())).status).toBe(200);
  });
  it('문제 삭제(소프트 삭제)', async () => {
    expect((await request(ts.url).delete(`/api/questions/${qid}`).set(auth())).status).toBe(200);
    const list = await request(ts.url).get('/api/questions').set(auth());
    expect(list.body.questions.find((q: any) => q.id === qid)).toBeUndefined();
    expect((await request(ts.url).delete(`/api/questions/${qid}`).set(auth())).status).toBe(404);
  });
});

describe('학생 입장', () => {
  it('정상 입장 시 참가자 ID와 토큰 발급 (토큰 원문은 DB에 저장되지 않음)', async () => {
    const res = await join(ts, '2-3', '홍길동');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ classId: '2-3', nickname: '홍길동' });
    expect(res.body.token.length).toBeGreaterThan(30);
    const row = ts.server.ctx.repos.db.prepare('SELECT token_hash FROM participant_tokens WHERE participant_id=?').get(res.body.participantId) as any;
    expect(row.token_hash).not.toBe(res.body.token);
  });
  it('같은 학급 닉네임 중복 차단, 다른 학급은 허용', async () => {
    const dup = await join(ts, '2-3', '홍길동');
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('NICKNAME_TAKEN');
    // 공백 정규화 후 중복 판정
    expect((await join(ts, '2-3', '  홍길동 ')).status).toBe(409);
    expect((await join(ts, '2-4', '홍길동')).status).toBe(201);
  });
  it('존재하지 않는 학급은 거부', async () => {
    expect((await join(ts, '2-13', 'a')).status).toBe(400);
    expect((await join(ts, '3-1', 'a')).status).toBe(400);
  });
  it('XSS 문자가 포함된 닉네임 거부', async () => {
    expect((await join(ts, '2-3', '<script>')).status).toBe(400);
    expect((await join(ts, '2-3', 'a"onload=')).status).toBe(400);
  });
  it('SQL Injection 형태의 입력은 단순 문자열로 처리된다', async () => {
    const res = await request(ts.url).get("/api/classes/2-1' OR '1'='1/session");
    expect(res.status).toBe(400);
    const q = await request(ts.url).get('/api/logs').query({ eventType: "x' OR 1=1 --" }).set(auth());
    expect(q.status).toBe(200);
    expect(q.body.logs).toEqual([]);
  });
  it('학급 정원 35명을 동시 요청에서도 초과하지 않는다', async () => {
    const results = await Promise.all(Array.from({ length: 45 }, (_, i) => join(ts, '2-5', `학생${i + 1}`)));
    const ok = results.filter((r) => r.status === 201).length;
    const full = results.filter((r) => r.status === 409 && r.body.error === 'CLASS_FULL').length;
    expect(ok).toBe(35);
    expect(full).toBe(10);
    const s = await request(ts.url).get('/api/classes/2-5/session');
    expect(s.body.session.participantCount).toBe(35);
  });
});

describe('권한 검증', () => {
  it('학생 토큰으로 관리자 API 접근 불가', async () => {
    const st = await join(ts, '2-6', '학생A');
    const res = await request(ts.url).get('/api/questions').set('Authorization', `Bearer ${st.body.token}`);
    expect(res.status).toBe(401);
    const reset = await request(ts.url).post('/api/leaderboard/reset').set('x-participant-id', String(st.body.participantId)).set('x-participant-token', st.body.token).send({ scope: 'all', confirm: 'RESET' });
    expect(reset.status).toBe(401);
  });
  it('학생은 다른 학급 참가자/순위를 조회할 수 없다', async () => {
    const st = await join(ts, '2-6', '학생B');
    const h = { 'x-participant-id': String(st.body.participantId), 'x-participant-token': st.body.token };
    expect((await request(ts.url).get('/api/classes/2-6/participants').set(h)).status).toBe(200);
    expect((await request(ts.url).get('/api/classes/2-7/participants').set(h)).status).toBe(403);
    expect((await request(ts.url).get('/api/leaderboard').query({ classId: '2-7' }).set(h)).status).toBe(403);
    expect((await request(ts.url).get('/api/leaderboard').query({ scope: 'school', competitionId: 1 }).set(h)).status).toBe(403);
    expect((await request(ts.url).get('/api/classes/2-6/participants')).status).toBe(403);
    // 위반 시도는 로그로 남는다
    const logs = ts.server.ctx.repos.logs.query({ eventType: 'INVALID_ROOM_ACCESS' });
    expect(logs.total).toBeGreaterThan(0);
  });
  it('학생용 공개 API 응답에는 정답이 포함되지 않는다', async () => {
    const res = await request(ts.url).get('/api/public/projector/2-1');
    expect(JSON.stringify(res.body)).not.toMatch(/correctIndex|correct_index|explanation/);
  });
  it('결과 초기화는 확인 문구가 필요하다', async () => {
    const res = await request(ts.url).post('/api/leaderboard/reset').set(auth()).send({ scope: 'class', classId: '2-6' });
    expect(res.status).toBe(400);
    const ok = await request(ts.url).post('/api/leaderboard/reset').set(auth()).send({ scope: 'class', classId: '2-6', confirm: 'RESET', removeParticipants: true });
    expect(ok.status).toBe(200);
    const p = await request(ts.url).get('/api/classes/2-6/participants').set(auth());
    expect(p.body.participants).toHaveLength(0);
  });
});

describe('대회 관리', () => {
  it('대회 생성 시 지정 학급에 세션이 생성되고, 삭제는 확인이 필요하다', async () => {
    const c = await request(ts.url).post('/api/competitions').set(auth()).send({ title: '11월 대회', quizSetId: 1, classIds: ['2-11', '2-12'] });
    expect(c.status).toBe(201);
    expect(c.body.competition.sessions).toHaveLength(2);
    const s = await request(ts.url).get('/api/classes/2-11/session');
    expect(s.body.session.competitionTitle).toBe('11월 대회');
    const id = c.body.competition.id;
    expect((await request(ts.url).delete(`/api/competitions/${id}`).set(auth())).status).toBe(400);
    expect((await request(ts.url).delete(`/api/competitions/${id}`).query({ confirm: '11월 대회' }).set(auth())).status).toBe(200);
    const after = await request(ts.url).get('/api/classes/2-11/session');
    expect(after.body.session.status).toBe('NO_SESSION');
  });
  it('같은 문제 세트면 일부 학급만 시작해도 비교 가능, 다른 세트가 섞이면 공정성 경고', async () => {
    const same = await request(ts.url).post('/api/competitions').set(auth()).send({ title: '공정 대회', quizSetId: 1, classIds: ['2-9', '2-10'] });
    const sameId = same.body.competition.id;
    ts.server.ctx.sessions.startQuiz('2-9');
    let r = await request(ts.url).get('/api/leaderboard').query({ scope: 'classes', competitionId: sameId }).set(auth());
    expect(r.body.comparable).toBe(true);
    expect(r.body.fairnessWarning).toBeNull();
    ts.server.ctx.sessions.finishQuiz('2-9');

    const q = await request(ts.url).post('/api/questions').set(auth()).send({ questionText: '다른 문제', options: ['a', 'b', 'c', 'd'], correctIndex: 0 });
    const set2 = await request(ts.url).post('/api/quiz-sets').set(auth()).send({ title: '다른 세트', questionIds: [q.body.question.id] });
    const mixed = await request(ts.url).post('/api/competitions').set(auth()).send({ title: '혼합 대회', quizSetId: 1, classIds: ['2-9'] });
    await request(ts.url).post('/api/classes/2-10/session').set(auth()).send({ competitionId: mixed.body.competition.id, quizSetId: set2.body.quizSet.id });
    r = await request(ts.url).get('/api/leaderboard').query({ scope: 'classes', competitionId: mixed.body.competition.id }).set(auth());
    expect(r.body.comparable).toBe(false);
    expect(r.body.fairnessWarning).toContain('공정한 비교가 아닐 수 있습니다');
  });
});
