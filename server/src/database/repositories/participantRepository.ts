import type { DB } from '../connection.js';
import type { ParticipantRow } from './types.js';

export class ParticipantRepository {
  constructor(private db: DB) {}
  find(id: number) {
    return this.db.prepare('SELECT * FROM participants WHERE id = ?').get(id) as ParticipantRow | undefined;
  }
  bySession(sessionId: number) {
    return this.db.prepare('SELECT * FROM participants WHERE session_id = ? ORDER BY id').all(sessionId) as ParticipantRow[];
  }
  countBySession(sessionId: number): number {
    return (this.db.prepare('SELECT COUNT(*) c FROM participants WHERE session_id = ?').get(sessionId) as { c: number }).c;
  }
  findByNickname(sessionId: number, nickname: string) {
    return this.db.prepare('SELECT * FROM participants WHERE session_id = ? AND nickname = ?').get(sessionId, nickname) as
      | ParticipantRow
      | undefined;
  }
  create(sessionId: number, classId: string, nickname: string, now: number) {
    return this.db
      .prepare('INSERT INTO participants (session_id, class_id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(sessionId, classId, nickname, now, now).lastInsertRowid as number;
  }
  delete(id: number) {
    return this.db.prepare('DELETE FROM participants WHERE id = ?').run(id).changes;
  }
  setSocket(id: number, socketId: string | null, now: number) {
    this.db.prepare('UPDATE participants SET socket_id = ?, last_seen_at = ?, updated_at = ? WHERE id = ?').run(socketId, now, now, id);
  }
  clearAllSockets() {
    this.db.prepare('UPDATE participants SET socket_id = NULL WHERE socket_id IS NOT NULL').run();
  }
  addScore(id: number, score: number, correct: boolean, elapsedMs: number, now: number) {
    this.db
      .prepare(
        `UPDATE participants SET total_score = total_score + ?, correct_count = correct_count + ?, answer_count = answer_count + 1,
         total_elapsed_ms = total_elapsed_ms + ?, updated_at = ? WHERE id = ?`,
      )
      .run(score, correct ? 1 : 0, elapsedMs, now, id);
  }
  resetScores(sessionId: number, now: number) {
    this.db
      .prepare('UPDATE participants SET total_score=0, correct_count=0, answer_count=0, total_elapsed_ms=0, updated_at=? WHERE session_id=?')
      .run(now, sessionId);
  }
  deleteBySession(sessionId: number) {
    this.db.prepare('DELETE FROM participants WHERE session_id = ?').run(sessionId);
  }
  // 토큰
  addToken(participantId: number, tokenHash: string, now: number, expiresAt: number) {
    this.db
      .prepare('INSERT INTO participant_tokens (participant_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(participantId, tokenHash, now, expiresAt);
  }
  findByToken(tokenHash: string, now: number) {
    return this.db
      .prepare(
        `SELECT p.* FROM participant_tokens t JOIN participants p ON p.id = t.participant_id
         WHERE t.token_hash = ? AND t.revoked_at IS NULL AND t.expires_at > ?`,
      )
      .get(tokenHash, now) as ParticipantRow | undefined;
  }
  revokeTokens(participantId: number, now: number) {
    this.db.prepare('UPDATE participant_tokens SET revoked_at = ? WHERE participant_id = ? AND revoked_at IS NULL').run(now, participantId);
  }
  purgeExpiredTokens(now: number) {
    this.db.prepare('DELETE FROM participant_tokens WHERE expires_at < ? OR revoked_at IS NOT NULL').run(now - 86400000);
  }
}
