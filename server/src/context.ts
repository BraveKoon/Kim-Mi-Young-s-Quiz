import { AnalyticsService } from './analytics/analyticsService.js';
import type { AppConfig } from './config/index.js';
import { openDatabase } from './database/connection.js';
import { runMigrations } from './database/migrations/index.js';
import { createRepositories, type Repositories } from './database/repositories/index.js';
import { SessionManager } from './quiz/sessionManager.js';
import { ActivityLogger } from './services/activityLogger.js';
import { AuthService } from './services/authService.js';
import { ExportService } from './services/exportService.js';
import { LeaderboardService } from './services/leaderboardService.js';
import { ParticipantService } from './services/participantService.js';
import { Presence } from './socket/roomManager.js';
import { systemClock, type Clock } from './utils/clock.js';

export interface AppContext {
  config: AppConfig;
  clock: Clock;
  repos: Repositories;
  logger: ActivityLogger;
  presence: Presence;
  leaderboard: LeaderboardService;
  participants: ParticipantService;
  auth: AuthService;
  sessions: SessionManager;
  analytics: AnalyticsService;
  exports: ExportService;
}

export function createContext(config: AppConfig, clock: Clock = systemClock): AppContext {
  const db = openDatabase(config.databasePath);
  runMigrations(db);
  const repos = createRepositories(db);
  repos.participants.clearAllSockets(); // 재시작 직후에는 실제 연결이 없다
  const logger = new ActivityLogger(repos, clock, config.logToConsole);
  const presence = new Presence();
  const leaderboard = new LeaderboardService(repos);
  const analytics = new AnalyticsService(repos, leaderboard);
  return {
    config,
    clock,
    repos,
    logger,
    presence,
    leaderboard,
    participants: new ParticipantService(repos, config, clock, logger),
    auth: new AuthService(repos, config, clock, logger),
    sessions: new SessionManager(repos, config, clock, logger, leaderboard, presence),
    analytics,
    exports: new ExportService(repos, leaderboard, analytics),
  };
}
