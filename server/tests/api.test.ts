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
  it('12개 학급과 기본 세션, 고사성어·사자성어 기본 문제 30개가 생성된다', async () => {
    const res = await request(ts.url).get('/api/classes');
    expect(res.status).toBe(200);
    expect(res.body.classes).toHaveLength(12);
    expect(res.body.classes[0]).toMatchObject({ classId: '2-1', className: '2학년 1반', capacity: 35, status: 'WAITING' });
    expect(res.body.totals.capacity).toBe(420);
    expect(ts.server.ctx.repos.questions.count()).toBe(30);
    expect(res.body.classes.every((c: any) => c.status === 'WAITING')).toBe(true);
    const sets = ts.server.ctx.repos.quizSets.list();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ title: '중2 고사성어·사자성어 퀴즈 (30문항)', question_count: 30 });
    const types = new Set(ts.server.ctx.repos.questions.list().map((q) => q.question_type));
    expect([...types].sort()).toEqual(['MULTIPLE_CHOICE', 'OX', 'SHORT_ANSWER']);
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
  it('API 단독 모드에서 루트(/)와 /api/health 모두 200 OK를 반환한다', async () => {
    const rootRes = await request(ts.url).get('/');
    expect(rootRes.status).toBe(200);
    expect(rootRes.body).toMatchObject({ ok: true, service: 'ClassQuiz API' });
    const healthRes = await request(ts.url).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.ok).toBe(true);
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

describe('관리자 계정 관리', () => {
  it('목록 조회 시 비밀번호 해시를 노출하지 않으며 마지막 관리자는 삭제할 수 없다', async () => {
    const list = await request(ts.url).get('/api/admins').set(auth());
    expect(list.status).toBe(200);
    expect(list.body.admins).toHaveLength(1);
    expect(list.body.admins[0]).toMatchObject({ username: 'admin', mustChangePassword: false });
    expect(JSON.stringify(list.body)).not.toContain('password_hash');

    const lastDel = await request(ts.url).delete(`/api/admins/${list.body.admins[0].id}`).set(auth());
    expect(lastDel.status).toBe(409);
    expect(lastDel.body.error).toBe('LAST_ADMIN');
  });

  it('새 관리자 추가 시 첫 로그인 비밀번호 변경을 강제하고, 본인 삭제 금지 및 계정 삭제 시 토큰을 즉시 무효화한다', async () => {
    // 중복 아이디(대소문자 무시)·약한 비밀번호·잘못된 형식 차단
    expect((await request(ts.url).post('/api/admins').set(auth()).send({ username: 'Admin', password: 'temp-pass-2026!' })).status).toBe(409);
    expect((await request(ts.url).post('/api/admins').set(auth()).send({ username: 'teacher2', password: 'teacher2' })).status).toBe(400);
    expect((await request(ts.url).post('/api/admins').set(auth()).send({ username: '한글아이디', password: 'temp-pass-2026!' })).status).toBe(400);

    // 새 관리자 생성
    const created = await request(ts.url).post('/api/admins').set(auth()).send({ username: 'teacher_kim', password: 'init-pass-2026!' });
    expect(created.status).toBe(201);
    expect(created.body.admin).toMatchObject({ username: 'teacher_kim', mustChangePassword: true });
    const newId = created.body.admin.id as number;

    // 새 관리자로 첫 로그인 → 비밀번호 변경 전까지 관리자 API 차단
    const firstLogin = await request(ts.url).post('/api/admin/login').send({ username: 'teacher_kim', password: 'init-pass-2026!' });
    expect(firstLogin.status).toBe(200);
    expect(firstLogin.body.admin.mustChangePassword).toBe(true);
    const blocked = await request(ts.url).get('/api/admins').set('Authorization', `Bearer ${firstLogin.body.token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('PASSWORD_CHANGE_REQUIRED');

    // 비밀번호 변경 후 정상 사용 가능
    const changed = await request(ts.url)
      .post('/api/admin/change-password')
      .set('Authorization', `Bearer ${firstLogin.body.token}`)
      .send({ currentPassword: 'init-pass-2026!', newPassword: 'kim-new-password-99!' });
    expect(changed.status).toBe(200);
    expect(changed.body.admin.mustChangePassword).toBe(false);
    const kimToken = changed.body.token as string;

    const listAsKim = await request(ts.url).get('/api/admins').set('Authorization', `Bearer ${kimToken}`);
    expect(listAsKim.status).toBe(200);
    expect(listAsKim.body.admins).toHaveLength(2);

    // 본인 계정 삭제는 거부
    const selfDel = await request(ts.url).delete(`/api/admins/${newId}`).set('Authorization', `Bearer ${kimToken}`);
    expect(selfDel.status).toBe(409);
    expect(selfDel.body.error).toBe('CANNOT_DELETE_SELF');

    // 기존 관리자(admin)가 teacher_kim 삭제 → 성공 및 토큰 즉시 무효화
    const delRes = await request(ts.url).delete(`/api/admins/${newId}`).set(auth());
    expect(delRes.status).toBe(200);
    expect((await request(ts.url).get('/api/admin/me').set('Authorization', `Bearer ${kimToken}`)).status).toBe(401);
    expect((await request(ts.url).delete(`/api/admins/${newId}`).set(auth())).status).toBe(404);

    // 활동 로그 기록 확인
    expect(ts.server.ctx.repos.logs.query({ eventType: 'ADMIN_CREATED' }).total).toBeGreaterThanOrEqual(1);
    expect(ts.server.ctx.repos.logs.query({ eventType: 'ADMIN_DELETED' }).total).toBeGreaterThanOrEqual(1);
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
  it('O/X 및 단답형 문제 생성·검증·삭제', async () => {
    // O/X: 보기 2개가 아니면 거부
    const badOx = await request(ts.url).post('/api/questions').set(auth()).send({
      questionType: 'OX',
      questionText: '지구는 둥글다.',
      options: ['O', 'X', '모름'],
      correctIndex: 0,
    });
    expect(badOx.status).toBe(400);

    const ox = await request(ts.url).post('/api/questions').set(auth()).send({
      questionType: 'OX',
      questionText: '지구는 태양 주위를 공전한다.',
      options: ['O', 'X'],
      correctIndex: 0,
      timeLimit: 15,
      category: '과학',
    });
    expect(ox.status).toBe(201);
    expect(ox.body.question).toMatchObject({ questionType: 'OX', options: ['O', 'X'], correctIndex: 0 });

    // 단답형: 인정 답안 1~5개, correctIndex=0
    const badShort = await request(ts.url).post('/api/questions').set(auth()).send({
      questionType: 'SHORT_ANSWER',
      questionText: '훈민정음 창제 왕은?',
      options: [],
      correctIndex: 0,
    });
    expect(badShort.status).toBe(400);

    const short = await request(ts.url).post('/api/questions').set(auth()).send({
      questionType: 'SHORT_ANSWER',
      questionText: '훈민정음을 창제한 왕은?',
      options: ['세종대왕', '세종'],
      correctIndex: 0,
      timeLimit: 20,
      category: '역사',
    });
    expect(short.status).toBe(201);
    expect(short.body.question).toMatchObject({
      questionType: 'SHORT_ANSWER',
      options: ['세종대왕', '세종'],
      correctIndex: 0,
    });

    // 테스트 후 소프트 삭제하여 기본 시드 문항 개수에 영향 없게 정리
    expect((await request(ts.url).delete(`/api/questions/${ox.body.question.id}`).set(auth())).status).toBe(200);
    expect((await request(ts.url).delete(`/api/questions/${short.body.question.id}`).set(auth())).status).toBe(200);
  });

  it('JSON 문제 일괄 등록(POST /api/questions/bulk)으로 30문항 프리셋과 문제 세트를 한 번에 생성한다', async () => {
    const { IDIOM_QUIZ_30 } = await import('../../client/src/data/idiomQuiz30.js');
    const res = await request(ts.url).post('/api/questions/bulk').set(auth()).send({
      questions: IDIOM_QUIZ_30,
      replaceExisting: false,
      quizSetTitle: '중2 고사성어·사자성어 퀴즈 (30문항)',
      quizSetDescription: '검수 완료 30문항 세트',
      quizSetCategory: '고사성어',
    });
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(30);
    expect(res.body.questionIds).toHaveLength(30);
    expect(res.body.quizSetId).toBeGreaterThan(0);

    const setRes = await request(ts.url).get(`/api/quiz-sets/${res.body.quizSetId}`).set(auth());
    expect(setRes.status).toBe(200);
    expect(setRes.body.quizSet.questionCount).toBe(30);

    // 정리
    expect((await request(ts.url).delete(`/api/quiz-sets/${res.body.quizSetId}`).set(auth())).status).toBe(200);
    for (const id of res.body.questionIds) {
      await request(ts.url).delete(`/api/questions/${id}`).set(auth());
    }
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
  it('학번+이름 형식(20101 홍길동 등 최대 20자) 닉네임 입장 허용', async () => {
    const r1 = await join(ts, '2-1', '20101 홍길동');
    expect(r1.status).toBe(201);
    expect(r1.body.nickname).toBe('20101 홍길동');
    const r2 = await join(ts, '2-12', '21235 Christopher');
    expect(r2.status).toBe(201);
    expect(r2.body.nickname).toBe('21235 Christopher');
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

  it('활동 로그와 내보내기 기록을 초기화할 수 있다 (확인 문구 필수, 초기화 사실은 로그로 남음)', async () => {
    const comp = await request(ts.url).post('/api/competitions').set(auth()).send({ title: '내보내기 기록 대회', quizSetId: 1, classIds: ['2-8'] });
    const cid = comp.body.competition.id;
    const saved = await request(ts.url).post(`/api/exports/${cid}`).set(auth()).send({ format: 'csv' });
    expect(saved.status).toBe(201);
    const filePath = ts.server.ctx.repos.exports.list(cid)[0].file_path!;
    const fs = await import('node:fs');
    expect(fs.existsSync(filePath)).toBe(true);
    expect((await request(ts.url).get('/api/exports').set(auth())).body.exports.length).toBeGreaterThan(0);

    // 학생·비로그인·확인 문구 누락은 거부
    expect((await request(ts.url).delete('/api/exports').send({ confirm: 'RESET' })).status).toBe(401);
    expect((await request(ts.url).delete('/api/exports').set(auth()).send({})).status).toBe(400);
    expect((await request(ts.url).delete('/api/logs').set(auth()).send({ confirm: 'reset' })).status).toBe(400);
    expect(fs.existsSync(filePath)).toBe(true);

    const ex = await request(ts.url).delete('/api/exports').set(auth()).send({ confirm: 'RESET' });
    expect(ex.status).toBe(200);
    expect(ex.body.deleted).toBeGreaterThan(0);
    expect(ex.body.filesDeleted).toBe(1);
    expect(fs.existsSync(filePath)).toBe(false);
    expect((await request(ts.url).get('/api/exports').set(auth())).body.exports).toEqual([]);

    const logs = await request(ts.url).delete('/api/logs').set(auth()).send({ confirm: 'RESET' });
    expect(logs.status).toBe(200);
    expect(logs.body.deleted).toBeGreaterThan(0);
    const after = await request(ts.url).get('/api/logs').set(auth());
    // 남아 있는 로그는 "초기화했다"는 기록 1건뿐이어야 한다
    expect(after.body.logs.map((l: any) => l.eventType)).toEqual(['LOGS_RESET']);
    expect(ts.server.ctx.repos.logs.query({ eventType: 'EXPORTS_RESET' }).total).toBe(0);
  });
});
