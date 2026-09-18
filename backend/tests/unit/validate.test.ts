import type { Request } from 'express';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { formatZodIssues, validated } from '../../src/middleware/validate';

describe('formatZodIssues', () => {
  it('prefixes each field with the request part it came from', () => {
    const result = z.object({ title: z.string() }).safeParse({});
    expect(result.success).toBe(false);

    const issues = formatZodIssues(result.success ? new z.ZodError([]) : result.error, 'body');

    expect(issues).toContainEqual(expect.objectContaining({ field: 'body.title' }));
  });

  it('handles nested paths', () => {
    const result = z.object({ page: z.object({ size: z.number() }) }).safeParse({ page: { size: 'big' } });

    const issues = formatZodIssues(result.success ? new z.ZodError([]) : result.error, 'query');

    expect(issues[0]?.field).toBe('query.page.size');
  });

  it('omits the prefix when no source is given', () => {
    const result = z.object({ title: z.string() }).safeParse({});

    const issues = formatZodIssues(result.success ? new z.ZodError([]) : result.error);

    expect(issues[0]?.field).toBe('title');
  });
});

describe('validated', () => {
  it('throws a developer-facing error when a route forgot its schema', () => {
    // This is a programming mistake rather than a client error, so it must not
    // be swallowed into a 4xx - it should be loud.
    expect(() => validated({} as Request, 'body')).toThrowError(/Did you add a validate\(\) schema/);
  });
});
