import type { DB } from '../connection.js';
import type { AnswerRow } from './types.js';

export class AnswerRepository {
  constructor(private db: DB) {}
  find(participantId: number, questionId: number) {
    return this.db.prepare('SELECT * FROM answers WHERE participant_id = ? AND question_id = ?').get(participantId, questionId) as
      | AnswerRow
      | undefined;
  }
  /** 중복 제출은 UNIQUE(participant_id, question_id) 제약으로 무시된다. 삽입되면 true. */
  insert(a: Omit<AnswerRow, 'id'>): boolean {
    return (
      this.db
        .prepare(
          `INSERT OR IGNORE INTO answers (session_id, participant_id, class_id, question_id, selected_index, is_correct, awarded_score,
           elapsed_ms, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(a.session_id, a.participant_id, a.class_id, a.question_id, a.selected_index, a.is_correct, a.awarded_score, a.elapsed_ms,
          a.submitted_at).changes > 0
    );
  }
  countForQuestion(sessionId: number, questionId: number): number {
    return (this.db.prepare('SELECT COUNT(*) c FROM answers WHERE session_id = ? AND question_id = ?').get(sessionId, questionId) as {
      c: number;
    }).c;
  }
  forQuestion(sessionId: number, questionId: number) {
    return this.db.prepare('SELECT * FROM answers WHERE session_id = ? AND question_id = ?').all(sessionId, questionId) as AnswerRow[];
  }
  bySession(sessionId: number) {
    return this.db.prepare('SELECT * FROM answers WHERE session_id = ?').all(sessionId) as AnswerRow[];
  }
  deleteBySession(sessionId: number) {
    this.db.prepare('DELETE FROM answers WHERE session_id = ?').run(sessionId);
  }
}
