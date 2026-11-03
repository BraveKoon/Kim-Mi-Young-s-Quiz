import bcrypt from 'bcrypt';
import { CLASS_CAPACITY, CLASS_IDS, GRADE, classDisplayName } from '@shared/types/index.js';
import { IDIOM_QUIZ_30 } from '@shared/data/idiomQuiz30.js';
import type { AppConfig } from '../../config/index.js';
import type { Repositories } from '../repositories/index.js';

/** 이전 버전이 시드하던 샘플 5문항·세트 — 기존 DB를 기본 문제로 교체할 때만 사용 */
const LEGACY_SAMPLE_TEXTS = [
  '대한민국의 수도는 어디일까요?',
  '물의 화학식으로 옳은 것은?',
  '일차함수 y = 2x + 3 의 그래프에서 y절편은?',
  '훈민정음을 창제한 조선의 왕은?',
  "다음 중 'apple'의 뜻으로 알맞은 것은?",
];
const LEGACY_SAMPLE_SET_TITLE = '샘플 퀴즈 (기본 5문항)';

export const DEFAULT_QUIZ_SET_TITLE = '중2 고사성어·사자성어 퀴즈 (30문항)';
const DEFAULT_QUIZ_FLAG = 'default_quiz';
const DEFAULT_QUIZ_VERSION = 'idiom30';

/**
 * 최초 실행 시 기본 데이터를 생성한다. 이미 존재하는 데이터는 건드리지 않는다(멱등).
 */
export async function seed(repos: Repositories, config: AppConfig, now = Date.now()): Promise<string[]> {
  const done: string[] = [];

  if (repos.admins.count() === 0) {
    const hash = await bcrypt.hash(config.adminPassword, 12);
    repos.admins.create(config.adminUsername, hash, config.forcePasswordChange, now);
    done.push(`관리자 계정 생성 (${config.adminUsername})`);
  }

  repos.tx(() => {
    const existing = new Set(repos.classes.all().map((c) => c.id));
    for (const id of CLASS_IDS) {
      if (existing.has(id)) continue;
      repos.classes.upsert({ id, name: classDisplayName(id), grade: GRADE, class_num: Number(id.split('-')[1]), capacity: CLASS_CAPACITY });
      done.push(`학급 생성 ${id}`);
    }

    seedDefaultQuiz(repos, now, done);

    if (!repos.settings.get('projector_name_mode')) repos.settings.set('projector_name_mode', 'MASKED');
    if (!repos.settings.get('leaderboard_size')) repos.settings.set('leaderboard_size', '10');
  });
  return done;
}

/**
 * 기본 문제(고사성어·사자성어 30문항)와 문제 세트를 준비한다. 서버 시작 시마다 호출되지만 한 번만 적용된다.
 * - 새 DB: 30문항 + 문제 세트 + 기본 대회·학급별 대기 세션 생성
 * - 샘플 5문항을 쓰던 기존 DB: 샘플 문제·세트를 제거하고, 대기 중인 학급 세션을 새 세트로 옮긴다.
 *   (진행했던 세션은 문제 스냅샷을 가지고 있어 기록과 통계가 유지된다.)
 */
function seedDefaultQuiz(repos: Repositories, now: number, done: string[]) {
  if (repos.settings.get(DEFAULT_QUIZ_FLAG) === DEFAULT_QUIZ_VERSION) return;

  let set = repos.quizSets.list().find((s) => s.title === DEFAULT_QUIZ_SET_TITLE);
  if (!set) {
    const ids = IDIOM_QUIZ_30.map((q) => repos.questions.create(q, now));
    const id = repos.quizSets.create(
      { title: DEFAULT_QUIZ_SET_TITLE, description: '중학교 2학년 대상 검수 완료 기본 문제 세트 (4지선다·O/X·단답형)', category: '고사성어', questionIds: ids },
      now,
    );
    set = repos.quizSets.list().find((s) => s.id === id)!;
    done.push(`기본 문제 ${ids.length}개 및 문제 세트 생성`);
  }

  const legacySet = repos.quizSets.list().find((s) => s.title === LEGACY_SAMPLE_SET_TITLE);
  if (legacySet) {
    repos.db
      .prepare("UPDATE class_sessions SET quiz_set_id = ?, quiz_set_title = ?, question_count = ?, updated_at = ? WHERE quiz_set_id = ? AND status = 'WAITING'")
      .run(set.id, set.title, set.question_count, now, legacySet.id);
    repos.quizSets.delete(legacySet.id);
    done.push('기존 샘플 문제 세트 제거');
  }
  const legacy = repos.questions.list().filter((q) => LEGACY_SAMPLE_TEXTS.includes(q.question_text));
  for (const q of legacy) repos.questions.softDelete(q.id, now);
  if (legacy.length) done.push(`기존 샘플 문제 ${legacy.length}개 제거`);

  if (repos.competitions.list().length === 0) {
    const compId = repos.competitions.create('기본 대회', '최초 실행 시 자동 생성된 기본 대회', now);
    for (const cls of repos.classes.all()) {
      if (cls.current_session_id) continue;
      const sid = repos.sessions.create(cls.id, compId, set.id, set.title, set.question_count, now);
      repos.classes.setCurrentSession(cls.id, sid);
    }
    done.push('기본 대회 및 학급별 대기 세션 생성');
  }
  repos.settings.set(DEFAULT_QUIZ_FLAG, DEFAULT_QUIZ_VERSION);
}
