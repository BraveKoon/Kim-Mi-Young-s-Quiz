import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed, DEFAULT_QUIZ_SET_TITLE } from '../src/database/seeds/index.js';
import { SAMPLE_QUESTIONS } from './fixtures.js';
import { startServer, type TestServer } from './helpers.js';

let ts: TestServer;
beforeAll(async () => {
  ts = await startServer();
});
afterAll(async () => {
  await ts.close();
});

describe('기본 문제 시드', () => {
  it('새 DB는 고사성어·사자성어 30문항 세트와 학급별 대기 세션으로 시작한다', () => {
    const { repos } = ts.server.ctx;
    const set = repos.quizSets.list()[0];
    expect(set.title).toBe(DEFAULT_QUIZ_SET_TITLE);
    expect(repos.quizSets.questionIds(set.id)).toHaveLength(30);
    expect(repos.questions.list().some((q) => q.question_text.includes('대한민국의 수도'))).toBe(false);
    expect(repos.sessions.allCurrent().every((s) => s.quiz_set_id === set.id && s.question_count === 30)).toBe(true);
  });

  it('샘플 5문항을 쓰던 기존 DB는 한 번만 기본 문제로 교체되고, 이후 재실행해도 변화가 없다', async () => {
    const { repos, config } = ts.server.ctx;
    // 이전 버전 DB 상태를 재현: 기본 세트·문제를 지우고 샘플 5문항 + 샘플 세트를 만든 뒤 플래그 제거
    repos.db.prepare('DELETE FROM quiz_sets').run();
    repos.db.prepare('DELETE FROM questions').run();
    const ids = SAMPLE_QUESTIONS.map((q, i) => repos.questions.create({ ...q, questionType: 'MULTIPLE_CHOICE', orderNum: i + 1 }, 1));
    const legacySet = repos.quizSets.create({ title: '샘플 퀴즈 (기본 5문항)', description: null, category: null, questionIds: ids }, 1);
    repos.db.prepare("UPDATE class_sessions SET quiz_set_id = ?, quiz_set_title = '샘플 퀴즈 (기본 5문항)', question_count = 5").run(legacySet);
    repos.db.prepare("DELETE FROM settings WHERE key = 'default_quiz'").run();

    const done = await seed(repos, config);
    expect(done.join('\n')).toContain('기존 샘플 문제 5개 제거');

    expect(repos.quizSets.list().map((s) => s.title)).toEqual([DEFAULT_QUIZ_SET_TITLE]);
    expect(repos.questions.count()).toBe(30);
    const set = repos.quizSets.list()[0];
    const sessions = repos.sessions.allCurrent();
    expect(sessions).toHaveLength(12);
    expect(sessions.every((s) => s.quiz_set_id === set.id && s.question_count === 30)).toBe(true);

    expect(await seed(repos, config)).toEqual([]);
    expect(repos.questions.count()).toBe(30);
  });
});
