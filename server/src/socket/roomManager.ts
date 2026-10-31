/** Room 이름 규칙 */
export const rooms = {
  class: (classId: string) => `room:${classId}`,
  projector: (classId: string) => `projector:${classId}`,
  adminClass: (classId: string) => `admin:${classId}`,
  admins: 'admins',
  participant: (id: number) => `participant:${id}`,
};

/**
 * 서버 메모리 기반 접속 현황.
 * 참가자 1명당 활성 연결은 1개만 유지한다(새 연결이 기존 연결을 대체).
 * DB(participants.socket_id, last_seen_at)에도 함께 기록하지만, 서버 재시작 시에는
 * 실제 연결이 모두 끊어지므로 메모리 상태가 기준이 된다.
 */
export class Presence {
  private byParticipant = new Map<number, { socketId: string; classId: string }>();
  private byClass = new Map<string, Set<number>>();
  private everConnected = new Set<number>();

  /** 연결 등록. 기존 소켓이 있으면 그 소켓 ID를 반환한다. */
  connect(participantId: number, classId: string, socketId: string): { previousSocketId?: string; reconnected: boolean } {
    const prev = this.byParticipant.get(participantId);
    this.byParticipant.set(participantId, { socketId, classId });
    if (!this.byClass.has(classId)) this.byClass.set(classId, new Set());
    this.byClass.get(classId)!.add(participantId);
    const reconnected = this.everConnected.has(participantId);
    this.everConnected.add(participantId);
    return { previousSocketId: prev && prev.socketId !== socketId ? prev.socketId : undefined, reconnected };
  }

  /** 현재 등록된 소켓과 일치할 때만 해제한다(교체된 이전 소켓의 disconnect는 무시). */
  disconnect(participantId: number, socketId: string): boolean {
    const cur = this.byParticipant.get(participantId);
    if (!cur || cur.socketId !== socketId) return false;
    this.byParticipant.delete(participantId);
    this.byClass.get(cur.classId)?.delete(participantId);
    return true;
  }

  remove(participantId: number) {
    const cur = this.byParticipant.get(participantId);
    if (cur) this.byClass.get(cur.classId)?.delete(participantId);
    this.byParticipant.delete(participantId);
    this.everConnected.delete(participantId);
  }

  socketOf(participantId: number) {
    return this.byParticipant.get(participantId)?.socketId;
  }
  isConnected(participantId: number) {
    return this.byParticipant.has(participantId);
  }
  connectedIds(classId: string): number[] {
    return [...(this.byClass.get(classId) ?? [])];
  }
  count(classId: string) {
    return this.byClass.get(classId)?.size ?? 0;
  }
  total() {
    return this.byParticipant.size;
  }
}
