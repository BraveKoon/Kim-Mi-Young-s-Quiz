import type { SessionStatus } from '@shared/types/index.js';
import type { DB } from '../connection.js';
import type { SessionQuestionRow, SessionRow } from './types.js';

export class SessionRepository {
  constructor(private db: DB) {}
  find(id: number) {
    return this.db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(id) as SessionRow | undefined;
  }
  currentForClass(classId: string) {
    return this.db
      .prepare('SELECT s.* FROM class_sessions s JOIN classes c ON c.current_session_id = s.id WHERE c.id = ?')
      .get(classId) as SessionRow | undefined;
  }
  allCurrent() {
    return this.db
      .prepare('SELECT s.* FROM class_sessions s JOIN classes c ON c.current_session_id = s.id')
      .all() as SessionRow[];
  }
  byCompetition(competitionId: number) {
    return this.db.prepare('SELECT * FROM class_sessions WHERE competition_id = ? ORDER BY class_id, id').all(competitionId) as SessionRow[];
  }
  create(classId: string, competitionId: number, quizSetId: number | null, quizSetTitle: string | null, questionCount: number, now: number) {
    return this.db
      .prepare(
        `INSERT INTO class_sessions (class_id, competition_id, quiz_set_id, quiz_set_title, status, question_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'WAITING', ?, ?, ?)`,
      )
      .run(classId, competitionId, quizSetId, quizSetTitle, questionCount, now, now).lastInsertRowid as number;
  }
  update(id: number, patch: Partial<Omit<SessionRow, 'id'>>, now: number) {
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    if (!keys.length) return;
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE class_sessions SET ${sets}, updated_at = @__now WHERE id = @__id`).run({ ...patch, __now: now, __id: id });
  }
  setStatus(id: number, status: SessionStatus, now: number) {
    this.update(id, { status }, now);
  }
  // 문제 스냅샷
  snapshotQuestions(sessionId: number, rows: Omit<SessionQuestionRow, 'id' | 'session_id'>[]) {
    this.db.prepare('DELETE FROM session_questions WHERE session_id = ?').run(sessionId);
    const ins = this.db.prepare(
      `INSERT INTO session_questions (session_id, question_id, order_num, question_type, question_text, options, correct_index,
       time_limit, is_double_points, explanation, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      ins.run(sessionId, r.question_id, r.order_num, r.question_type, r.question_text, r.options, r.correct_index, r.time_limit,
        r.is_double_points, r.explanation, r.category);
    }
  }
  sessionQuestions(sessionId: number) {
    return this.db.prepare('SELECT * FROM session_questions WHERE session_id = ? ORDER BY order_num').all(sessionId) as SessionQuestionRow[];
  }
  sessionQuestionAt(sessionId: number, index: number) {
    return this.db
      .prepare('SELECT * FROM session_questions WHERE session_id = ? ORDER BY order_num LIMIT 1 OFFSET ?')
      .get(sessionId, index) as SessionQuestionRow | undefined;
  }
  sessionQuestion(sessionId: number, questionId: number) {
    return this.db
      .prepare('SELECT * FROM session_questions WHERE session_id = ? AND question_id = ?')
      .get(sessionId, questionId) as SessionQuestionRow | undefined;
  }
  delete(id: number) {
    this.db.prepare('DELETE FROM class_sessions WHERE id = ?').run(id);
  }
}
