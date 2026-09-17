import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Makes sure the test database matches schema.prisma before the suite runs.
 *
 * `db push` (not `migrate deploy`) because the test database only needs the
 * current shape - migration history is irrelevant here - and it is idempotent,
 * so no destructive reset is needed: each test clears the tables it uses.
 *
 * `execSync` runs through a shell so the `npx` shim resolves on Windows as well
 * as on POSIX.
 */
export default function setup() {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
