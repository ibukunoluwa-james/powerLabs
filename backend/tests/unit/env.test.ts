import { describe, expect, it } from 'vitest';
import { buildEnv } from '../../src/config/env';

/**
 * A bad environment should stop the process at boot with a message that says
 * which variable is wrong - not surface as a confusing failure on the first
 * request.
 */

const validEnv = {
  NODE_ENV: 'development',
  PORT: '4000',
  DATABASE_URL: 'file:./dev.db',
  CORS_ORIGIN: 'http://localhost:3000',
};

describe('buildEnv', () => {
  it('parses a valid environment and coerces PORT to a number', () => {
    const env = buildEnv(validEnv);

    expect(env.PORT).toBe(4000);
    expect(typeof env.PORT).toBe('number');
    expect(env.NODE_ENV).toBe('development');
  });

  it('applies defaults for the optional variables', () => {
    const env = buildEnv({ DATABASE_URL: 'file:./dev.db' });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('splits and trims a comma-separated CORS_ORIGIN list', () => {
    const env = buildEnv({
      ...validEnv,
      CORS_ORIGIN: 'http://localhost:3000, https://tasks.example.com ,',
    });

    expect(env.corsOrigins).toEqual(['http://localhost:3000', 'https://tasks.example.com']);
  });

  it('derives the isProduction and isTest flags', () => {
    expect(buildEnv({ ...validEnv, NODE_ENV: 'production' }).isProduction).toBe(true);
    expect(buildEnv({ ...validEnv, NODE_ENV: 'production' }).isTest).toBe(false);
    expect(buildEnv({ ...validEnv, NODE_ENV: 'test' }).isTest).toBe(true);
    expect(buildEnv(validEnv).isProduction).toBe(false);
  });

  it('throws naming the missing variable when DATABASE_URL is absent', () => {
    expect(() => buildEnv({ PORT: '4000' })).toThrowError(/DATABASE_URL/);
  });

  it('rejects an empty DATABASE_URL', () => {
    expect(() => buildEnv({ ...validEnv, DATABASE_URL: '' })).toThrowError(/DATABASE_URL is required/);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => buildEnv({ ...validEnv, PORT: 'not-a-port' })).toThrowError(/PORT/);
  });

  it('rejects a negative PORT', () => {
    expect(() => buildEnv({ ...validEnv, PORT: '-1' })).toThrowError(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => buildEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('reports every invalid variable at once rather than one per restart', () => {
    let message = '';
    try {
      buildEnv({ NODE_ENV: 'staging', PORT: 'abc' });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/NODE_ENV/);
    expect(message).toMatch(/PORT/);
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/Invalid environment configuration/);
  });
});
