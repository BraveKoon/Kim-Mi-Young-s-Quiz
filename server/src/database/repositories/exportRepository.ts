import type { DB } from '../connection.js';

export interface ExportRow {
  id: number;
  competition_id: number | null;
  export_type: string;
  file_name: string;
  file_path: string | null;
  created_at: number;
}

export class ExportRepository {
  constructor(private db: DB) {}
  insert(competitionId: number | null, type: string, fileName: string, filePath: string | null, now: number) {
    return this.db
      .prepare('INSERT INTO exports (competition_id, export_type, file_name, file_path, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(competitionId, type, fileName, filePath, now).lastInsertRowid as number;
  }
  list(competitionId?: number) {
    return (competitionId
      ? this.db.prepare('SELECT * FROM exports WHERE competition_id = ? ORDER BY id DESC').all(competitionId)
      : this.db.prepare('SELECT * FROM exports ORDER BY id DESC LIMIT 200').all()) as ExportRow[];
  }
  find(id: number) {
    return this.db.prepare('SELECT * FROM exports WHERE id = ?').get(id) as ExportRow | undefined;
  }
}
