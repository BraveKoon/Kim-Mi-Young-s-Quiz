import type { DB } from '../connection.js';
import type { QuestionRow, QuizSetRow } from './types.js';

export class QuizSetRepository {
  constructor(private db: DB) {}
  list() {
    return this.db
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM quiz_set_questions q JOIN questions qq ON qq.id=q.question_id
          WHERE q.quiz_set_id = s.id AND qq.deleted_at IS NULL) AS question_count
         FROM quiz_sets s ORDER BY s.id`,
      )
      .all() as (QuizSetRow & { question_count: number })[];
  }
  find(id: number) {
    return this.db.prepare('SELECT * FROM quiz_sets WHERE id = ?').get(id) as QuizSetRow | undefined;
  }
  questionIds(setId: number): number[] {
    return (this.db
      .prepare(
        `SELECT q.question_id FROM quiz_set_questions q JOIN questions qq ON qq.id = q.question_id
         WHERE q.quiz_set_id = ? AND qq.deleted_at IS NULL ORDER BY q.order_num, q.id`,
      )
      .all(setId) as { question_id: number }[]).map((r) => r.question_id);
  }
  questions(setId: number) {
    return this.db
      .prepare(
        `SELECT qq.* FROM quiz_set_questions q JOIN questions qq ON qq.id = q.question_id
         WHERE q.quiz_set_id = ? AND qq.deleted_at IS NULL ORDER BY q.order_num, q.id`,
      )
      .all(setId) as QuestionRow[];
  }
  create(input: { title: string; description: string | null; category: string | null; questionIds: number[] }, now: number) {
    return this.db.transaction(() => {
      const id = this.db
        .prepare('INSERT INTO quiz_sets (title, description, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(input.title, input.description, input.category, now, now).lastInsertRowid as number;
      this.replaceQuestions(id, input.questionIds);
      return id;
    })();
  }
  update(id: number, input: { title: string; description: string | null; category: string | null; questionIds: number[] }, now: number) {
    return this.db.transaction(() => {
      const changes = this.db
        .prepare('UPDATE quiz_sets SET title=?, description=?, category=?, updated_at=? WHERE id=?')
        .run(input.title, input.description, input.category, now, id).changes;
      if (changes) this.replaceQuestions(id, input.questionIds);
      return changes;
    })();
  }
  private replaceQuestions(setId: number, questionIds: number[]) {
    this.db.prepare('DELETE FROM quiz_set_questions WHERE quiz_set_id = ?').run(setId);
    const ins = this.db.prepare('INSERT INTO quiz_set_questions (quiz_set_id, question_id, order_num) VALUES (?, ?, ?)');
    questionIds.forEach((qid, i) => ins.run(setId, qid, i + 1));
  }
  delete(id: number) {
    return this.db.prepare('DELETE FROM quiz_sets WHERE id = ?').run(id).changes;
  }
}
