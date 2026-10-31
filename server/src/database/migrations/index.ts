import type { DB } from '../connection.js';
import * as m001 from './001_initial.js';
import * as m002 from './002_short_answer.js';

const migrations: { version: number; name: string; up: string }[] = [
  { version: 1, name: 'initial', up: m001.up },
  { version: 2, name: 'short_answer', up: m002.up },
];

/** 아직 적용되지 않은 마이그레이션을 순서대로 실행한다. */
export function runMigrations(db: DB): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)`);
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  const ran: number[] = [];
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.up);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, Date.now());
    })();
    ran.push(m.version);
  }
  return ran;
}
