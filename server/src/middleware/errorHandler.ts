import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

/** 오류 응답: 내부 오류 메시지·스택은 클라이언트에 노출하지 않는다. */
export function errorHandler(isProduction: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    }
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'INVALID_JSON', message: 'JSON 형식이 올바르지 않습니다.' });
    if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: '요청이 너무 큽니다.' });
    console.error(`[error] ${req.method} ${req.path}`, isProduction ? (err as Error)?.message : err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' });
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'NOT_FOUND', message: '요청한 API를 찾을 수 없습니다.' });
}
