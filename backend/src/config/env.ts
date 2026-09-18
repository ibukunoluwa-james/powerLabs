import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment variables are validated once at boot so the process fails fast
 * with a readable message instead of throwing deep inside a request handler.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = ReturnType<typeof buildEnv>;

/**
 * Parses a raw environment into the validated config object.
 *
 * Kept as a function taking its source explicitly - rather than reading
 * `process.env` inline - so the failure path can be tested without having to
 * reload the module or mutate the real environment.
 */
export function buildEnv(source: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return {
    ...parsed.data,
    /** CORS_ORIGIN accepts a comma-separated list of allowed origins. */
    corsOrigins: parsed.data.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    isProduction: parsed.data.NODE_ENV === 'production',
    isTest: parsed.data.NODE_ENV === 'test',
  };
}

export const env = buildEnv(process.env);
