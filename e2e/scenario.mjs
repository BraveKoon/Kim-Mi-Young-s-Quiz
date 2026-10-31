/**
 * 브라우저 E2E 시나리오 (Playwright 필요: npm i -D playwright && npx playwright install chromium)
 *
 * 1) 서버를 프론트엔드 빌드와 함께 실행:
 *    npm run build
 *    SERVE_CLIENT_DIST=../client/dist CLIENT_ORIGIN=http://localhost:3100 PORT=3100 DATABASE_PATH=./data/e2e.sqlite npm run start -w server
 * 2) node e2e/scenario.mjs http://localhost:3100 [스크린샷 폴더]
 *
 * 관리자 로그인 → 초기 비밀번호 변경 → 학생 5명 입장 → 퀴즈 시작 → 5문항 진행 → 최종 순위 → 통계 → Excel 다운로드
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const SHOTS = process.argv[3] ?? './e2e-screenshots';
const NEW_PW = 'e2e-teacher-pass!';
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [];
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
const watch = (page, label) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${label}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
};

const browser = await chromium.launch();
try {
  // ── 관리자 로그인 + 비밀번호 변경
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const admin = await adminCtx.newPage();
  watch(admin, 'admin');
  await admin.goto(`${BASE}/admin`);
  await admin.fill('#password', '1234');
  await admin.getByRole('button', { name: '로그인' }).click();
  await admin.getByText('초기 비밀번호 변경').waitFor();
  await shot(admin, '01-force-password-change');
  await admin.getByPlaceholder('현재 비밀번호').fill('1234');
  await admin.getByPlaceholder('새 비밀번호 (8자 이상)').fill(NEW_PW);
  await admin.getByPlaceholder('새 비밀번호 확인').fill(NEW_PW);
  await admin.getByRole('button', { name: '비밀번호 변경' }).click();
  await admin.getByRole('heading', { name: '대시보드' }).waitFor();
  await admin.getByText('2학년 12반').first().waitFor();
  await shot(admin, '02-admin-dashboard');
  console.log('✓ 관리자 로그인 및 비밀번호 변경');

  // ── 로비
  const lobbyCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const lobby = await lobbyCtx.newPage();
  watch(lobby, 'lobby');
  await lobby.goto(BASE + '/');
  await lobby.getByText('입장하기 →').first().waitFor();
  await shot(lobby, '03-lobby');

  // ── 프로젝터
  const projCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const projector = await projCtx.newPage();
  watch(projector, 'projector');
  await projector.goto(`${BASE}/projector/2-1`);
  await projector.getByText('닉네임을 입력하고 입장하세요!').waitFor();

  // ── 학생 5명 입장
  const names = ['민준', '서연', '도윤', '하은', '지호'];
  const students = [];
  for (const n of names) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p, n);
    await p.goto(`${BASE}/2-1`);
    await p.fill('#nickname', n);
    await p.getByRole('button', { name: '입장하기' }).click();
    await p.getByText('곧 퀴즈가 시작돼요!').waitFor();
    students.push(p);
  }
  // 중복 닉네임 차단 확인
  {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/2-1`);
    await p.fill('#nickname', '민준');
    await p.getByRole('button', { name: '입장하기' }).click();
    await p.getByText('이미 사용 중인 닉네임입니다').waitFor();
    await ctx.close();
  }
  await students[0].getByText('지호').waitFor();
  await shot(students[0], '04-student-waiting-room');
  await projector.getByText('5명 참가').waitFor();
  await shot(projector, '05-projector-waiting');
  console.log('✓ 학생 5명 입장, 대기실/프로젝터 표시, 중복 닉네임 차단');

  // ── 퀴즈 진행
  await admin.goto(`${BASE}/admin/dashboard/control?class=2-1`);
  await admin.getByText('참가자 5/35').waitFor();
  await admin.getByRole('button', { name: '시작', exact: true }).click();
  for (let qi = 0; qi < 5; qi++) {
    await Promise.all(students.map((p) => p.getByText(`문제 ${qi + 1} / 5`).waitFor()));
    if (qi === 2) {
      await students[0].getByText('⚡ DOUBLE POINTS x2! ⚡').waitFor();
      await shot(students[0], '06-double-points-banner');
    }
    if (qi === 0) await shot(projector, '07-projector-question');
    for (let i = 0; i < students.length; i++) {
      const btn = students[i].locator(`button[aria-label^="${(i % 4) + 1}번"]`);
      await btn.waitFor();
      await students[i].waitForFunction((sel) => !document.querySelector(sel)?.hasAttribute('disabled'), `button[aria-label^="${(i % 4) + 1}번"]`);
      await btn.click();
      await students[i].getByText('제출 완료!').waitFor();
      if (qi === 0 && i === 0) await shot(students[0], '08-student-submitted');
    }
    // 전원 제출 → 서버 자동 마감 → 결과
    await Promise.all(students.map((p) => p.getByText('현재 순위').waitFor({ timeout: 15000 })));
    if (qi === 0) {
      await shot(students[1], '09-student-result');
      await shot(projector, '10-projector-result');
      await shot(admin, '11-admin-control-result');
    }
    const label = qi === 4 ? '최종 순위 발표' : '다음 문제';
    await admin.getByRole('button', { name: label }).click();
  }
  await Promise.all(students.map((p) => p.getByText('최종 결과').waitFor()));
  await projector.getByText('최종 순위 발표').waitFor();
  await students[0].waitForTimeout(3000);
  await shot(students[0], '12-student-final');
  await shot(projector, '13-projector-podium');
  console.log('✓ 5문항 진행, 자동 마감, 결과 공개, 최종 순위');

  // ── 새로고침 후 상태 복구
  await students[2].reload();
  await students[2].getByText('최종 결과').waitFor();
  console.log('✓ 새로고침 후 상태 복구');

  // ── 통계 / 대회 이력 / 내보내기
  await admin.goto(`${BASE}/admin/dashboard/analytics`);
  await admin.getByText('가장 어려웠던 문제').waitFor();
  await admin.getByRole('cell', { name: /대한민국의 수도/ }).click();
  await admin.getByText('Q1 상세 분석').waitFor();
  await shot(admin, '14-admin-question-detail');
  await admin.keyboard.press('Escape');
  await admin.goto(`${BASE}/admin/dashboard/class-ranking`);
  await admin.getByText('2학년 1반').first().waitFor();
  await admin.goto(`${BASE}/admin/dashboard/exports`);
  const [download] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: 'Excel 다운로드' }).click()]);
  const xlsxPath = path.join(SHOTS, 'result.xlsx');
  await download.saveAs(xlsxPath);
  const [csvDl] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: 'CSV' }).first().click()]);
  const csvPath = path.join(SHOTS, 'result.csv');
  await csvDl.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath);
  if (csv[0] !== 0xef || !csv.toString().includes('민준')) throw new Error('CSV 내용 오류');
  if (fs.readFileSync(xlsxPath).subarray(0, 2).toString() !== 'PK') throw new Error('XLSX 형식 오류');
  console.log(`✓ Excel(${fs.statSync(xlsxPath).size}B) / CSV 다운로드: ${download.suggestedFilename()}, ${csvDl.suggestedFilename()}`);
  await admin.goto(`${BASE}/admin/dashboard/logs`);
  await admin.getByRole('cell', { name: '퀴즈 종료' }).first().waitFor();
  await shot(admin, '15-admin-logs');
  await admin.goto(`${BASE}/admin/dashboard/competitions`);
  await admin.getByText('기본 대회').waitFor();
  await shot(admin, '16-admin-competitions');
  await admin.goto(`${BASE}/results/1`);
  await admin.getByText('전체 개인 시상대').waitFor();
  await admin.waitForTimeout(2500);
  await shot(admin, '17-results-page');
  console.log('✓ 통계, 학급 순위, 활동 로그, 대회 이력, 결과 페이지');
  await shot(lobby, '18-lobby-after');

  const realErrors = errors.filter((e) => !/fonts\.g(oogleapis|static)|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|net::ERR/.test(e));
  if (realErrors.length) {
    console.log('콘솔 오류:\n' + realErrors.join('\n'));
    process.exitCode = 1;
  } else console.log('✓ 브라우저 콘솔 오류 없음');
} catch (e) {
  console.error('✗ 실패:', e.message);
  console.error(errors.slice(0, 10).join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
