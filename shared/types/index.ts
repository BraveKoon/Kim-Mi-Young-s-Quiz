// ClassQuiz 공유 타입 및 상수 — 서버와 클라이언트가 함께 사용한다.

export const GRADE = 2;
export const CLASS_COUNT = 12;
export const CLASS_CAPACITY = 35;
export const CLASS_IDS: readonly string[] = Array.from({ length: CLASS_COUNT }, (_, i) => `${GRADE}-${i + 1}`);

export function isValidClassId(id: unknown): id is string {
  return typeof id === 'string' && CLASS_IDS.includes(id);
}

export function classDisplayName(classId: string): string {
  const [grade, num] = classId.split('-');
  return `${grade}학년 ${num}반`;
}

export const SESSION_STATUSES = ['WAITING', 'PLAYING', 'RESULT', 'PAUSED', 'FINISHED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const COMPETITION_STATUSES = ['READY', 'ACTIVE', 'FINISHED'] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'OX', 'SHORT_ANSWER'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type NameDisplayMode = 'FULL' | 'MASKED' | 'HIDDEN';

export const LOG_EVENT_TYPES = [
  'STUDENT_JOINED',
  'STUDENT_CONNECTED',
  'STUDENT_RECONNECTED',
  'STUDENT_DISCONNECTED',
  'CONNECTION_REPLACED',
  'STUDENT_REMOVED',
  'DUPLICATE_ANSWER',
  'LATE_ANSWER',
  'ANSWER_WHEN_CLOSED',
  'INVALID_ANSWER',
  'UNAUTHORIZED_ADMIN_EVENT',
  'INVALID_ROOM_ACCESS',
  'INVALID_PARTICIPANT',
  'RATE_LIMITED',
  'ADMIN_LOGIN',
  'ADMIN_LOGIN_FAILED',
  'ADMIN_PASSWORD_CHANGED',
  'ADMIN_CREATED',
  'ADMIN_DELETED',
  'QUIZ_STARTED',
  'QUIZ_PAUSED',
  'QUIZ_RESUMED',
  'QUESTION_STARTED',
  'RESULTS_SHOWN',
  'QUIZ_FINISHED',
  'SESSION_CREATED',
  'CLASS_RESET',
  'ALL_RESET',
  'LEADERBOARD_RESET',
  'DATA_EXPORTED',
  'COMPETITION_DELETED',
  'SERVER_RECOVERED',
] as const;
export type LogEventType = (typeof LOG_EVENT_TYPES)[number];

/** 학생에게 공개되는 문제 정보 (정답/해설 제외) */
export interface PublicQuestion {
  id: number;
  index: number; // 0-based
  questionType: QuestionType;
  text: string;
  options: string[];
  timeLimit: number; // seconds
  isDoublePoints: boolean;
  category: string | null;
}

export interface QuestionResult {
  questionId: number;
  index: number;
  correctIndex: number;
  acceptedAnswers?: string[];
  explanation: string | null;
  distribution: number[]; // 보기별 선택 인원 (단답형은 [정답, 오답])
  answeredCount: number;
  correctCount: number;
  participantCount: number;
  averageElapsedMs: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  prevRank: number | null;
  participantId: number;
  nickname: string;
  classId: string;
  totalScore: number;
  correctCount: number;
  lastAwarded: number;
  lastCorrect: boolean | null;
}

export interface MyStatus {
  participantId: number;
  nickname: string;
  totalScore: number;
  rank: number | null;
  submitted: boolean;
  selectedIndex: number | null;
  answerText?: string | null;
  lastResult: { isCorrect: boolean; awardedScore: number } | null;
}

export interface ClassState {
  classId: string;
  className: string;
  sessionId: number | null;
  competitionId: number | null;
  competitionTitle: string | null;
  quizSetTitle: string | null;
  status: SessionStatus | 'NO_SESSION';
  questionIndex: number; // -1 = 아직 시작 전
  totalQuestions: number;
  question: PublicQuestion | null;
  startTime: number | null;
  endTime: number | null;
  remainingMs: number | null;
  serverNow: number;
  answeredCount: number;
  participantCount: number;
  connectedCount: number;
  capacity: number;
  results: QuestionResult | null;
  leaderboard: LeaderboardEntry[];
  me?: MyStatus;
  /** 관리자 화면에만 포함되는 정답 정보 */
  answerKey?: { correctIndex: number; explanation: string | null; acceptedAnswers?: string[] } | null;
}

export interface ParticipantSummary {
  id: number;
  nickname: string;
  totalScore: number;
  connected: boolean;
}

export interface ClassOverview {
  classId: string;
  className: string;
  capacity: number;
  sessionId: number | null;
  competitionId: number | null;
  competitionTitle: string | null;
  quizSetTitle: string | null;
  status: SessionStatus | 'NO_SESSION';
  questionIndex: number;
  totalQuestions: number;
  participantCount: number;
  connectedCount: number;
  disconnectedCount: number;
  answeredCount: number;
  completedCount: number;
  averageScore: number;
  joinable: boolean;
}

export interface SubmitAnswerAck {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
  message?: string;
}

/** Socket 이벤트 이름 */
export const EVENTS = {
  // admin → server
  ADMIN_START: 'admin:start_quiz',
  ADMIN_PAUSE: 'admin:pause_quiz',
  ADMIN_RESUME: 'admin:resume_quiz',
  ADMIN_NEXT: 'admin:next_question',
  ADMIN_SHOW_RESULTS: 'admin:show_results',
  ADMIN_FINISH: 'admin:finish_quiz',
  ADMIN_RESET_CLASS: 'admin:reset_class',
  ADMIN_RESET_ALL: 'admin:reset_all',
  ADMIN_WATCH: 'admin:watch_class',
  // student → server
  STUDENT_JOIN: 'student:join',
  STUDENT_SUBMIT: 'student:submit_answer',
  STUDENT_REQUEST_STATE: 'student:request_state',
  // projector → server
  PROJECTOR_REQUEST_STATE: 'projector:request_state',
  // server → clients
  STATE: 'quiz:state',
  STARTED: 'quiz:started',
  QUESTION: 'quiz:question',
  TIMER: 'quiz:timer',
  PAUSED: 'quiz:paused',
  RESUMED: 'quiz:resumed',
  ANSWER_RECEIVED: 'quiz:answer_received',
  RESULTS: 'quiz:results',
  MY_RESULT: 'quiz:my_result',
  FINISHED: 'quiz:finished',
  RESET: 'quiz:reset',
  LEADERBOARD: 'leaderboard:updated',
  PARTICIPANTS: 'participants:updated',
  CONNECTION_STATUS: 'connection:status',
  ADMIN_OVERVIEW: 'admin:overview',
  ADMIN_LOG: 'admin:log',
} as const;
