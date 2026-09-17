import { Prisma, type Task } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import type { CreateTaskInput, ListTasksQuery, TaskStatus, UpdateTaskInput } from './task.schema';

/** The public representation of a task. Dates are serialised as ISO strings. */
export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** Convenience flag so the UI does not have to re-derive it per render. */
  isOverdue: boolean;
}

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    isOverdue: task.status !== 'DONE' && task.dueDate !== null && task.dueDate.getTime() < Date.now(),
  };
}

export interface ListTasksResult {
  tasks: TaskDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listTasks(query: ListTasksQuery): Promise<ListTasksResult> {
  const { status, search, sortBy, order, page, limit } = query;

  const where: Prisma.TaskWhereInput = {
    ...(status ? { status } : {}),
    // Prisma's `mode: 'insensitive'` is not supported on SQLite, but SQLite's
    // LIKE is already case-insensitive for ASCII, which covers this use case.
    ...(search
      ? { OR: [{ title: { contains: search } }, { description: { contains: search } }] }
      : {}),
  };

  // Count and page are fetched in one round trip.
  const [total, tasks] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      // `id` is a stable tiebreaker so pagination cannot repeat or skip rows
      // when several tasks share the same sort value.
      orderBy: [{ [sortBy]: order }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    tasks: tasks.map(toTaskDto),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getTaskById(id: string): Promise<TaskDto> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    throw ApiError.notFound(`Task with id "${id}" was not found`);
  }
  return toTaskDto(task);
}

export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'TODO',
      dueDate: input.dueDate ?? null,
    },
  });
  return toTaskDto(task);
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDto> {
  // Only the keys actually present in the request are written, so a PATCH never
  // clobbers a field the client did not mention. `null` is a meaningful value
  // here (it clears description / dueDate), so `undefined` is the absence test.
  const data: Prisma.TaskUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;

  try {
    const task = await prisma.task.update({ where: { id }, data });
    return toTaskDto(task);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw ApiError.notFound(`Task with id "${id}" was not found`);
    }
    throw error;
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await prisma.task.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw ApiError.notFound(`Task with id "${id}" was not found`);
    }
    throw error;
  }
}
