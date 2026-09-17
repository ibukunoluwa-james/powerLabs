import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Adds a handful of tasks so the UI has something to show on a fresh clone. */
async function main() {
  const existing = await prisma.task.count();
  if (existing > 0) {
    console.log(`[seed] skipped - database already has ${existing} task(s)`);
    return;
  }

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  await prisma.task.createMany({
    data: [
      {
        title: 'Write the README',
        description: 'Setup instructions, API reference and the decisions log.',
        status: 'IN_PROGRESS',
        dueDate: new Date(now + 2 * day),
      },
      {
        title: 'Add integration tests for the task API',
        description: 'Cover the happy paths plus validation and 404 handling.',
        status: 'TODO',
        dueDate: new Date(now + 5 * day),
      },
      {
        title: 'Set up the database schema',
        description: 'Prisma model, migration and indexes.',
        status: 'DONE',
        dueDate: new Date(now - 3 * day),
      },
      {
        title: 'Renew the domain name',
        description: 'This one is deliberately overdue to show the UI state.',
        status: 'TODO',
        dueDate: new Date(now - day),
      },
      {
        title: 'Plan the next sprint',
        description: null,
        status: 'TODO',
        dueDate: null,
      },
    ],
  });

  console.log('[seed] inserted 5 sample tasks');
}

main()
  .catch((error) => {
    console.error('[seed] failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
