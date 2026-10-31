import type { CompetitionStatus, QuestionType, SessionStatus } from '@shared/types/index.js';

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  must_change_password: number;
  password_changed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ClassRow {
  id: string;
  name: string;
  grade: number;
  class_num: number;
  capacity: number;
  current_session_id: number | null;
}

export interface QuestionRow {
  id: number;
  question_type: QuestionType;
  question_text: string;
  options: string;
  correct_index: number;
  time_limit: number;
  is_double_points: number;
  order_num: number;
  explanation: string | null;
  category: string | null;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface QuizSetRow {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  created_at: number;
  updated_at: number;
}

export interface CompetitionRow {
  id: number;
  title: string;
  description: string | null;
  status: CompetitionStatus;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
}

export interface SessionRow {
  id: number;
  class_id: string;
  competition_id: number;
  quiz_set_id: number | null;
  quiz_set_title: string | null;
  status: SessionStatus;
  current_question_id: number | null;
  current_question_index: number;
  question_count: number;
  question_start_time: number | null;
  question_end_time: number | null;
  paused_remaining_ms: number | null;
  paused_from_status: SessionStatus | null;
  started_at: number | null;
  finished_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SessionQuestionRow {
  id: number;
  session_id: number;
  question_id: number;
  order_num: number;
  question_type: QuestionType;
  question_text: string;
  options: string;
  correct_index: number;
  time_limit: number;
  is_double_points: number;
  explanation: string | null;
  category: string | null;
}

export interface ParticipantRow {
  id: number;
  session_id: number;
  class_id: string;
  nickname: string;
  total_score: number;
  correct_count: number;
  answer_count: number;
  total_elapsed_ms: number;
  socket_id: string | null;
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface AnswerRow {
  id: number;
  session_id: number;
  participant_id: number;
  class_id: string;
  question_id: number;
  selected_index: number;
  is_correct: number;
  awarded_score: number;
  elapsed_ms: number;
  submitted_at: number;
}

export interface LogRow {
  id: number;
  class_id: string | null;
  participant_id: number | null;
  session_id: number | null;
  event_type: string;
  severity: string;
  details: string | null;
  created_at: number;
}
