import crypto from 'node:crypto';

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** 참가자 토큰은 원문을 저장하지 않고 SHA-256 해시만 저장한다. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
