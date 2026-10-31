import type { SessionStatus } from '@shared/types/index';

export const STATUS_LABEL: Record<SessionStatus | 'NO_SESSION', string> = {
  WAITING: '대기 중',
  PLAYING: '진행 중',
  RESULT: '결과 공개',
  PAUSED: '일시정지',
  FINISHED: '종료',
  NO_SESSION: '세션 없음',
};

export const STATUS_COLOR: Record<SessionStatus | 'NO_SESSION', string> = {
  WAITING: 'bg-sky-400/20 text-sky-200 border-sky-300/30',
  PLAYING: 'bg-lime-400/20 text-lime-200 border-lime-300/30',
  RESULT: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30',
  PAUSED: 'bg-amber-400/20 text-amber-200 border-amber-300/30',
  FINISHED: 'bg-white/10 text-white/60 border-white/20',
  NO_SESSION: 'bg-white/5 text-white/40 border-white/10',
};

export const COMPETITION_STATUS_LABEL: Record<string, string> = { READY: '준비', ACTIVE: '진행 중', FINISHED: '종료' };

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: '4지선다',
  OX: 'O/X',
  SHORT_ANSWER: '단답형',
};

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
export const num = (v: number) => v.toLocaleString('ko-KR');
export const dateTime = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
export const dateOnly = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleDateString('ko-KR') : '-');
export const seconds = (ms: number | null | undefined) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)}초`);

export const OPTION_STYLES = [
  { shape: '▲', name: '빨강', bg: 'bg-opt-red', ring: 'ring-rose-300', hex: '#e5304d' },
  { shape: '◆', name: '파랑', bg: 'bg-opt-blue', ring: 'ring-sky-300', hex: '#2d6cf0' },
  { shape: '●', name: '노랑', bg: 'bg-opt-yellow', ring: 'ring-amber-200', hex: '#f2b705' },
  { shape: '■', name: '초록', bg: 'bg-opt-green', ring: 'ring-emerald-300', hex: '#1fa45a' },
];
