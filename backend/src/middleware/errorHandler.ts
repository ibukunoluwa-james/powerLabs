import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { formatZodIssues } from './validate';

interface ErrorBody {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Maps any thrown value onto a predictable HTTP response shape. */
function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof ApiError) {
    return {
      status: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // A schema used outside of validate() (e.g. directly in a service).
  if (error instanceof ZodError) {
    return {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: formatZodIssues(error),
    };
  }

  // express.json() rejects a malformed payload with a SyntaxError carrying the raw body.
  if (error instanceof SyntaxError && 'body' in error) {
    return {
      status: 400,
      code: 'INVALID_JSON',
      message: 'Request body is not valid JSON',
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // "An operation failed because it depends on one or more records that were required but not found."
      case 'P2025':
        return { status: 404, code: 'NOT_FOUND', message: 'Task not found' };
      case 'P2002':
        return { status: 409, code: 'CONFLICT', message: 'A record with these values already exists' };
      default:
        break;
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database is unavailable. Check DATABASE_URL and that migrations have been run.',
    };
  }

  return { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' };
}

// Express identifies error middleware by its four-parameter signature, so `next`
// must stay in the list even though it is unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const body = toErrorBody(error);

  // Unexpected failures are logged with their stack; handled ones are just noise.
  if (body.status >= 500 && !env.isTest) {
    console.error('[error]', error);
  }

  res.status(body.status).json({
    error: {
      code: body.code,
      message: body.message,
      ...(body.details !== undefined ? { details: body.details } : {}),
    },
  });
}
