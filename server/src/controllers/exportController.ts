import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../context.js';
import { EXPORT_DATASETS, type ExportDataset } from '../services/exportService.js';
import { badRequest, notFound } from '../utils/errors.js';

const contentDisposition = (name: string) =>
  `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

export function exportController(ctx: AppContext) {
  const exportDir = path.join(path.dirname(ctx.config.databasePath), 'exports');
  const dataset = (req: Request): ExportDataset => {
    const d = String(req.query.type ?? 'individual');
    if (!(EXPORT_DATASETS as readonly string[]).includes(d)) throw badRequest(`type은 ${EXPORT_DATASETS.join(', ')} 중 하나여야 합니다.`);
    return d as ExportDataset;
  };
  const record = (req: Request, competitionId: number, type: string, fileName: string, filePath: string | null) => {
    ctx.repos.exports.insert(competitionId, type, fileName, filePath, ctx.clock());
    ctx.logger.log('DATA_EXPORTED', { details: { competitionId, type, fileName, by: req.admin!.username } });
  };
  return {
    async csv(req: Request, res: Response) {
      const id = req.valid!.params.id;
      const d = dataset(req);
      const title = ctx.exports.competitionTitle(id);
      const fileName = `${safeName(title)}_${d}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', contentDisposition(fileName));
      await ctx.exports.writeCsv(id, d, res);
      res.end();
      record(req, id, `csv:${d}`, fileName, null);
    },
    async excel(req: Request, res: Response) {
      const id = req.valid!.params.id;
      const title = ctx.exports.competitionTitle(id);
      const fileName = `${safeName(title)}_결과.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', contentDisposition(fileName));
      await ctx.exports.writeXlsx(id, res);
      record(req, id, 'xlsx', fileName, null);
    },
    async create(req: Request, res: Response) {
      const id = req.valid!.params.id;
      const format = req.body?.format === 'csv' ? 'csv' : 'xlsx';
      const d = (EXPORT_DATASETS as readonly string[]).includes(req.body?.type) ? (req.body.type as ExportDataset) : 'individual';
      ctx.exports.competitionTitle(id);
      const { fileName, filePath } = await ctx.exports.saveToFile(id, format, d, exportDir);
      const exportId = ctx.repos.exports.insert(id, format === 'csv' ? `csv:${d}` : 'xlsx', fileName, filePath, ctx.clock());
      ctx.logger.log('DATA_EXPORTED', { details: { competitionId: id, format, fileName, by: req.admin!.username, saved: true } });
      res.status(201).json({ export: { id: exportId, fileName, downloadUrl: `/api/exports/files/${exportId}` } });
    },
    /** 내보내기 기록 전체 초기화: 기록과 서버에 저장된 내보내기 파일(exports 폴더 안)을 함께 삭제한다. */
    reset(req: Request, res: Response) {
      const { count, filePaths } = ctx.repos.exports.deleteAll();
      const root = path.resolve(exportDir) + path.sep;
      let filesDeleted = 0;
      for (const f of filePaths) {
        const resolved = path.resolve(f);
        if (!resolved.startsWith(root)) continue; // 내보내기 폴더 밖의 파일은 건드리지 않는다
        try {
          fs.rmSync(resolved, { force: true });
          filesDeleted++;
        } catch {
          /* 이미 없거나 삭제 불가한 파일은 건너뜀 */
        }
      }
      ctx.logger.log('EXPORTS_RESET', { severity: 'warning', details: { by: req.admin!.username, deleted: count, filesDeleted } });
      res.json({ ok: true, deleted: count, filesDeleted });
    },
    list(req: Request, res: Response) {
      const cid = req.query.competitionId ? Number(req.query.competitionId) : undefined;
      res.json({
        exports: ctx.repos.exports.list(cid).map((e) => ({
          id: e.id,
          competitionId: e.competition_id,
          exportType: e.export_type,
          fileName: e.file_name,
          stored: !!e.file_path && fs.existsSync(e.file_path),
          createdAt: e.created_at,
        })),
      });
    },
    download(req: Request, res: Response) {
      const e = ctx.repos.exports.find(req.valid!.params.id);
      if (!e?.file_path) throw notFound('저장된 파일이 없습니다.');
      const resolved = path.resolve(e.file_path);
      if (!resolved.startsWith(path.resolve(exportDir) + path.sep) || !fs.existsSync(resolved)) throw notFound('파일을 찾을 수 없습니다.');
      res.setHeader('Content-Disposition', contentDisposition(e.file_name));
      res.sendFile(resolved);
    },
    async logsCsv(req: Request, res: Response) {
      const q = req.valid!.query;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', contentDisposition(`activity_logs_${Date.now()}.csv`));
      await ctx.exports.writeLogsCsv({ ...q, limit: undefined, offset: undefined }, res);
      res.end();
      ctx.logger.log('DATA_EXPORTED', { details: { type: 'logs', by: req.admin!.username } });
    },
  };
}
