import bcrypt from 'bcrypt';
import { CLASS_CAPACITY, CLASS_IDS, GRADE, classDisplayName } from '@shared/types/index.js';
import type { AppConfig } from '../../config/index.js';
import type { Repositories } from '../repositories/index.js';

export const SAMPLE_QUESTIONS = [
  {
    questionText: '대한민국의 수도는 어디일까요?',
    options: ['부산', '서울', '대전', '인천'],
    correctIndex: 1,
    timeLimit: 20,
    isDoublePoints: false,
    explanation: '대한민국의 수도는 서울특별시입니다.',
    category: '사회',
  },
  {
    questionText: '물의 화학식으로 옳은 것은?',
    options: ['CO₂', 'O₂', 'H₂O', 'NaCl'],
    correctIndex: 2,
    timeLimit: 20,
    isDoublePoints: false,
    explanation: '물은 수소 원자 2개와 산소 원자 1개로 이루어진 H₂O입니다.',
    category: '과학',
  },
  {
    questionText: '일차함수 y = 2x + 3 의 그래프에서 y절편은?',
    options: ['2', '-3', '3', '-2'],
    correctIndex: 2,
    timeLimit: 25,
    isDoublePoints: true,
    explanation: 'x = 0일 때 y = 3 이므로 y절편은 3입니다.',
    category: '수학',
  },
  {
    questionText: '훈민정음을 창제한 조선의 왕은?',
    options: ['태조', '세종대왕', '정조', '영조'],
    correctIndex: 1,
    timeLimit: 20,
    isDoublePoints: false,
    explanation: '세종대왕은 1443년 훈민정음을 창제하고 1446년에 반포했습니다.',
    category: '역사',
  },
  {
    questionText: "다음 중 'apple'의 뜻으로 알맞은 것은?",
    options: ['바나나', '포도', '사과', '오렌지'],
    correctIndex: 2,
    timeLimit: 15,
    isDoublePoints: false,
    explanation: "'apple'은 과일 '사과'를 뜻합니다.",
    category: '영어',
  },
];

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

    if (repos.questions.list(true).length === 0) {
      const ids = SAMPLE_QUESTIONS.map((q, i) =>
        repos.questions.create({ ...q, questionType: 'MULTIPLE_CHOICE', orderNum: i + 1 }, now),
      );
      done.push(`샘플 문제 ${ids.length}개 생성`);
      const setId = repos.quizSets.create(
        { title: '샘플 퀴즈 (기본 5문항)', description: '서버 최초 실행 시 자동 생성된 샘플 문제 세트', category: '종합', questionIds: ids },
        now,
      );
      done.push('샘플 문제 세트 생성');

      if (repos.competitions.list().length === 0) {
        const compId = repos.competitions.create('기본 대회', '최초 실행 시 자동 생성된 기본 대회', now);
        for (const cls of repos.classes.all()) {
          if (cls.current_session_id) continue;
          const sid = repos.sessions.create(cls.id, compId, setId, '샘플 퀴즈 (기본 5문항)', ids.length, now);
          repos.classes.setCurrentSession(cls.id, sid);
        }
        done.push('기본 대회 및 학급별 대기 세션 생성');
      }
    }

    if (!repos.settings.get('projector_name_mode')) repos.settings.set('projector_name_mode', 'MASKED');
    if (!repos.settings.get('leaderboard_size')) repos.settings.set('leaderboard_size', '10');
  });
  return done;
}
