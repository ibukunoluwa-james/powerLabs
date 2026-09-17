/**
 * Mirrors the API contract. The status list is also served by
 * `GET /api/tasks/meta`, but keeping a local copy means the UI can render
 * filters before the first request resolves.
 */
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  dueDate?: string | null;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface ListTasksParams {
  status?: TaskStatus | '';
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'title' | 'status';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

/** Tailwind classes per status, kept next to the labels so they stay in sync. */
export const STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: 'bg-slate-100 text-slate-700 ring-slate-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 ring-amber-200',
  DONE: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
};
