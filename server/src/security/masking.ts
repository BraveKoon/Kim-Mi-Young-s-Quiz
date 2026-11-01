import type { NameDisplayMode } from '@shared/types/index.js';

function maskSingleName(name: string): string {
  const chars = Array.from(name);
  if (chars.length <= 1) return '*';
  if (chars.length === 2) return chars[0] + '*';
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}

/** 프로젝터 등 공개 화면용 닉네임 마스킹: "김민수" → "김*수", "20101 홍길동" → "20101 홍*동" */
export function maskName(name: string): string {
  const m = /^(\d{5})\s+(.+)$/.exec(name);
  if (m) return `${m[1]} ${maskSingleName(m[2])}`;
  return maskSingleName(name);
}

export function displayName(name: string, mode: NameDisplayMode, rank?: number): string {
  if (mode === 'FULL') return name;
  if (mode === 'MASKED') return maskName(name);
  return rank ? `${rank}위 참가자` : '참가자';
}
