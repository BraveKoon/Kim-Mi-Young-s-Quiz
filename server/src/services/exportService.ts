import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import type { Writable } from 'node:stream';
import { classDisplayName } from '@shared/types/index.js';
import type { AnalyticsService } from '../analytics/analyticsService.js';
import type { Repositories } from '../database/repositories/index.js';
import { notFound } from '../utils/errors.js';
import type { LeaderboardService } from './leaderboardService.js';

export const EXPORT_DATASETS = ['individual', 'class', 'questions', 'logs'] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

interface Table {
  sheet: string;
  columns: { header: string; key: string; width?: number }[];
  rows: () => Iterable<Record<string, unknown>>;
}

const pct = (v: number) => Math.round(v * 1000) / 10;
const dt = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');

/** CSV 셀 이스케이프 + 수식 주입(CSV injection) 방지 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class ExportService {
  constructor(private repos: Repositories, private leaderboard: LeaderboardService, private analytics: AnalyticsService) {}

  private tables(competitionId: number): Record<ExportDataset, Table> {
    const comp = this.repos.competitions.find(competitionId);
    if (!comp) throw notFound('대회를 찾을 수 없습니다.');
    const sessions = this.repos.sessions.byCompetition(competitionId);
    const qCount = new Map(sessions.map((s) => [s.id, s.question_count]));
    return {
      individual: {
        sheet: '개인 순위',
        columns: [
          { header: '전체 순위', key: 'rank', width: 10 },
          { header: '학급', key: 'className', width: 14 },
          { header: '닉네임', key: 'nickname', width: 18 },
          { header: '총점', key: 'score', width: 10 },
          { header: '정답 수', key: 'correct', width: 10 },
          { header: '응답 수', key: 'answered', width: 10 },
          { header: '문항 수', key: 'questions', width: 10 },
          { header: '정답률(%)', key: 'accuracy', width: 12 },
          { header: '학급 내 순위', key: 'classRank', width: 12 },
        ],
        rows: () => {
          const ranking = this.leaderboard.competitionRanking(competitionId);
          const parts = new Map(
            (this.repos.db
              .prepare('SELECT p.id, p.session_id, p.answer_count FROM participants p JOIN class_sessions s ON s.id=p.session_id WHERE s.competition_id=?')
              .all(competitionId) as { id: number; session_id: number; answer_count: number }[]).map((p) => [p.id, p]),
          );
          const classRanks = new Map<number, number>();
          for (const s of sessions) for (const r of this.leaderboard.sessionRanking(s.id, null)) classRanks.set(r.participantId, r.rank);
          return ranking.map((r) => {
            const p = parts.get(r.participantId);
            const q = p ? (qCount.get(p.session_id) ?? 0) : 0;
            return {
              rank: r.rank, className: classDisplayName(r.classId), nickname: r.nickname, score: r.totalScore, correct: r.correctCount,
              answered: p?.answer_count ?? 0, questions: q, accuracy: q ? pct(r.correctCount / q) : 0, classRank: classRanks.get(r.participantId) ?? '',
            };
          });
        },
      },
      class: {
        sheet: '학급 순위',
        columns: [
          { header: '학급 순위', key: 'rank', width: 10 },
          { header: '학급', key: 'className', width: 14 },
          { header: '참가 인원', key: 'participants', width: 10 },
          { header: '평균 점수', key: 'avg', width: 12 },
          { header: '최고 점수', key: 'max', width: 12 },
          { header: '총점', key: 'sum', width: 12 },
          { header: '정답률(%)', key: 'accuracy', width: 12 },
          { header: '문제 세트', key: 'quizSet', width: 28 },
          { header: '상태', key: 'status', width: 10 },
        ],
        rows: () => {
          const cr = this.leaderboard.classRanking(competitionId);
          const rows: Record<string, unknown>[] = cr.classes.map((c) => ({
            rank: c.rank, className: classDisplayName(c.classId), participants: c.participantCount, avg: c.averageScore, max: c.maxScore,
            sum: c.totalScore, accuracy: pct(c.accuracy), quizSet: c.quizSetTitle ?? '', status: c.status,
          }));
          if (cr.fairnessWarning) rows.push({ rank: '', className: '※ 주의', quizSet: cr.fairnessWarning });
          return rows;
        },
      },
      questions: {
        sheet: '문항별 통계',
        columns: [
          { header: '번호', key: 'order', width: 6 },
          { header: '문제', key: 'text', width: 40 },
          { header: '정답', key: 'answer', width: 16 },
          { header: '2배', key: 'double', width: 6 },
          { header: '참가자', key: 'participants', width: 8 },
          { header: '응답자', key: 'answered', width: 8 },
          { header: '미응답', key: 'noAnswer', width: 8 },
          { header: '정답자', key: 'correct', width: 8 },
          { header: '정답률-응답자(%)', key: 'rateAnswered', width: 16 },
          { header: '정답률-전체(%)', key: 'rateAll', width: 14 },
          { header: '평균 응답시간(초)', key: 'avgSec', width: 16 },
          { header: '평균 점수', key: 'avgScore', width: 10 },
          { header: '보기1', key: 'o1', width: 8 },
          { header: '보기2', key: 'o2', width: 8 },
          { header: '보기3', key: 'o3', width: 8 },
          { header: '보기4', key: 'o4', width: 8 },
        ],
        rows: () =>
          this.analytics.questionStats(sessions.map((s) => s.id)).map((q) => ({
            order: q.order, text: q.text, answer: `${q.correctIndex + 1}. ${q.options[q.correctIndex]}`, double: q.isDoublePoints ? 'O' : '',
            participants: q.participantCount, answered: q.answeredCount, noAnswer: q.noAnswerCount, correct: q.correctCount,
            rateAnswered: pct(q.correctRateAnswered), rateAll: pct(q.correctRateAll),
            avgSec: q.averageElapsedMs !== null ? Math.round(q.averageElapsedMs / 100) / 10 : '', avgScore: q.averageScore,
            o1: q.distribution[0] ?? '', o2: q.distribution[1] ?? '', o3: q.distribution[2] ?? '', o4: q.distribution[3] ?? '',
          })),
      },
      logs: {
        sheet: '접속 기록',
        columns: [
          { header: '시각', key: 'time', width: 22 },
          { header: '학급', key: 'className', width: 12 },
          { header: '참가자', key: 'nickname', width: 16 },
          { header: '이벤트', key: 'event', width: 24 },
          { header: '수준', key: 'severity', width: 10 },
          { header: '상세', key: 'details', width: 50 },
        ],
        rows: () =>
          this.repos.logs.bySessions(sessions.map((s) => s.id)).map((l) => ({
            time: dt(l.created_at), className: l.class_id ? classDisplayName(l.class_id) : '', nickname: l.nickname ?? '',
            event: l.event_type, severity: l.severity, details: l.details ?? '',
          })),
      },
    };
  }

  competitionTitle(competitionId: number) {
    const c = this.repos.competitions.find(competitionId);
    if (!c) throw notFound('대회를 찾을 수 없습니다.');
    return c.title;
  }

  /** UTF-8 BOM 포함 CSV를 행 단위로 스트리밍한다(엑셀에서 한글이 깨지지 않음). */
  async writeCsv(competitionId: number, dataset: ExportDataset, out: Writable) {
    const t = this.tables(competitionId)[dataset];
    const write = (s: string) => (out.write(s) ? Promise.resolve() : new Promise<void>((r) => out.once('drain', () => r())));
    await write('﻿' + t.columns.map((c) => csvCell(c.header)).join(',') + '\r\n');
    let buf = '';
    for (const row of t.rows()) {
      buf += t.columns.map((c) => csvCell(row[c.key])).join(',') + '\r\n';
      if (buf.length > 64 * 1024) {
        await write(buf);
        buf = '';
      }
    }
    if (buf) await write(buf);
  }

  /** ExcelJS 스트리밍 Writer로 XLSX 생성 (모든 시트 포함) */
  async writeXlsx(competitionId: number, out: Writable) {
    const tables = this.tables(competitionId);
    const comp = this.repos.competitions.find(competitionId)!;
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true, useSharedStrings: false });
    wb.creator = 'ClassQuiz';
    wb.created = new Date();
    const info = wb.addWorksheet('대회 정보');
    info.columns = [{ header: '항목', key: 'k', width: 16 }, { header: '값', key: 'v', width: 50 }];
    info.getRow(1).font = { bold: true };
    for (const [k, v] of [
      ['대회명', comp.title],
      ['설명', comp.description ?? ''],
      ['상태', comp.status],
      ['생성일', dt(comp.created_at)],
      ['시작일', dt(comp.started_at)],
      ['종료일', dt(comp.finished_at)],
      ['참가 학급', this.repos.sessions.byCompetition(competitionId).map((s) => classDisplayName(s.class_id)).join(', ')],
    ]) info.addRow({ k, v }).commit();
    info.commit();
    for (const t of Object.values(tables)) {
      const ws = wb.addWorksheet(t.sheet);
      ws.columns = t.columns;
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).commit();
      for (const row of t.rows()) ws.addRow(row).commit();
      ws.commit();
    }
    await wb.commit();
  }

  /** 서버에 파일로 저장(POST /api/exports/:id) */
  async saveToFile(competitionId: number, format: 'csv' | 'xlsx', dataset: ExportDataset, dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `classquiz-${competitionId}-${format === 'csv' ? dataset + '-' : ''}${Date.now()}.${format}`;
    const filePath = path.join(dir, fileName);
    const stream = fs.createWriteStream(filePath);
    const done = new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
    if (format === 'csv') {
      await this.writeCsv(competitionId, dataset, stream);
      stream.end();
    } else {
      await this.writeXlsx(competitionId, stream);
    }
    await done;
    return { fileName, filePath };
  }

  /** 활동 로그 CSV (필터 적용) */
  async writeLogsCsv(filter: Parameters<Repositories['logs']['iterate']>[0], out: Writable) {
    out.write('﻿시각,학급,참가자,이벤트,수준,상세\r\n');
    for (const l of this.repos.logs.iterate(filter)) {
      const line = [dt(l.created_at), l.class_id ? classDisplayName(l.class_id) : '', l.nickname ?? '', l.event_type, l.severity, l.details ?? '']
        .map(csvCell)
        .join(',');
      if (!out.write(line + '\r\n')) await new Promise<void>((r) => out.once('drain', () => r()));
    }
  }
}
