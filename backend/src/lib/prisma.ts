import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * A single PrismaClient instance is shared across the process. In development
 * `tsx watch` reloads the module graph on every save, so the client is cached on
 * globalThis to avoid exhausting database connections with orphaned clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction || env.isTest ? ['error'] : ['error', 'warn'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
