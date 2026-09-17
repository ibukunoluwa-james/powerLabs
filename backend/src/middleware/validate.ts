import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Flattens a ZodError into a client-friendly `{ field, message }[]`. */
export function formatZodIssues(error: ZodError, source?: Source) {
  return error.issues.map((issue) => ({
    field: [source, ...issue.path.map(String)].filter(Boolean).join('.'),
    message: issue.message,
  }));
}

/**
 * Validates and *replaces* the incoming request parts with the parsed output, so
 * downstream handlers work with coerced, fully typed values (dates as `Date`,
 * numbers as `number`) rather than raw strings.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: Array<{ field: string; message: string }> = [];

    for (const source of ['params', 'query', 'body'] as const) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (!result.success) {
        issues.push(...formatZodIssues(result.error, source));
        continue;
      }

      // Express 5 exposes `req.query` via a getter, so it cannot be assigned to
      // directly; the parsed value is stashed and read through `validated()`.
      validatedStore.set(req, { ...(validatedStore.get(req) ?? {}), [source]: result.data });
    }

    if (issues.length > 0) {
      return next(ApiError.validation('Request validation failed', issues));
    }

    return next();
  };
}

const validatedStore = new WeakMap<Request, Partial<Record<Source, unknown>>>();

/** Reads the parsed value produced by `validate()` for a given request part. */
export function validated<T>(req: Request, source: Source): T {
  const stored = validatedStore.get(req);
  if (!stored || !(source in stored)) {
    // A programming error: the route forgot to register a schema for this part.
    throw new Error(`No validated "${source}" found on request. Did you add a validate() schema?`);
  }
  return stored[source] as T;
}
