/**
 * ClassQuiz 단계별 부하 테스트 도구
 *
 * 실제 서버에 학생 소켓을 대량으로 연결해 입장 → 문제 수신 → 동시 답안 제출 → 채점/순위 갱신 → 종료까지 검증한다.
 *
 * 사용법 (서버를 별도 DB로 실행한 뒤):
 *   JOIN_RATE_LIMIT_PER_MINUTE=100000 API_RATE_LIMIT_PER_MINUTE=100000 DATABASE_PATH=./data/loadtest.sqlite npm run dev:server
 *   npm run loadtest -- --url http://localhost:3000 --password <관리자 비밀번호> [--stages 5,35,105,210,420] [--questions 3]
 *
 * 각 단계는 "학급 수 × 학급당 인원" 으로 구성된다: 5=1×5, 35=1×35, 105=3×35, 210=6×35, 420=12×35
 * ⚠️ 테스트용 대회·문제 세트·세션을 생성하므로 운영 DB에서 실행하지 말 것.
 */
import { io as ioc, type Socket } from 'socket.io-client';
import os from 'node:os';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
    return acc;
  }, []),
);
const URL = args.url ?? process.env.LOADTEST_URL ?? 'http://localhost:3000';
const USER = args.username ?? process.env.LOADTEST_ADMIN_USERNAME ?? 'admin';
const PASSWORD = args.password ?? process.env.LOADTEST_ADMIN_PASSWORD ?? '';
const STAGES = (args.stages ?? '5,35,105,210,420').split(',').map(Number);
const QUESTIONS = Number(args.questions ?? 3);
const TIME_LIMIT = Number(args['time-limit'] ?? 10);

type Stage = { total: number; classes: number; perClass: number };
function stageOf(total: number): Stage {
  if (total <= 35) return { total, classes: 1, perClass: total };
  const classes = Math.min(12, Math.ceil(total / 35));
  return { total, classes, perClass: Math.ceil(total / classes) };
}

const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const fmt = (arr: number[]) => `p50=${pct(arr, 50)}ms p95=${pct(arr, 95)}ms max=${arr.length ? Math.max(...arr) : 0}ms (n=${arr.length})`;

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(URL + '/api' + path, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json as any };
}

function connectSocket(auth: Record<string, unknown>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(URL, { auth, transports: ['websocket'], reconnection: false, forceNew: true, timeout: 20000 });
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => reject(e));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CLASS_IDS = Array.from({ length: 12 }, (_, i) => `2-${i + 1}`);

async function main() {
  if (!PASSWORD) {
    console.error('관리자 비밀번호를 --password 로 지정하세요. (기본 비밀번호 1234는 먼저 변경해야 합니다)');
    process.exit(1);
  }
  const login = await api('/admin/login', { method: 'POST', body: { username: USER, password: PASSWORD } });
  if (login.status !== 200 || login.body.admin.mustChangePassword) {
    console.error('관리자 로그인 실패 또는 비밀번호 변경 필요:', login.body);
    process.exit(1);
  }
  const token = login.body.token as string;

  // 테스트용 문제 세트
  const qids: number[] = [];
  for (let i = 0; i < QUESTIONS; i++) {
    const q = await api('/questions', {
      method: 'POST',
      token,
      body: { questionText: `부하테스트 문제 ${i + 1}`, options: ['A', 'B', 'C', 'D'], correctIndex: i % 4, timeLimit: TIME_LIMIT, isDoublePoints: false, category: '부하테스트' },
    });
    qids.push(q.body.question.id);
  }
  const set = await api('/quiz-sets', { method: 'POST', token, body: { title: `부하테스트 ${new Date().toISOString()}`, questionIds: qids } });
  const quizSetId = set.body.quizSet.id as number;

  const admin = await connectSocket({ role: 'admin', token });
  const emit = (event: string, payload: unknown) => admin.timeout(20000).emitWithAck(event, payload) as Promise<any>;

  console.log(`\nClassQuiz 부하 테스트 — 대상 ${URL}`);
  console.log(`클라이언트: ${os.cpus()[0]?.model} ×${os.cpus().length}, RAM ${Math.round(os.totalmem() / 1e9)}GB, Node ${process.version}`);
  console.log(`문항 ${QUESTIONS}개, 제한시간 ${TIME_LIMIT}초\n`);
  const summary: Record<string, unknown>[] = [];

  for (const total of STAGES) {
    const st = stageOf(total);
    const classIds = CLASS_IDS.slice(0, st.classes);
    console.log(`━━ 단계: ${st.classes}개 학급 × ${st.perClass}명 = ${st.classes * st.perClass}명 ━━`);
    const comp = await api('/competitions', { method: 'POST', token, body: { title: `부하테스트 ${total}명`, quizSetId, classIds } });
    if (comp.status !== 201 || comp.body.errors?.length) throw new Error('대회 생성 실패: ' + JSON.stringify(comp.body));
    const competitionId = comp.body.competition.id;

    // 1) 입장 (REST, 동시)
    const joinLat: number[] = [];
    const joinErrors: string[] = [];
    const joined = (
      await Promise.all(
        classIds.flatMap((classId) =>
          Array.from({ length: st.perClass }, async (_, i) => {
            const t0 = Date.now();
            const r = await api(`/classes/${classId}/join`, { method: 'POST', body: { nickname: `부하${i + 1}` } });
            joinLat.push(Date.now() - t0);
            if (r.status !== 201) {
              joinErrors.push(`${classId}:${r.status}:${r.body.error}`);
              return null;
            }
            return { classId, participantId: r.body.participantId as number, token: r.body.token as string };
          }),
        ),
      )
    ).filter(Boolean) as { classId: string; participantId: number; token: string }[];

    // 2) 소켓 연결 (동시)
    const connLat: number[] = [];
    let connFail = 0;
    const students = (
      await Promise.all(
        joined.map(async (j) => {
          const t0 = Date.now();
          try {
            const s = await connectSocket({ role: 'student', participantId: j.participantId, token: j.token });
            connLat.push(Date.now() - t0);
            return { ...j, socket: s };
          } catch {
            connFail++;
            return null;
          }
        }),
      )
    ).filter(Boolean) as { classId: string; participantId: number; token: string; socket: Socket }[];
    await sleep(500);
    const ov = await api('/admin/overview', { token });
    const connectedOnServer = ov.body.classes.filter((c: any) => classIds.includes(c.classId)).reduce((s: number, c: any) => s + c.connectedCount, 0);
    console.log(`  입장 ${joined.length}/${st.classes * st.perClass} (${fmt(joinLat)})${joinErrors.length ? ' 오류:' + joinErrors.slice(0, 3).join(',') : ''}`);
    console.log(`  소켓 연결 ${students.length} 성공 / ${connFail} 실패 (${fmt(connLat)}), 서버 집계 접속 ${connectedOnServer}`);

    // 3) 문제 진행: 문제 수신 시 0.2~3초 후 제출
    const submitLat: number[] = [];
    const questionLag: number[] = [];
    const resultsLag: number[] = [];
    let submitErrors = 0;
    let wrongEvents = 0;
    for (const s of students) {
      s.socket.on('quiz:question', (p: any) => {
        if (p.state.classId !== s.classId) wrongEvents++;
        questionLag.push(Date.now() - p.state.serverNow);
        const delay = 200 + Math.random() * 2800;
        setTimeout(async () => {
          const t0 = Date.now();
          try {
            const r = await s.socket.timeout(20000).emitWithAck('student:submit_answer', {
              questionId: p.state.question.id,
              selectedIndex: Math.floor(Math.random() * 4),
            });
            submitLat.push(Date.now() - t0);
            if (!r.ok) submitErrors++;
          } catch {
            submitErrors++;
          }
        }, delay);
      });
      s.socket.on('quiz:results', (p: any) => resultsLag.push(Date.now() - p.state.serverNow));
    }

    const t0 = Date.now();
    for (let qi = 0; qi < QUESTIONS; qi++) {
      const waitResults = classIds.map(
        (classId) =>
          new Promise<void>((resolve) => {
            const handler = (p: any) => {
              if (p.state.classId === classId && p.state.questionIndex === qi) {
                admin.off('quiz:results', handler);
                resolve();
              }
            };
            admin.on('quiz:results', handler);
          }),
      );
      // 관리자는 학급별 room을 하나씩만 구독하므로 결과는 학생 소켓 기준으로 확인
      const studentResults = classIds.map(
        (classId) =>
          new Promise<void>((resolve) => {
            const s = students.find((x) => x.classId === classId);
            if (!s) return resolve();
            const h = (p: any) => {
              if (p.state.questionIndex === qi) {
                s.socket.off('quiz:results', h);
                resolve();
              }
            };
            s.socket.on('quiz:results', h);
          }),
      );
      void waitResults;
      const acks = await Promise.all(classIds.map((classId) => emit(qi === 0 ? 'admin:start_quiz' : 'admin:next_question', { classId })));
      const failed = acks.filter((a) => !a.ok);
      if (failed.length) console.log('  ⚠ 진행 명령 실패', failed.slice(0, 2));
      await Promise.race([Promise.all(studentResults), sleep((TIME_LIMIT + 5) * 1000)]);
    }
    await Promise.all(classIds.map((classId) => emit('admin:next_question', { classId })));
    const elapsed = Date.now() - t0;

    // 4) 검증: DB에 저장된 답안 수 및 순위
    await sleep(300);
    const an = await api(`/analytics/competition/${competitionId}`, { token });
    const answersSaved = an.body.questions.reduce((s: number, q: any) => s + q.answeredCount, 0);
    const lb = await api(`/leaderboard?scope=school&competitionId=${competitionId}`, { token });
    const expected = students.length * QUESTIONS;
    console.log(`  답안 제출 ${submitLat.length}건, 실패 ${submitErrors} (${fmt(submitLat)})`);
    console.log(`  문제 전달 지연 ${fmt(questionLag)} / 결과 전달 지연 ${fmt(resultsLag)}`);
    console.log(`  DB 저장 답안 ${answersSaved}/${expected}, 전교 순위 인원 ${lb.body.leaderboard?.length}, 다른 학급 이벤트 수신 ${wrongEvents}건`);
    console.log(`  진행 시간 ${(elapsed / 1000).toFixed(1)}초\n`);
    summary.push({
      단계: `${st.classes}×${st.perClass}`,
      접속: `${students.length}/${st.classes * st.perClass}`,
      '제출 p95(ms)': pct(submitLat, 95),
      '제출 max(ms)': submitLat.length ? Math.max(...submitLat) : 0,
      '문제전달 p95(ms)': pct(questionLag, 95),
      'DB 답안': `${answersSaved}/${expected}`,
      실패: submitErrors + connFail + joinErrors.length,
      오배송: wrongEvents,
    });
    for (const s of students) s.socket.close();
    await sleep(500);
  }
  admin.close();
  console.table(summary);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
