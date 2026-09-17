import { env } from './config/env';
import { prisma } from './lib/prisma';
import { createApp } from './app';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`[api] allowed origins: ${env.corsOrigins.join(', ')}`);
});

/** Closes the HTTP server and the database pool before exiting. */
async function shutdown(signal: string) {
  console.log(`\n[api] ${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
