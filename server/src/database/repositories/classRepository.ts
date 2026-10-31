import type { DB } from '../connection.js';
import type { ClassRow } from './types.js';

export class ClassRepository {
  constructor(private db: DB) {}
  all() {
    return this.db.prepare('SELECT * FROM classes ORDER BY grade, class_num').all() as ClassRow[];
  }
  find(id: string) {
    return this.db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRow | undefined;
  }
  upsert(row: Omit<ClassRow, 'current_session_id'>) {
    this.db
      .prepare('INSERT OR IGNORE INTO classes (id, name, grade, class_num, capacity) VALUES (?, ?, ?, ?, ?)')
      .run(row.id, row.name, row.grade, row.class_num, row.capacity);
  }
  setCurrentSession(classId: string, sessionId: number | null) {
    this.db.prepare('UPDATE classes SET current_session_id = ? WHERE id = ?').run(sessionId, classId);
  }
}
