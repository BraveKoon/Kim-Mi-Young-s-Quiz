import type { DB } from '../connection.js';
import type { QuestionRow } from './types.js';

export interface QuestionInput {
  questionType: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
  isDoublePoints: boolean;
  orderNum: number;
  explanation: string | null;
  category: string | null;
}

export class QuestionRepository {
  constructor(private db: DB) {}
  list(includeDeleted = false) {
    return this.db
      .prepare(`SELECT * FROM questions ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY order_num, id`)
      .all() as QuestionRow[];
  }
  find(id: number) {
    return this.db.prepare('SELECT * FROM questions WHERE id = ? AND deleted_at IS NULL').get(id) as QuestionRow | undefined;
  }
  count() {
    return (this.db.prepare('SELECT COUNT(*) c FROM questions WHERE deleted_at IS NULL').get() as { c: number }).c;
  }
  create(q: QuestionInput, now: number): number {
    return this.db
      .prepare(
        `INSERT INTO questions (question_type, question_text, options, correct_index, time_limit, is_double_points,
         order_num, explanation, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(q.questionType, q.questionText, JSON.stringify(q.options), q.correctIndex, q.timeLimit, q.isDoublePoints ? 1 : 0,
        q.orderNum, q.explanation, q.category, now, now).lastInsertRowid as number;
  }
  update(id: number, q: QuestionInput, now: number) {
    return this.db
      .prepare(
        `UPDATE questions SET question_type=?, question_text=?, options=?, correct_index=?, time_limit=?, is_double_points=?,
         order_num=?, explanation=?, category=?, updated_at=? WHERE id=? AND deleted_at IS NULL`,
      )
      .run(q.questionType, q.questionText, JSON.stringify(q.options), q.correctIndex, q.timeLimit, q.isDoublePoints ? 1 : 0,
        q.orderNum, q.explanation, q.category, now, id).changes;
  }
  /** 소프트 삭제: 진행 기록(세션 스냅샷)은 보존되고 문제 세트에서는 제거된다. */
  softDelete(id: number, now: number) {
    return this.db.transaction(() => {
      const changes = this.db.prepare('UPDATE questions SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL').run(now, now, id).changes;
      this.db.prepare('DELETE FROM quiz_set_questions WHERE question_id = ?').run(id);
      return changes;
    })();
  }
}
