import type { LogEventType } from '@shared/types/index.js';
import type { Repositories } from '../database/repositories/index.js';
import type { Clock } from '../utils/clock.js';

export type Severity = 'info' | 'warning' | 'critical';

export interface LogInput {
  classId?: string | null;
  participantId?: number | null;
  sessionId?: number | null;
  severity?: Severity;
  details?: Record<string, unknown>;
}

const SENSITIVE_KEYS = /pass|token|secret|authorization/i;

/** 활동 로그 기록기. 비밀번호·토큰 등 민감 정보는 자동으로 제거한다. */
export class ActivityLogger {
  private listeners: ((entry: unknown) => void)[] = [];
  constructor(private repos: Repositories, private clock: Clock, private console = true) {}

  onLog(fn: (entry: unknown) => void) {
    this.listeners.push(fn);
  }

  log(eventType: LogEventType, input: LogInput = {}) {
    const details = input.details
      ? Object.fromEntries(Object.entries(input.details).filter(([k]) => !SENSITIVE_KEYS.test(k)))
      : undefined;
    const row = {
      class_id: input.classId ?? null,
      participant_id: input.participantId ?? null,
      session_id: input.sessionId ?? null,
      event_type: eventType,
      severity: input.severity ?? 'info',
      details: details ? JSON.stringify(details) : null,
      created_at: this.clock(),
    };
    try {
      const id = this.repos.logs.insert(row);
      const entry = { id, ...row, details: details ?? null };
      for (const l of this.listeners) l(entry);
      if (this.console && row.severity !== 'info') {
        console.warn(`[${row.severity}] ${eventType} class=${row.class_id ?? '-'} participant=${row.participant_id ?? '-'}`);
      }
    } catch (err) {
      console.error('activity log 기록 실패', err);
    }
  }
}
