import type { DB } from '../connection.js';
import { AdminRepository } from './adminRepository.js';
import { AnswerRepository } from './answerRepository.js';
import { ClassRepository } from './classRepository.js';
import { CompetitionRepository } from './competitionRepository.js';
import { ExportRepository } from './exportRepository.js';
import { LogRepository } from './logRepository.js';
import { ParticipantRepository } from './participantRepository.js';
import { QuestionRepository } from './questionRepository.js';
import { QuizSetRepository } from './quizSetRepository.js';
import { SessionRepository } from './sessionRepository.js';
import { SettingsRepository } from './settingsRepository.js';

/**
 * 데이터 접근 계층. 서비스 계층은 SQL을 직접 다루지 않고 이 저장소들만 사용한다.
 * PostgreSQL/MySQL로 이전할 때는 이 폴더의 구현만 교체하면 된다.
 */
export function createRepositories(db: DB) {
  return {
    db,
    admins: new AdminRepository(db),
    classes: new ClassRepository(db),
    questions: new QuestionRepository(db),
    quizSets: new QuizSetRepository(db),
    competitions: new CompetitionRepository(db),
    sessions: new SessionRepository(db),
    participants: new ParticipantRepository(db),
    answers: new AnswerRepository(db),
    logs: new LogRepository(db),
    settings: new SettingsRepository(db),
    exports: new ExportRepository(db),
    /** 여러 저장소 호출을 하나의 트랜잭션으로 묶는다. */
    tx<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
  };
}
export type Repositories = ReturnType<typeof createRepositories>;
export * from './types.js';
