import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type DB = Database.Database;

/**
 * SQLite 연결을 연다.
 * - WAL 모드: 읽기와 쓰기가 서로를 막지 않는다.
 * - synchronous=NORMAL: WAL과 함께 사용할 때 안전하면서 빠른 설정.
 * - foreign_keys=ON: 외래 키 제약 활성화.
 * - busy_timeout: 백업 도구 등 외부 프로세스가 잠금을 잡고 있을 때 대기.
 *
 * better-sqlite3는 동기식이고 Node.js는 단일 스레드이므로, 하나의 트랜잭션은
 * 다른 요청과 섞이지 않고 원자적으로 실행된다(정원 35명 검사 + 삽입 등).
 */
export function openDatabase(filePath: string): DB {
  if (filePath !== ':memory:') fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');
  return db;
}
