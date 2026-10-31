import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Socket } from 'socket.io-client';
import { adminToken, connect, connectStudent, emitAck, sleep, startServer, studentSocket, waitFor, type TestServer } from './helpers.js';

let ts: TestServer;
let token: string;
let admin: Socket;
const sockets: Socket[] = [];
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  ts = await startServer();
  token = await adminToken(ts);
  admin = await connect(ts, { role: 'admin', token });
  sockets.push(admin);
});
afterAll(async () => {
  for (const s of sockets) s.close();
  await ts.close();
});

async function students(classId: string, n: number, prefix = '학생') {
  const list = [];
  for (let i = 1; i <= n; i++) {
    const st = await studentSocket(ts, classId, `${prefix}${i}`);
    sockets.push(st.socket);
    list.push(st);
  }
  return list;
}

/** 2배 문제의 리드인(배너) 시간이 끝날 때까지 대기 */
async function waitUntilStarted(state: any) {
  const wait = state.startTime - state.serverNow;
  if (wait > 0) await sleep(wait + 30);
}

describe('최초 완성 시나리오: 2학년 1반 5명 전체 퀴즈 흐름', () => {
  it('로그인 → 입장 → 시작 → 제출 → 채점 → 결과 → 다음 → 최종 → 통계 → 이력 → 내보내기', async () => {
    const classId = '2-1';
    // 2. 2학년 1반 퀴즈(세션) 생성: 새 대회 + 샘플 문제 세트
    const comp = await request(ts.url).post('/api/competitions').set(auth()).send({ title: '시나리오 대회', quizSetId: 1, classIds: [classId] });
    expect(comp.status).toBe(201);
    const competitionId = comp.body.competition.id;
    const watch = await emitAck(admin, 'admin:watch_class', { classId });
    expect(watch.ok).toBe(true);
    expect(watch.state.status).toBe('WAITING');

    // 3~4. 학생 5명 입장 → 대기실 표시
    const partsUpdate = waitFor(admin, 'participants:updated', (p: any) => p.classId === classId && p.count === 5 && p.connectedCount === 5);
    const ss = await students(classId, 5);
    const pu = await partsUpdate;
    expect(pu.participants.map((p: any) => p.nickname)).toEqual(['학생1', '학생2', '학생3', '학생4', '학생5']);
    expect(ss[0].initial.state.status).toBe('WAITING');
    // 학생이 받은 참가자 목록에는 점수가 노출되지 않음
    const overview = await request(ts.url).get('/api/admin/overview').set(auth());
    expect(overview.body.classes.find((c: any) => c.classId === classId)).toMatchObject({ participantCount: 5, connectedCount: 5 });

    const totalQuestions = 5;
    const expectedTotals = new Map<number, number>();
    for (let qi = 0; qi < totalQuestions; qi++) {
      // 5~6. 시작/다음 문제 → 5명에게 동일한 문제 표시
      const qEvents = ss.map((s) => waitFor<any>(s.socket, 'quiz:question', (p) => p.state.questionIndex === qi));
      const ack = await emitAck(admin, qi === 0 ? 'admin:start_quiz' : 'admin:next_question', { classId });
      expect(ack).toMatchObject({ ok: true });
      const payloads = await Promise.all(qEvents);
      const q = payloads[0].state.question;
      for (const p of payloads) {
        expect(p.state.status).toBe('PLAYING');
        expect(p.state.question.id).toBe(q.id);
        expect(p.state.question.options).toHaveLength(4);
      }
      // 학생에게 정답/해설이 절대 전달되지 않음
      expect(JSON.stringify(payloads)).not.toMatch(/correctIndex|explanation|answerKey/);
      if (q.isDoublePoints) expect(payloads[0].state.startTime).toBeGreaterThan(payloads[0].state.serverNow);
      await waitUntilStarted(payloads[0].state);

      // 관리자는 정답을 볼 수 있음
      const adminState = (await emitAck(admin, 'admin:watch_class', { classId })).state;
      const correct = adminState.answerKey.correctIndex;

      // 7. 학생 답안 제출: 1~3번은 정답, 4번은 오답, 5번은 미응답(1번 문제 한정)
      const resultsP = waitFor<any>(ss[0].socket, 'quiz:results', (p) => p.state.questionIndex === qi, 30000);
      const myResultP = ss.map((s) => waitFor<any>(s.socket, 'quiz:my_result', (p) => p.questionId === q.id, 30000));
      for (let i = 0; i < 5; i++) {
        if (qi === 0 && i === 4) continue;
        const pick = i < 3 ? correct : (correct + 1) % 4;
        // 클라이언트가 점수/정답 여부/응답 시간을 조작해서 보내도 무시된다
        const r = await emitAck(ss[i].socket, 'student:submit_answer', { questionId: q.id, selectedIndex: pick, score: 999999, isCorrect: true, elapsedMs: 0 });
        expect(r).toEqual({ ok: true });
      }
      // 중복 제출(네트워크 재전송) 차단
      const dup = await emitAck(ss[0].socket, 'student:submit_answer', { questionId: q.id, selectedIndex: (correct + 2) % 4 });
      expect(dup).toMatchObject({ ok: true, duplicate: true });

      if (qi === 0) {
        // 1명 미응답 → 자동 마감되지 않으므로 관리자가 결과 공개
        await sleep(300);
        expect((await emitAck(admin, 'admin:show_results', { classId })).ok).toBe(true);
      }
      // 10. 정답 및 순위 공개
      const results = await resultsP;
      expect(results.state.status).toBe('RESULT');
      expect(results.state.results.correctIndex).toBe(correct);
      expect(results.state.results.correctCount).toBe(3);
      expect(results.state.results.answeredCount).toBe(qi === 0 ? 4 : 5);
      expect(results.state.results.distribution.reduce((a: number, b: number) => a + b, 0)).toBe(qi === 0 ? 4 : 5);
      expect(results.state.leaderboard.length).toBe(5);

      // 8~9. 서버가 응답 시간 기준으로 점수 계산
      const mine = await Promise.all(myResultP);
      const max = q.isDoublePoints ? 2000 : 1000;
      for (let i = 0; i < 5; i++) {
        const m = mine[i];
        if (i < 3) {
          expect(m.isCorrect).toBe(true);
          expect(m.awardedScore).toBeGreaterThanOrEqual(max / 2);
          expect(m.awardedScore).toBeLessThanOrEqual(max);
          expect(m.awardedScore).not.toBe(999999);
        } else {
          expect(m.isCorrect).toBe(false);
          expect(m.awardedScore).toBe(0);
        }
        expectedTotals.set(ss[i].participantId, (expectedTotals.get(ss[i].participantId) ?? 0) + m.awardedScore);
        expect(m.totalScore).toBe(expectedTotals.get(ss[i].participantId));
      }
      // DB에 저장된 점수와 일치
      const db = ts.server.ctx.repos.participants.find(ss[0].participantId)!;
      expect(db.total_score).toBe(expectedTotals.get(ss[0].participantId));
      expect(ts.server.ctx.repos.answers.find(ss[0].participantId, q.id)!.selected_index).toBe(correct);
    }

    // 12. 마지막 문제 이후 → 최종 순위
    const finishedP = waitFor<any>(ss[0].socket, 'quiz:finished');
    expect((await emitAck(admin, 'admin:next_question', { classId })).ok).toBe(true);
    const finished = await finishedP;
    expect(finished.state.status).toBe('FINISHED');
    const lb = finished.state.leaderboard;
    expect(lb).toHaveLength(5);
    for (let i = 1; i < lb.length; i++) expect(lb[i - 1].totalScore).toBeGreaterThanOrEqual(lb[i].totalScore);
    expect(lb[lb.length - 1].totalScore).toBe(0);

    // 종료 후 제출 시도는 거부 + 로그
    const late = await emitAck(ss[0].socket, 'student:submit_answer', { questionId: 1, selectedIndex: 0 });
    expect(late).toMatchObject({ ok: false, error: 'CLOSED' });

    // 13. 통계
    const an = await request(ts.url).get(`/api/analytics/competition/${competitionId}`).set(auth());
    expect(an.status).toBe(200);
    expect(an.body.questions).toHaveLength(5);
    const q1 = an.body.questions[0];
    expect(q1).toMatchObject({ participantCount: 5, answeredCount: 4, noAnswerCount: 1, correctCount: 3 });
    expect(q1.correctRateAnswered).toBeCloseTo(0.75);
    expect(q1.correctRateAll).toBeCloseTo(0.6);
    expect(an.body.hardest).toBeTruthy();
    expect(an.body.classRanking.classes[0]).toMatchObject({ classId, participantCount: 5 });
    const cls = await request(ts.url).get(`/api/analytics/class/${classId}`).set(auth());
    expect(cls.body.ranking).toHaveLength(5);

    // 14. 대회 이력 저장 (해당 대회의 유일한 학급이 종료 → 대회 종료)
    const hist = await request(ts.url).get(`/api/competitions/${competitionId}`).set(auth());
    expect(hist.body.competition.status).toBe('FINISHED');
    expect(hist.body.competition.finishedAt).toBeTruthy();
    expect(hist.body.individualRanking).toHaveLength(5);

    // 15. CSV / Excel 다운로드
    const csv = await request(ts.url).get(`/api/exports/${competitionId}/csv`).set(auth()).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(csv.status).toBe(200);
    const csvBuf = csv.body as Buffer;
    expect([...csvBuf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const text = csvBuf.toString('utf8');
    expect(text).toContain('닉네임');
    expect(text).toContain('학생1');
    expect(text.trim().split('\r\n')).toHaveLength(6);

    const xlsx = await request(ts.url).get(`/api/exports/${competitionId}/excel`).set(auth()).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(xlsx.status).toBe(200);
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.body as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['대회 정보', '개인 순위', '학급 순위', '문항별 통계', '접속 기록']);
    expect(wb.getWorksheet('개인 순위')!.getRow(2).getCell(3).value).toBe(lb[0].nickname);

    const saved = await request(ts.url).post(`/api/exports/${competitionId}`).set(auth()).send({ format: 'xlsx' });
    expect(saved.status).toBe(201);
    const dl = await request(ts.url).get(saved.body.export.downloadUrl).set(auth());
    expect(dl.status).toBe(200);
    const exportsList = await request(ts.url).get('/api/exports').set(auth());
    expect(exportsList.body.exports.length).toBeGreaterThanOrEqual(3);
    for (const s of ss) s.socket.close();
  }, 120000);
});

describe('학급 독립성 및 소켓 보안', () => {
  it('한 학급의 시작이 다른 학급에 영향을 주지 않는다', async () => {
    const [a] = await students('2-2', 1, 'A');
    const [b] = await students('2-3', 1, 'B');
    let leaked = false;
    b.socket.on('quiz:question', () => (leaked = true));
    const q = waitFor(a.socket, 'quiz:question');
    expect((await emitAck(admin, 'admin:start_quiz', { classId: '2-2' })).ok).toBe(true);
    await q;
    await sleep(200);
    expect(leaked).toBe(false);
    const s3 = await request(ts.url).get('/api/classes/2-3/session');
    expect(s3.body.session.status).toBe('WAITING');
    const s2 = await request(ts.url).get('/api/classes/2-2/session');
    expect(s2.body.session.status).toBe('PLAYING');
    expect((await emitAck(admin, 'admin:finish_quiz', { classId: '2-2' })).ok).toBe(true);
  });

  it('학생은 admin 이벤트를 실행할 수 없다', async () => {
    const [s] = await students('2-4', 1, 'X');
    const r = await emitAck(s.socket, 'admin:start_quiz', { classId: '2-4' });
    expect(r).toMatchObject({ ok: false, error: 'FORBIDDEN' });
    const r2 = await emitAck(s.socket, 'admin:reset_all', { confirm: 'RESET_ALL' });
    expect(r2.ok).toBe(false);
    expect((await request(ts.url).get('/api/classes/2-4/session')).body.session.status).toBe('WAITING');
    expect(ts.server.ctx.repos.logs.query({ eventType: 'UNAUTHORIZED_ADMIN_EVENT' }).total).toBeGreaterThanOrEqual(2);
  });

  it('다른 학급 Room 접근 차단', async () => {
    const [s] = await students('2-4', 1, 'Y');
    const r = await emitAck(s.socket, 'student:join', { classId: '2-5' });
    expect(r).toMatchObject({ ok: false, error: 'INVALID_ROOM_ACCESS' });
    await expect(connectStudent(ts, s.participantId, s.token, { classId: '2-9' })).rejects.toThrow('INVALID_ROOM_ACCESS');
    expect(ts.server.ctx.repos.logs.query({ eventType: 'INVALID_ROOM_ACCESS' }).total).toBeGreaterThanOrEqual(2);
  });

  it('잘못된 participantId/토큰 및 잘못된 관리자 토큰으로 연결 불가', async () => {
    const [s] = await students('2-4', 1, 'Z');
    await expect(connectStudent(ts, s.participantId + 1000, s.token)).rejects.toThrow('INVALID_PARTICIPANT');
    await expect(connectStudent(ts, s.participantId, 'x'.repeat(43))).rejects.toThrow('INVALID_PARTICIPANT');
    await expect(connect(ts, { role: 'admin', token: 'bad' })).rejects.toThrow('UNAUTHORIZED');
    await expect(connect(ts, { role: 'admin', token: s.token })).rejects.toThrow('UNAUTHORIZED');
    await expect(connect(ts, {})).rejects.toThrow('UNAUTHORIZED');
  });

  it('전체 초기화는 확인 문구가 필요하다', async () => {
    const r = await emitAck(admin, 'admin:reset_all', {});
    expect(r).toMatchObject({ ok: false, error: 'CONFIRM_REQUIRED' });
  });
});

describe('답안 검증 · 타이머 · 재접속', () => {
  it('제한시간 초과/잘못된 문제/잘못된 보기 차단, 일시정지·재개', async () => {
    const classId = '2-7';
    const [s1, s2] = await students(classId, 2, 'T');
    const qP = waitFor<any>(s1.socket, 'quiz:question');
    await emitAck(admin, 'admin:start_quiz', { classId });
    const { state } = await qP;
    const qid = state.question.id;

    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: qid + 999, selectedIndex: 0 })).toMatchObject({ ok: false, error: 'WRONG_QUESTION' });
    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: qid, selectedIndex: 7 })).toMatchObject({ ok: false, error: 'INVALID_OPTION' });
    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: qid, selectedIndex: '1' })).toMatchObject({ ok: false, error: 'INVALID_OPTION' });

    // 일시정지: 남은 시간 저장, 제출 거부
    const pausedP = waitFor<any>(s1.socket, 'quiz:paused');
    expect((await emitAck(admin, 'admin:pause_quiz', { classId })).ok).toBe(true);
    const paused = await pausedP;
    expect(paused.state.status).toBe('PAUSED');
    const remaining = paused.remainingMs;
    expect(remaining).toBeGreaterThan(15000);
    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: qid, selectedIndex: 0 })).toMatchObject({ ok: false, error: 'PAUSED' });
    await sleep(600);
    // 재개: 새 기준 시각 = 지금 + 남은 시간
    const resumedP = waitFor<any>(s1.socket, 'quiz:resumed');
    expect((await emitAck(admin, 'admin:resume_quiz', { classId })).ok).toBe(true);
    const resumed = await resumedP;
    expect(resumed.state.status).toBe('PLAYING');
    expect(Math.abs(resumed.state.endTime - resumed.state.serverNow - remaining)).toBeLessThan(150);

    // 제한시간 초과 (서버 시계 기준) → 차단 + 로그
    ts.clock.offset = 120_000;
    const late = await emitAck(s2.socket, 'student:submit_answer', { questionId: qid, selectedIndex: 0 });
    ts.clock.offset = 0;
    expect(late).toMatchObject({ ok: false, error: 'TIME_OVER' });
    expect(ts.server.ctx.repos.logs.query({ eventType: 'LATE_ANSWER', classId }).total).toBe(1);
    expect(ts.server.ctx.repos.answers.find(s2.participantId, qid)).toBeUndefined();
    await emitAck(admin, 'admin:finish_quiz', { classId });
  });

  it('새로고침/재접속 시 현재 문제·제출 여부·점수·순위 복구, 중복 접속 시 기존 연결 교체', async () => {
    const classId = '2-8';
    const [s1, s2] = await students(classId, 2, 'R');
    const qP = waitFor<any>(s1.socket, 'quiz:question');
    await emitAck(admin, 'admin:start_quiz', { classId });
    const { state } = await qP;
    const qid = state.question.id;
    const correct = (await emitAck(admin, 'admin:watch_class', { classId })).state.answerKey.correctIndex;
    await emitAck(s1.socket, 'student:submit_answer', { questionId: qid, selectedIndex: correct });

    // 같은 학생이 다른 창에서 접속 → 기존 연결은 교체(종료)
    const replacedP = waitFor<any>(s1.socket, 'connection:status', (p) => p.status === 'replaced');
    const disconnectedP = new Promise((r) => s1.socket.once('disconnect', r));
    const again = await connectStudent(ts, s1.participantId, s1.token);
    sockets.push(again.socket);
    await replacedP;
    await disconnectedP;
    const me = again.initial.state.me;
    expect(again.initial.state.status).toBe('PLAYING');
    expect(again.initial.state.question.id).toBe(qid);
    expect(again.initial.state.remainingMs).toBeGreaterThan(0);
    expect(me.submitted).toBe(true);
    expect(me.selectedIndex).toBe(correct);
    // 진행 중에는 이번 문제 점수를 노출하지 않음 (정답 여부 유출 방지)
    expect(me.totalScore).toBe(0);
    expect(ts.server.ctx.presence.count(classId)).toBe(2);

    await emitAck(admin, 'admin:show_results', { classId });
    s2.socket.close();
    await sleep(100);
    const re = await connectStudent(ts, s2.participantId, s2.token);
    sockets.push(re.socket);
    expect(re.initial.state.status).toBe('RESULT');
    expect(re.initial.state.me.submitted).toBe(false);
    const re1 = await emitAck(again.socket, 'student:request_state', {});
    expect(re1.state.me.totalScore).toBeGreaterThan(500);
    expect(re1.state.me.rank).toBe(1);
    expect(re1.state.me.lastResult).toMatchObject({ isCorrect: true });
    expect(ts.server.ctx.repos.logs.query({ eventType: 'CONNECTION_REPLACED', classId }).total).toBe(1);
    expect(ts.server.ctx.repos.logs.query({ eventType: 'STUDENT_RECONNECTED', classId }).total).toBeGreaterThanOrEqual(2);
    await emitAck(admin, 'admin:finish_quiz', { classId });
  });

  it('비정상적으로 많은 이벤트는 속도 제한된다', async () => {
    const [s] = await students('2-9', 1, 'F');
    const acks = await Promise.all(Array.from({ length: 60 }, () => emitAck(s.socket, 'student:request_state', {})));
    expect(acks.filter((a) => a.error === 'RATE_LIMITED').length).toBeGreaterThan(0);
    expect(ts.server.ctx.repos.logs.query({ eventType: 'RATE_LIMITED', classId: '2-9' }).total).toBeGreaterThan(0);
  });
});

describe('서버 재시작 복구', () => {
  it('진행 중이던 세션의 문제·남은 시간·점수가 DB 기준으로 복구된다', async () => {
    const t1 = await startServer();
    const tok = await adminToken(t1);
    const adm = await connect(t1, { role: 'admin', token: tok });
    const st = await studentSocket(t1, '2-10', '복구학생');
    const qP = waitFor<any>(st.socket, 'quiz:question');
    await emitAck(adm, 'admin:start_quiz', { classId: '2-10' });
    const { state } = await qP;
    await emitAck(st.socket, 'student:submit_answer', { questionId: state.question.id, selectedIndex: 1 });
    // 2-11 반도 진행 중으로 만든 뒤 재시작 후 시간이 지난 상황을 검증
    const st2 = await studentSocket(t1, '2-11', '복구학생2');
    await emitAck(adm, 'admin:start_quiz', { classId: '2-11' });
    adm.close();
    st.socket.close();
    st2.socket.close();
    await t1.close();

    // 같은 DB 파일로 서버 재시작
    const t2 = await startServer({ dir: t1.dir });
    const s210 = (await request(t2.url).get('/api/classes/2-10/session')).body.session;
    expect(s210.status).toBe('PLAYING');
    const re = await connectStudent(t2, st.participantId, st.token);
    expect(re.initial.state.question.id).toBe(state.question.id);
    expect(re.initial.state.remainingMs).toBeGreaterThan(10000);
    expect(re.initial.state.me.submitted).toBe(true);
    expect(re.initial.state.me.selectedIndex).toBe(1);
    re.socket.close();
    await t2.close();

    // 제한시간이 지난 뒤 재시작되면 자동으로 마감(RESULT) 처리
    const t3 = await startServer({ dir: t1.dir });
    t3.clock.offset = 60_000;
    t3.server.ctx.sessions.recover();
    expect((await request(t3.url).get('/api/classes/2-11/session')).body.session.status).toBe('RESULT');
    const total = t3.server.ctx.repos.participants.find(st.participantId)!.total_score;
    expect(total).toBeGreaterThan(0); // 샘플 1번 문제 정답 = 1(서울)
    await t3.close();
  }, 60000);
});

describe('O/X 및 단답형 실시간 진행', () => {
  it('O/X와 단답형 문제 진행 시 정답 비노출·채점·재접속 복구·통계·내보내기가 정상 동작한다', async () => {
    const oxRes = await request(ts.url).post('/api/questions').set(auth()).send({
      questionType: 'OX',
      questionText: '물은 1기압에서 100℃에 끓는다.',
      options: ['O', 'X'],
      correctIndex: 0,
      timeLimit: 15,
    });
    const shortRes = await request(ts.url).post('/api/questions').set(auth()).send({
      questionType: 'SHORT_ANSWER',
      questionText: '물의 화학식을 쓰세요.',
      options: ['H2O', '물'],
      correctIndex: 0,
      timeLimit: 20,
      isDoublePoints: false,
    });
    expect(oxRes.status).toBe(201);
    expect(shortRes.status).toBe(201);

    const setRes = await request(ts.url)
      .post('/api/quiz-sets')
      .set(auth())
      .send({ title: 'OX+단답 테스트 세트', questionIds: [oxRes.body.question.id, shortRes.body.question.id] });
    expect(setRes.status).toBe(201);

    const classId = '2-12';
    const compRes = await request(ts.url)
      .post('/api/competitions')
      .set(auth())
      .send({ title: '유형 확장 대회', quizSetId: setRes.body.quizSet.id, classIds: [classId] });
    expect(compRes.status).toBe(201);
    const competitionId = compRes.body.competition.id;

    const [s1, s2] = await students(classId, 2, 'OX단답');

    // 1번 문항: O/X
    const q1P = Promise.all([waitFor<any>(s1.socket, 'quiz:question'), waitFor<any>(s2.socket, 'quiz:question')]);
    expect((await emitAck(admin, 'admin:start_quiz', { classId })).ok).toBe(true);
    const [q1Payload] = await q1P;
    expect(q1Payload.state.question.questionType).toBe('OX');
    expect(q1Payload.state.question.options).toEqual(['O', 'X']);
    // O/X에서 인덱스 2는 거부
    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: q1Payload.state.question.id, selectedIndex: 2 })).toMatchObject({
      ok: false,
      error: 'INVALID_OPTION',
    });
    const r1P = waitFor<any>(s1.socket, 'quiz:results', (p) => p.state.questionIndex === 0);
    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: q1Payload.state.question.id, selectedIndex: 0 })).toEqual({ ok: true });
    expect(await emitAck(s2.socket, 'student:submit_answer', { questionId: q1Payload.state.question.id, selectedIndex: 1 })).toEqual({ ok: true });
    const r1 = await r1P;
    expect(r1.state.results.distribution).toEqual([1, 1]);
    expect(r1.state.results.correctCount).toBe(1);

    // 2번 문항: 단답형
    const q2P = Promise.all([
      waitFor<any>(s1.socket, 'quiz:question', (p) => p.state.questionIndex === 1),
      waitFor<any>(s2.socket, 'quiz:question', (p) => p.state.questionIndex === 1),
    ]);
    expect((await emitAck(admin, 'admin:next_question', { classId })).ok).toBe(true);
    const [q2Payload] = await q2P;
    expect(q2Payload.state.question.questionType).toBe('SHORT_ANSWER');
    // 학생/프로젝터에는 인정 답안(options)이 절대 노출되지 않아야 한다
    expect(q2Payload.state.question.options).toEqual([]);
    expect(JSON.stringify(q2Payload)).not.toContain('H2O');
    const proj = await request(ts.url).get(`/api/public/projector/${classId}`);
    expect(JSON.stringify(proj.body)).not.toContain('H2O');
    // 관리자에게만 인정 답안 노출
    const adminWatch = await emitAck(admin, 'admin:watch_class', { classId });
    expect(adminWatch.state.answerKey.acceptedAnswers).toEqual(['H2O', '물']);

    // 빈 문자열 제출 거부
    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: q2Payload.state.question.id, answerText: '   ' })).toMatchObject({
      ok: false,
      error: 'INVALID_OPTION',
    });
    // 대소문자·앞뒤 공백 정규화로 정답 인정
    expect(await emitAck(s1.socket, 'student:submit_answer', { questionId: q2Payload.state.question.id, answerText: '  h2o  ' })).toEqual({ ok: true });

    // 진행 중 재접속 시 제출 문자열 복구 (정답 여부는 숨김)
    const re = await connectStudent(ts, s1.participantId, s1.token);
    sockets.push(re.socket);
    expect(re.initial.state.me.submitted).toBe(true);
    expect(re.initial.state.me.answerText).toBe('h2o');

    const r2P = waitFor<any>(re.socket, 'quiz:results', (p) => p.state.questionIndex === 1);
    const my2P = waitFor<any>(re.socket, 'quiz:my_result', (p) => p.questionId === q2Payload.state.question.id);
    // s2는 오답 제출 → 전원 제출되어 자동 마감
    expect(await emitAck(s2.socket, 'student:submit_answer', { questionId: q2Payload.state.question.id, answerText: 'CO2' })).toEqual({ ok: true });

    const r2 = await r2P;
    const my2 = await my2P;
    expect(r2.state.results.acceptedAnswers).toEqual(['H2O', '물']);
    expect(r2.state.results.distribution).toEqual([1, 1]);
    expect(my2).toMatchObject({ isCorrect: true, answerText: 'h2o' });
    expect(my2.awardedScore).toBeGreaterThanOrEqual(500);

    // 종료 및 통계/CSV 검증
    expect((await emitAck(admin, 'admin:next_question', { classId })).ok).toBe(true);
    const an = await request(ts.url).get(`/api/analytics/competition/${competitionId}`).set(auth());
    expect(an.status).toBe(200);
    expect(an.body.questions[1]).toMatchObject({
      questionType: 'SHORT_ANSWER',
      acceptedAnswers: ['H2O', '물'],
      distribution: [1, 1],
      correctCount: 1,
    });
    const qCsv = await request(ts.url).get(`/api/exports/${competitionId}/csv?type=questions`).set(auth());
    expect(qCsv.status).toBe(200);
    expect(qCsv.text).toContain('H2O / 물');
  });
});
