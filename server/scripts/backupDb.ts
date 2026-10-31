/**
 * 온라인 백업: 서버 실행 중에도 일관된 스냅샷을 만든다(SQLite backup API).
 *   npm run db:backup -w server [-- 대상경로]
 * 예) cron: 0 * * * * cd /srv/classquiz && npm run db:backup -w server
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config/index.js';

const config = loadConfig();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = process.argv[2] ?? path.join(path.dirname(config.databasePath), 'backups', `classquiz-${stamp}.sqlite`);
fs.mkdirSync(path.dirname(target), { recursive: true });
const db = new Database(config.databasePath, { readonly: true, fileMustExist: true });
await db.backup(target);
db.close();
const check = new Database(target, { readonly: true });
const integrity = check.pragma('integrity_check', { simple: true });
check.close();
console.log(`백업 완료: ${target} (${fs.statSync(target).size} bytes, integrity=${integrity})`);
