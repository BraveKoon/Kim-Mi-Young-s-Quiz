import type { DB } from '../connection.js';
import type { AdminRow } from './types.js';

export class AdminRepository {
  constructor(private db: DB) {}
  list() {
    return this.db.prepare('SELECT * FROM admins ORDER BY id ASC').all() as AdminRow[];
  }
  findByUsername(username: string) {
    return this.db.prepare('SELECT * FROM admins WHERE username = ?').get(username) as AdminRow | undefined;
  }
  findByUsernameInsensitive(username: string) {
    return this.db.prepare('SELECT * FROM admins WHERE LOWER(username) = LOWER(?)').get(username) as AdminRow | undefined;
  }
  findById(id: number) {
    return this.db.prepare('SELECT * FROM admins WHERE id = ?').get(id) as AdminRow | undefined;
  }
  count(): number {
    return (this.db.prepare('SELECT COUNT(*) c FROM admins').get() as { c: number }).c;
  }
  create(username: string, passwordHash: string, mustChange: boolean, now: number) {
    return this.db
      .prepare('INSERT INTO admins (username, password_hash, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(username, passwordHash, mustChange ? 1 : 0, now, now).lastInsertRowid as number;
  }
  deleteById(id: number): number {
    return this.db.prepare('DELETE FROM admins WHERE id = ?').run(id).changes;
  }
  updatePassword(id: number, passwordHash: string, now: number) {
    this.db.prepare('UPDATE admins SET password_hash = ?, must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, now, id);
  }
  revokeToken(jti: string, expiresAt: number) {
    this.db.prepare('INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)').run(jti, expiresAt);
  }
  isRevoked(jti: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(jti);
  }
  purgeExpiredRevocations(now: number) {
    this.db.prepare('DELETE FROM revoked_tokens WHERE expires_at < ?').run(now);
  }
}
