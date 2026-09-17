import { z } from 'zod';

/**
 * SQLite has no native enum type, so the allowed statuses live here and are
 * enforced at the API boundary. This is the single source of truth - the
 * frontend imports the same list through the API's `/api/tasks/meta` response.
 */
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accepts any string `Date` can parse (ISO 8601 in practice, e.g.
 * "2026-10-01" or "2026-10-01T09:00:00.000Z") and hands a real `Date` to the
 * service layer. `new Date('nonsense')` yields an Invalid Date rather than
 * throwing, which is why the timestamp is checked explicitly.
 */
const isoDate = z
  .string()
  .trim()
  .min(1, 'Date must not be empty')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Must be a valid ISO 8601 date string, e.g. 2026-10-01T09:00:00.000Z',
  })
  .transform((value) => new Date(value));

const title = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer');

const description = z
  .string()
  .trim()
  .max(2000, 'Description must be 2000 characters or fewer')
  .nullable();

const status = z.enum(TASK_STATUSES);

export const createTaskSchema = z
  .object({
    title,
    // Omitted and explicit `null` both mean "no description".
    description: description.optional(),
    status: status.optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    status: status.optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .strict()
  // A PATCH with an empty body is almost always a client bug; failing loudly
  // beats silently returning an unchanged task.
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const taskIdParamsSchema = z.object({
  id: z.string().regex(UUID_RE, 'Task id must be a valid UUID'),
});

export const listTasksQuerySchema = z
  .object({
    status: status.optional(),
    /** Case-insensitive substring match against title and description. */
    search: z.string().trim().min(1).max(200).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'title', 'status']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strip();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type TaskIdParams = z.infer<typeof taskIdParamsSchema>;
