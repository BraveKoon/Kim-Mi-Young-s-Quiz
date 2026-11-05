import type { DB } from '../connection.js';
import type { LogRow } from './types.js';

export interface LogFilter {
  from?: number;
  to?: number;
  classId?: string;
  eventType?: string;
  participantId?: number;
  severity?: string;
  limit?: number;
  offset?: number;
}

export class LogRepository {
  constructor(private db: DB) {}
  insert(row: Omit<LogRow, 'id'>) {
    return this.db
      .prepare(
        'INSERT INTO activity_logs (class_id, participant_id, session_id, event_type, severity, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(row.class_id, row.participant_id, row.session_id, row.event_type, row.severity, row.details, row.created_at)
      .lastInsertRowid as number;
  }
  private where(f: LogFilter) {
    const conds: string[] = [];
    const params: Record<string, unknown> = {};
    if (f.from !== undefined) (conds.push('l.created_at >= @from'), (params.from = f.from));
    if (f.to !== undefined) (conds.push('l.created_at <= @to'), (params.to = f.to));
    if (f.classId) (conds.push('l.class_id = @classId'), (params.classId = f.classId));
    if (f.eventType) (conds.push('l.event_type = @eventType'), (params.eventType = f.eventType));
    if (f.participantId) (conds.push('l.participant_id = @participantId'), (params.participantId = f.participantId));
    if (f.severity) (conds.push('l.severity = @severity'), (params.severity = f.severity));
    return { sql: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
  }
  query(f: LogFilter) {
    const { sql, params } = this.where(f);
    const rows = this.db
      .prepare(
        `SELECT l.*, p.nickname FROM activity_logs l LEFT JOIN participants p ON p.id = l.participant_id ${sql}
         ORDER BY l.created_at DESC, l.id DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: f.limit ?? 200, offset: f.offset ?? 0 }) as (LogRow & { nickname: string | null })[];
    const total = (this.db.prepare(`SELECT COUNT(*) c FROM activity_logs l ${sql}`).get(params) as { c: number }).c;
    return { rows, total };
  }
  iterate(f: LogFilter) {
    const { sql, params } = this.where(f);
    return this.db
      .prepare(
        `SELECT l.*, p.nickname FROM activity_logs l LEFT JOIN participants p ON p.id = l.participant_id ${sql} ORDER BY l.created_at DESC, l.id DESC`,
      )
      .iterate(params) as IterableIterator<LogRow & { nickname: string | null }>;
  }
  /** 활동 로그 전체 삭제. 삭제한 건수를 반환한다. */
  deleteAll(): number {
    return this.db.prepare('DELETE FROM activity_logs').run().changes;
  }
  bySessions(sessionIds: number[]) {
    if (!sessionIds.length) return [];
    return this.db
      .prepare(
        `SELECT l.*, p.nickname FROM activity_logs l LEFT JOIN participants p ON p.id = l.participant_id
         WHERE l.session_id IN (${sessionIds.map(() => '?').join(',')}) ORDER BY l.created_at`,
      )
      .all(...sessionIds) as (LogRow & { nickname: string | null })[];
  }
}
