import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { AppConfig } from '../config/index.js';
import type { AdminRow, Repositories } from '../database/repositories/index.js';
import type { Clock } from '../utils/clock.js';
import { AppError, badRequest, unauthorized } from '../utils/errors.js';
import type { ActivityLogger } from './activityLogger.js';

export interface AdminTokenPayload {
  sub: string;
  username: string;
  role: 'admin';
  jti: string;
  exp: number;
}

// 존재하지 않는 계정으로 로그인 시에도 비슷한 시간이 걸리도록 하는 더미 해시
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export class AuthService {
  constructor(private repos: Repositories, private config: AppConfig, private clock: Clock, private logger: ActivityLogger) {}

  async login(username: string, password: string, ip?: string) {
    const admin = this.repos.admins.findByUsername(username);
    const ok = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_HASH);
    if (!admin || !ok) {
      this.logger.log('ADMIN_LOGIN_FAILED', { severity: 'warning', details: { username, ip } });
      throw unauthorized('아이디 또는 비밀번호가 올바르지 않습니다.', 'INVALID_CREDENTIALS');
    }
    this.logger.log('ADMIN_LOGIN', { details: { username: admin.username, ip } });
    return this.issue(admin);
  }

  private issue(admin: AdminRow) {
    const token = jwt.sign({ username: admin.username, role: 'admin' }, this.config.jwtSecret, {
      subject: String(admin.id),
      jwtid: crypto.randomUUID(),
      algorithm: 'HS256',
      expiresIn: this.config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
    return { token, admin: this.publicAdmin(admin) };
  }

  publicAdmin(admin: AdminRow) {
    return { id: admin.id, username: admin.username, mustChangePassword: admin.must_change_password === 1 };
  }

  /** JWT 검증 + 폐기 여부 + 계정 존재 확인 */
  verify(token: string | undefined): { admin: AdminRow; payload: AdminTokenPayload } {
    if (!token) throw unauthorized();
    let payload: AdminTokenPayload;
    try {
      payload = jwt.verify(token, this.config.jwtSecret, { algorithms: ['HS256'] }) as AdminTokenPayload;
    } catch {
      throw unauthorized('인증이 만료되었거나 올바르지 않습니다.', 'INVALID_TOKEN');
    }
    if (payload.role !== 'admin' || !payload.jti) throw unauthorized('인증이 올바르지 않습니다.', 'INVALID_TOKEN');
    if (this.repos.admins.isRevoked(payload.jti)) throw unauthorized('로그아웃된 토큰입니다.', 'TOKEN_REVOKED');
    const admin = this.repos.admins.findById(Number(payload.sub));
    if (!admin) throw unauthorized('관리자 계정을 찾을 수 없습니다.', 'INVALID_TOKEN');
    // 비밀번호 변경 이전에 발급된 토큰은 무효
    const iatMs = ((payload as unknown as { iat?: number }).iat ?? 0) * 1000;
    if (admin.password_changed_at && iatMs < admin.password_changed_at - 1000) {
      throw unauthorized('비밀번호가 변경되어 다시 로그인해야 합니다.', 'TOKEN_STALE');
    }
    return { admin, payload };
  }

  logout(payload: AdminTokenPayload) {
    this.repos.admins.revokeToken(payload.jti, payload.exp * 1000);
    this.repos.admins.purgeExpiredRevocations(this.clock());
  }

  async changePassword(admin: AdminRow, currentPassword: string, newPassword: string) {
    if (!(await bcrypt.compare(currentPassword, admin.password_hash))) {
      throw badRequest('현재 비밀번호가 올바르지 않습니다.', 'INVALID_PASSWORD');
    }
    if (currentPassword === newPassword) throw badRequest('새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'SAME_PASSWORD');
    if (newPassword === '1234' || newPassword.toLowerCase() === admin.username.toLowerCase()) {
      throw new AppError(400, 'WEAK_PASSWORD', '추측하기 쉬운 비밀번호는 사용할 수 없습니다.');
    }
    const hash = await bcrypt.hash(newPassword, 12);
    this.repos.admins.updatePassword(admin.id, hash, this.clock());
    this.logger.log('ADMIN_PASSWORD_CHANGED', { details: { username: admin.username } });
    return this.issue(this.repos.admins.findById(admin.id)!);
  }
}
