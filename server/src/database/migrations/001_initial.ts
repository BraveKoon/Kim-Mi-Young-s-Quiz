export const up = `
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  password_changed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE revoked_tokens (
  jti TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_revoked_tokens_exp ON revoked_tokens(expires_at);

CREATE TABLE classes (
  id TEXT PRIMARY KEY,               -- '2-1' ~ '2-12'
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  class_num INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 35,
  current_session_id INTEGER REFERENCES class_sessions(id) ON DELETE SET NULL
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_type TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE',
  question_text TEXT NOT NULL,
  options TEXT NOT NULL,             -- JSON 배열
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  time_limit INTEGER NOT NULL DEFAULT 20,
  is_double_points INTEGER NOT NULL DEFAULT 0,
  order_num INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  category TEXT,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_questions_order ON questions(deleted_at, order_num);

CREATE TABLE quiz_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE quiz_set_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_set_id INTEGER NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_num INTEGER NOT NULL,
  UNIQUE (quiz_set_id, question_id)
);
CREATE INDEX idx_qsq_set ON quiz_set_questions(quiz_set_id, order_num);

CREATE TABLE competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'READY',
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);

CREATE TABLE class_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id TEXT NOT NULL REFERENCES classes(id),
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  quiz_set_id INTEGER REFERENCES quiz_sets(id) ON DELETE SET NULL,
  quiz_set_title TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING',
  current_question_id INTEGER,
  current_question_index INTEGER NOT NULL DEFAULT -1,
  question_count INTEGER NOT NULL DEFAULT 0,
  question_start_time INTEGER,
  question_end_time INTEGER,
  paused_remaining_ms INTEGER,
  paused_from_status TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_class ON class_sessions(class_id);
CREATE INDEX idx_sessions_competition ON class_sessions(competition_id);
CREATE INDEX idx_sessions_status ON class_sessions(status);

-- 퀴즈 시작 시점의 문제 스냅샷: 이후 문제를 수정/삭제해도 대회 이력과 통계가 유지된다.
CREATE TABLE session_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  order_num INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  time_limit INTEGER NOT NULL,
  is_double_points INTEGER NOT NULL,
  explanation TEXT,
  category TEXT,
  UNIQUE (session_id, order_num),
  UNIQUE (session_id, question_id)
);

CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id),
  nickname TEXT NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  answer_count INTEGER NOT NULL DEFAULT 0,
  total_elapsed_ms INTEGER NOT NULL DEFAULT 0,
  socket_id TEXT,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, nickname)
);
CREATE INDEX idx_participants_session_score ON participants(session_id, total_score DESC, total_elapsed_ms);
CREATE INDEX idx_participants_class ON participants(class_id);

CREATE TABLE participant_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX idx_ptokens_participant ON participant_tokens(participant_id);

CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  selected_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  awarded_score INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  submitted_at INTEGER NOT NULL,
  UNIQUE (participant_id, question_id)
);
CREATE INDEX idx_answers_session_question ON answers(session_id, question_id);

CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id TEXT,
  participant_id INTEGER,
  session_id INTEGER,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  details TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_logs_created ON activity_logs(created_at);
CREATE INDEX idx_logs_class ON activity_logs(class_id, created_at);
CREATE INDEX idx_logs_type ON activity_logs(event_type, created_at);
CREATE INDEX idx_logs_participant ON activity_logs(participant_id);

CREATE TABLE exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL,
  export_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
