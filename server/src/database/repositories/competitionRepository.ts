import type { DB } from '../connection.js';
import type { CompetitionRow } from './types.js';

export class CompetitionRepository {
  constructor(private db: DB) {}
  list() {
    return this.db.prepare('SELECT * FROM competitions ORDER BY id DESC').all() as CompetitionRow[];
  }
  find(id: number) {
    return this.db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as CompetitionRow | undefined;
  }
  create(title: string, description: string | null, now: number) {
    return this.db
      .prepare("INSERT INTO competitions (title, description, status, created_at) VALUES (?, ?, 'READY', ?)")
      .run(title, description, now).lastInsertRowid as number;
  }
  update(id: number, title: string, description: string | null) {
    return this.db.prepare('UPDATE competitions SET title=?, description=? WHERE id=?').run(title, description, id).changes;
  }
  markStarted(id: number, now: number) {
    this.db
      .prepare("UPDATE competitions SET status='ACTIVE', started_at=COALESCE(started_at, ?), finished_at=NULL WHERE id=? AND status != 'ACTIVE'")
      .run(now, id);
  }
  markFinished(id: number, now: number) {
    this.db.prepare("UPDATE competitions SET status='FINISHED', finished_at=? WHERE id=?").run(now, id);
  }
  delete(id: number) {
    return this.db.prepare('DELETE FROM competitions WHERE id = ?').run(id).changes;
  }
}
