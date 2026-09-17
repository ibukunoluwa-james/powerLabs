import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests run against a throwaway SQLite file so they never touch dev data.
    // dotenv does not override variables that are already set, so these win
    // over anything in .env.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      CORS_ORIGIN: 'http://localhost:3000',
      PORT: '4001',
    },
    globalSetup: ['./tests/global-setup.ts'],
    // The suites share one SQLite file, so they must not run concurrently.
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
