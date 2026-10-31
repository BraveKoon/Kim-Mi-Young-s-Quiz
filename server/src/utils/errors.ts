export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = 'BAD_REQUEST', details?: unknown) => new AppError(400, code, msg, details);
export const unauthorized = (msg = '인증이 필요합니다.', code = 'UNAUTHORIZED') => new AppError(401, code, msg);
export const forbidden = (msg = '권한이 없습니다.', code = 'FORBIDDEN') => new AppError(403, code, msg);
export const notFound = (msg = '찾을 수 없습니다.', code = 'NOT_FOUND') => new AppError(404, code, msg);
export const conflict = (msg: string, code = 'CONFLICT') => new AppError(409, code, msg);
