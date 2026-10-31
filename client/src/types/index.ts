export * from '@shared/types/index';

export interface AdminInfo {
  id: number;
  username: string;
  mustChangePassword: boolean;
}

export interface Question {
  id: number;
  questionType: 'MULTIPLE_CHOICE' | 'OX' | 'SHORT_ANSWER';
  questionText: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
  isDoublePoints: boolean;
  orderNum: number;
  explanation: string | null;
  category: string | null;
}

export interface QuizSet {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  questionCount: number;
  questions: Question[];
}

export interface CompetitionSession {
  id: number;
  classId: string;
  className: string;
  quizSetId: number | null;
  quizSetTitle: string | null;
  status: string;
  questionCount: number;
  participantCount: number;
  isCurrent: boolean;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface Competition {
  id: number;
  title: string;
  description: string | null;
  status: 'READY' | 'ACTIVE' | 'FINISHED';
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  sessions: CompetitionSession[];
  comparable: boolean;
  quizSets: string[];
  fairnessWarning: string | null;
}

export interface QuestionStat {
  questionId: number;
  order: number;
  text: string;
  options: string[];
  correctIndex: number;
  isDoublePoints: boolean;
  timeLimit: number;
  category: string | null;
  participantCount: number;
  answeredCount: number;
  noAnswerCount: number;
  correctCount: number;
  correctRateAnswered: number;
  correctRateAll: number;
  distribution: number[];
  averageElapsedMs: number | null;
  averageScore: number;
  byClass: { classId: string; participantCount: number; answeredCount: number; correctCount: number; correctRateAll: number }[];
}

export interface ClassRankRow {
  rank: number;
  sessionId: number;
  classId: string;
  quizSetTitle: string | null;
  status: string;
  questionCount: number;
  participantCount: number;
  averageScore: number;
  totalScore: number;
  maxScore: number;
  accuracy: number;
}
