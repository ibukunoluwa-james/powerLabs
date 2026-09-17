import type {
  CreateTaskInput,
  ListTasksParams,
  Pagination,
  Task,
  UpdateTaskInput,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/**
 * Carries the structured error the API returns, so pages can show a message and
 * forms can highlight the offending fields.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Turns `[{ field: 'body.title', message }]` into `{ title: message }`. */
function toFieldErrors(details?: Array<{ field: string; message: string }>) {
  const fieldErrors: Record<string, string> = {};
  for (const detail of details ?? []) {
    const key = detail.field.replace(/^(body|query|params)\./, '');
    // Keep the first message per field - that is the one worth showing.
    if (!(key in fieldErrors)) fieldErrors[key] = detail.message;
  }
  return fieldErrors;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      // Task data is user-specific and changes constantly; never serve it stale.
      cache: 'no-store',
    });
  } catch {
    // fetch only rejects on a network-level failure - the API being down, DNS,
    // CORS. Everything else is an HTTP status handled below.
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      `Could not reach the API at ${API_BASE_URL}. Is the backend running?`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      toFieldErrors(error?.details),
    );
  }

  if (payload === null) {
    throw new ApiClientError(response.status, 'INVALID_RESPONSE', 'The API returned an unreadable response');
  }

  return payload;
}

export async function listTasks(
  params: ListTasksParams = {},
): Promise<{ data: Task[]; pagination: Pagination }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Empty strings mean "no filter" and must not be sent - the API validates
    // `status` against an enum that has no empty member.
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query}` : '';
  return request<{ data: Task[]; pagination: Pagination }>(`/api/tasks${suffix}`);
}

export async function getTask(id: string): Promise<Task> {
  const { data } = await request<{ data: Task }>(`/api/tasks/${id}`);
  return data;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data } = await request<{ data: Task }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const { data } = await request<{ data: Task }>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await request<void>(`/api/tasks/${id}`, { method: 'DELETE' });
}
