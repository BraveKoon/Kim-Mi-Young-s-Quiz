import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';
import { badRequest } from '../utils/errors.js';

export function validate(schemas: { body?: ZodType; query?: ZodType; params?: ZodType }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const valid: Record<string, unknown> = {};
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const r = schema.safeParse(req[key] ?? {});
      if (!r.success) {
        throw badRequest('입력값이 올바르지 않습니다.', 'VALIDATION_ERROR', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
      }
      valid[key] = r.data;
    }
    req.valid = valid;
    next();
  };
}

export const idParam = z.object({ id: z.coerce.number().int().positive() });
