/**
 * 학급별 독립 타이머.
 * - 마감 타이머(setTimeout): 서버가 제한시간 도달 시 답안 접수를 마감한다.
 * - 틱(setInterval): 화면 동기화용 남은 시간 브로드캐스트(1초 간격).
 * 실제 판정은 항상 DB에 저장된 question_start_time / question_end_time 으로 한다.
 */
export class ClassTimers {
  private timers = new Map<string, { expire?: NodeJS.Timeout; tick?: NodeJS.Timeout; extra?: NodeJS.Timeout }>();

  schedule(classId: string, delayMs: number, onExpire: () => void, onTick?: () => void, tickMs = 1000) {
    this.clear(classId);
    const entry: { expire?: NodeJS.Timeout; tick?: NodeJS.Timeout } = {};
    entry.expire = setTimeout(() => {
      this.clear(classId);
      onExpire();
    }, Math.max(0, delayMs));
    if (onTick) entry.tick = setInterval(onTick, tickMs);
    this.timers.set(classId, entry);
  }

  /** 짧은 지연 후 실행 (예: 전원 제출 후 자동 마감). 같은 학급의 이전 예약은 대체된다. */
  defer(classId: string, delayMs: number, fn: () => void) {
    const entry = this.timers.get(classId) ?? {};
    if (entry.extra) clearTimeout(entry.extra);
    entry.extra = setTimeout(fn, delayMs);
    this.timers.set(classId, entry);
  }

  clear(classId: string) {
    const e = this.timers.get(classId);
    if (!e) return;
    if (e.expire) clearTimeout(e.expire);
    if (e.tick) clearInterval(e.tick);
    if (e.extra) clearTimeout(e.extra);
    this.timers.delete(classId);
  }

  clearAll() {
    for (const id of [...this.timers.keys()]) this.clear(id);
  }
}
