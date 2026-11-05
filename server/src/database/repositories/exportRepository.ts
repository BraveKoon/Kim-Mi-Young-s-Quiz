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
  /** 내보내기 기록 전체 삭제. 서버에 저장돼 있던 파일 경로 목록을 돌려줘 호출한 쪽이 파일도 지울 수 있게 한다. */
  deleteAll(): { count: number; filePaths: string[] } {
    const rows = this.db.prepare('SELECT file_path FROM exports').all() as { file_path: string | null }[];
    const count = this.db.prepare('DELETE FROM exports').run().changes;
    return { count, filePaths: rows.map((r) => r.file_path).filter((p): p is string => !!p) };
  }
  find(id: number) {
    return this.db.prepare('SELECT * FROM exports WHERE id = ?').get(id) as ExportRow | undefined;
  }
}
