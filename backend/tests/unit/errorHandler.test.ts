import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { ApiError } from '../../src/utils/ApiError';

/**
 * The error middleware is the one place that decides what the client sees when
 * something goes wrong. Several of its branches (409, 503, the generic 500) are
 * hard to provoke through the HTTP API, so they are exercised directly here.
 */

interface CapturedResponse {
  res: Response;
  statusCode: () => number;
  body: () => { error: { code: string; message: string; details?: unknown } };
}

/** A minimal Response double that records what the handler wrote. */
function mockResponse(): CapturedResponse {
  let capturedStatus = 0;
  let capturedBody: unknown;

  const res = {
    status(code: number) {
      capturedStatus = code;
      return this;
    },
    json(payload: unknown) {
      capturedBody = payload;
      return this;
    },
  } as unknown as Response;

  return {
    res,
    statusCode: () => capturedStatus,
    body: () => capturedBody as ReturnType<CapturedResponse['body']>,
  };
}

function handle(error: unknown) {
  const captured = mockResponse();
  errorHandler(error, {} as Request, captured.res, (() => {}) as NextFunction);
  return { status: captured.statusCode(), body: captured.body() };
}

describe('errorHandler', () => {
  it('passes an ApiError through with its status, code and details', () => {
    const { status, body } = handle(
      ApiError.validation('Request validation failed', [{ field: 'body.title', message: 'Title is required' }]),
    );

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Request validation failed');
    expect(body.error.details).toEqual([{ field: 'body.title', message: 'Title is required' }]);
  });

  it('omits details when the ApiError carries none', () => {
    const { status, body } = handle(ApiError.notFound('Task with id "abc" was not found'));

    expect(status).toBe(404);
    expect(body.error).not.toHaveProperty('details');
  });

  it('maps a bare ZodError to 422 with flattened field errors', () => {
    // A schema used outside validate() - e.g. directly inside a service.
    const result = z.object({ title: z.string() }).safeParse({ title: 42 });
    expect(result.success).toBe(false);

    const { status, body } = handle(result.success ? new Error('unreachable') : result.error);

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toContainEqual(expect.objectContaining({ field: 'title' }));
  });

  it('maps body-parser\'s SyntaxError to 400 INVALID_JSON', () => {
    // express.json() attaches the raw body to the SyntaxError it throws.
    const syntaxError = Object.assign(new SyntaxError('Unexpected end of JSON input'), {
      body: '{"title": "broken"',
    });

    const { status, body } = handle(syntaxError);

    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_JSON');
  });

  it('maps an oversized body to 413 PAYLOAD_TOO_LARGE rather than a 500', () => {
    // What body-parser throws once the payload passes the configured limit.
    const tooLarge = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
      statusCode: 413,
      limit: 102400,
      length: 150000,
    });

    const { status, body } = handle(tooLarge);

    expect(status).toBe(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.error.message).toMatch(/100kb/);
  });

  it('maps an unrecognised body-parser failure to its own status, not a 500', () => {
    const unsupported = Object.assign(new Error('unsupported charset "UTF-9"'), {
      type: 'charset.unsupported',
      status: 415,
      statusCode: 415,
    });

    const { status, body } = handle(unsupported);

    expect(status).toBe(415);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('does not treat an ordinary SyntaxError as a bad request body', () => {
    const { status, body } = handle(new SyntaxError('unexpected token in some other code'));

    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('maps Prisma P2025 (record not found) to 404', () => {
    const { status, body } = handle(
      new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('maps Prisma P2002 (unique constraint) to 409', () => {
    const { status, body } = handle(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['title'] },
      }),
    );

    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('falls back to 500 for an unrecognised Prisma error code', () => {
    const { status, body } = handle(
      new Prisma.PrismaClientKnownRequestError('Something else went wrong.', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('maps a Prisma initialization failure to 503', () => {
    const { status, body } = handle(
      new Prisma.PrismaClientInitializationError('Can\'t reach database server', 'test'),
    );

    expect(status).toBe(503);
    expect(body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(body.error.message).toMatch(/database is unavailable/i);
  });

  it('reports an unexpected error as a generic 500 without leaking internals', () => {
    const leaky = new Error('Connection string: postgres://admin:hunter2@db.internal:5432');

    const { status, body } = handle(leaky);

    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    // The important part: nothing from the original error reaches the client.
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(body.error).not.toHaveProperty('stack');
  });

  it('handles a thrown non-Error value', () => {
    const { status, body } = handle('just a string');

    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('stays quiet in the test environment instead of logging 500s', () => {
    // NODE_ENV is 'test' here, so the stack logging is suppressed - without this
    // guard every expected-failure test would print a stack trace.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    handle(new Error('boom'));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
