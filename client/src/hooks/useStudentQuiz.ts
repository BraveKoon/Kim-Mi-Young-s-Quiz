import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { EVENTS, type ClassState, type ParticipantSummary, type SubmitAnswerAck } from '@shared/types/index';
import { createSocket, emitAck } from '../socket';

export interface StudentCreds {
  participantId: number;
  token: string;
  nickname: string;
  sessionId: number;
}

const key = (classId: string) => `classquiz.student.${classId}`;
export const credStore = {
  get(classId: string): StudentCreds | null {
    try {
      const raw = localStorage.getItem(key(classId));
      return raw ? (JSON.parse(raw) as StudentCreds) : null;
    } catch {
      return null;
    }
  },
  set(classId: string, c: StudentCreds | null) {
    try {
      if (c) localStorage.setItem(key(classId), JSON.stringify(c));
      else localStorage.removeItem(key(classId));
    } catch {
      /* ignore */
    }
  },
};

export interface MyResult {
  questionId?: number;
  submitted?: boolean;
  selectedIndex?: number | null;
  answerText?: string | null;
  isCorrect?: boolean;
  awardedScore?: number;
  totalScore: number;
  rank: number;
  prevRank?: number | null;
  participantCount: number;
  final?: boolean;
}

export interface MySubmission {
  questionId: number;
  selectedIndex: number | null;
  answerText?: string | null;
}

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'replaced' | 'kicked' | 'error';

const SESSION_INVALID = ['INVALID_PARTICIPANT', 'SESSION_CHANGED', 'INVALID_ROOM_ACCESS'];

/** 학생 퀴즈 소켓 상태 관리. 서버 상태가 기준이며, 클라이언트는 표시만 담당한다. */
export function useStudentQuiz(classId: string, creds: StudentCreds | null, onInvalid: (reason: string) => void) {
  const [state, setState] = useState<ClassState | null>(null);
  const [conn, setConn] = useState<ConnStatus>('idle');
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [answered, setAnswered] = useState<{ answeredCount: number; participantCount: number } | null>(null);
  const [mySubmit, setMySubmit] = useState<MySubmission | null>(null);
  const [myResult, setMyResult] = useState<MyResult | null>(null);
  const [myTotal, setMyTotal] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [timerSync, setTimerSync] = useState<{ serverNow: number; endTime: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const invalidRef = useRef(onInvalid);
  invalidRef.current = onInvalid;

  useEffect(() => {
    if (!creds) return;
    setConn('connecting');
    const socket = createSocket({ role: 'student', participantId: creds.participantId, token: creds.token, classId });
    socketRef.current = socket;

    const applyState = (s: ClassState) => {
      setState(s);
      if (s.me) {
        setMyTotal(s.me.totalScore);
        setMyRank(s.me.rank);
        if (s.question && s.me.submitted) {
          setMySubmit({
            questionId: s.question.id,
            selectedIndex: s.me.selectedIndex,
            answerText: s.me.answerText ?? null,
          });
        }
        if (s.me.lastResult && s.question) {
          setMyResult({
            questionId: s.question.id,
            submitted: s.me.submitted,
            selectedIndex: s.me.selectedIndex,
            answerText: s.me.answerText ?? null,
            isCorrect: s.me.lastResult.isCorrect,
            awardedScore: s.me.lastResult.awardedScore,
            totalScore: s.me.totalScore,
            rank: s.me.rank ?? 0,
            participantCount: s.participantCount,
          });
        }
      }
      if (s.status === 'PLAYING' || s.status === 'PAUSED') setAnswered({ answeredCount: s.answeredCount, participantCount: s.participantCount });
    };
    const onPayload = (p: { state: ClassState }) => applyState(p.state);

    socket.on('connect', () => setConn('connected'));
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') return; // 서버가 끊은 경우: replaced/kicked 처리에서 상태 결정
      setConn('reconnecting');
    });
    socket.on('connect_error', (err) => {
      if (SESSION_INVALID.includes(err.message)) {
        socket.disconnect();
        invalidRef.current(err.message);
      } else setConn('reconnecting');
    });
    socket.on(EVENTS.CONNECTION_STATUS, (p: { status: string }) => {
      if (p.status === 'replaced') {
        setConn('replaced');
        socket.disconnect();
      }
    });
    socket.on(EVENTS.STATE, onPayload);
    socket.on(EVENTS.STARTED, onPayload);
    socket.on(EVENTS.QUESTION, (p: { state: ClassState }) => {
      setMyResult(null);
      setMySubmit((cur) => (cur && p.state.question && cur.questionId === p.state.question.id ? cur : null));
      applyState(p.state);
    });
    socket.on(EVENTS.PAUSED, onPayload);
    socket.on(EVENTS.RESUMED, onPayload);
    socket.on(EVENTS.RESULTS, onPayload);
    socket.on(EVENTS.LEADERBOARD, onPayload);
    socket.on(EVENTS.FINISHED, onPayload);
    socket.on(EVENTS.RESET, (p: { reason: string; state?: ClassState }) => {
      if (p.reason === 'RESET') {
        setMySubmit(null);
        setMyResult(null);
        setMyTotal(0);
        setMyRank(null);
        if (p.state) applyState(p.state);
        return;
      }
      setConn('kicked');
      socket.disconnect();
      invalidRef.current(p.reason);
    });
    socket.on(EVENTS.MY_RESULT, (p: MyResult) => {
      setMyTotal(p.totalScore);
      setMyRank(p.rank);
      if (!p.final) setMyResult(p);
    });
    socket.on(EVENTS.ANSWER_RECEIVED, (p: { answeredCount: number; participantCount: number }) => setAnswered(p));
    socket.on(EVENTS.PARTICIPANTS, (p: { participants: ParticipantSummary[] }) => setParticipants(p.participants));
    socket.on(EVENTS.TIMER, (p: { serverNow: number; endTime: number }) => setTimerSync(p));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [classId, creds]);

  const submit = useCallback(async (questionId: number, answer: number | string): Promise<SubmitAnswerAck> => {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: 'DISCONNECTED', message: '연결이 끊어졌습니다. 재연결 중입니다.' };
    const isShort = typeof answer === 'string';
    const payload = isShort ? { questionId, answerText: answer } : { questionId, selectedIndex: answer };
    setMySubmit({ questionId, selectedIndex: isShort ? null : answer, answerText: isShort ? answer.trim() : null });
    // 네트워크 재전송 대비: 같은 답안을 다시 보내도 서버가 중복으로 처리한다.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const ack = await emitAck<SubmitAnswerAck>(s, EVENTS.STUDENT_SUBMIT, payload, 5000);
        if (!ack.ok) setMySubmit(null);
        return ack;
      } catch {
        /* timeout → 재시도 */
      }
    }
    setMySubmit(null);
    return { ok: false, error: 'TIMEOUT', message: '응답이 없습니다. 다시 시도하세요.' };
  }, []);

  const reconnect = useCallback(() => {
    const s = socketRef.current;
    if (s && !s.connected) {
      setConn('connecting');
      s.connect();
    }
  }, []);

  return { state, conn, participants, answered, mySubmit, myResult, myTotal, myRank, timerSync, submit, reconnect };
}
