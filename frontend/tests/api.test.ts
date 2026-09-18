import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientError,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../lib/api';
import type { Task } from '../lib/types';

/**
 * The API client is where HTTP responses become either data or a typed error the
 * UI can act on. `fetch` is stubbed so these stay fast, offline and deterministic
 * - the real endpoints are covered by the backend integration suite.
 */

const task: Task = {
  id: '3f1a8b4e-0000-4000-8000-000000000000',
  title: 'Write the README',
  description: 'Setup instructions.',
  status: 'TODO',
  dueDate: '2026-10-01T09:00:00.000Z',
  createdAt: '2026-09-16T12:00:00.000Z',
  updatedAt: '2026-09-16T12:00:00.000Z',
  isOverdue: false,
};

/** Builds a fetch stub that answers with the given status and JSON payload. */
function stubFetch(status: number, payload: unknown, ok = status < 400) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The URL the most recent call was made to. */
function calledUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  return (fetchMock.mock.calls[0] as unknown as [string])[0];
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('listTasks', () => {
  it('returns the data and pagination straight through', async () => {
    stubFetch(200, { data: [task], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });

    const result = await listTasks();

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('omits empty filters from the query string', async () => {
    // The API validates `status` against an enum with no empty member, so an
    // empty filter must not be sent at all.
    const fetchMock = stubFetch(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });

    await listTasks({ status: '', search: '', page: 2, limit: 10 });

    const url = calledUrl(fetchMock);
    expect(url).not.toContain('status=');
    expect(url).not.toContain('search=');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });

  it('sends no query string at all when there are no parameters', async () => {
    const fetchMock = stubFetch(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });

    await listTasks();

    expect(calledUrl(fetchMock)).toMatch(/\/api\/tasks$/);
  });

  it('encodes a search term safely', async () => {
    const fetchMock = stubFetch(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });

    await listTasks({ search: 'buy milk & eggs' });

    expect(calledUrl(fetchMock)).toContain('search=buy+milk+%26+eggs');
  });
});

describe('single-task calls', () => {
  it('unwraps the data envelope when fetching one task', async () => {
    stubFetch(200, { data: task });

    await expect(getTask(task.id)).resolves.toEqual(task);
  });

  it('POSTs the payload when creating', async () => {
    const fetchMock = stubFetch(201, { data: task });

    await createTask({ title: 'Write the README' });

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Write the README' });
  });

  it('PATCHes the payload when updating', async () => {
    const fetchMock = stubFetch(200, { data: { ...task, status: 'DONE' } });

    const updated = await updateTask(task.id, { status: 'DONE' });

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe('PATCH');
    expect(updated.status).toBe('DONE');
  });

  it('treats a 204 delete as success with no body to parse', async () => {
    // Calling .json() on a 204 would throw, so the client must short-circuit.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('should not be called for 204');
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteTask(task.id)).resolves.toBeUndefined();
  });
});

describe('error mapping', () => {
  it('turns a validation response into field errors keyed by bare field name', async () => {
    stubFetch(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          { field: 'body.title', message: 'Title is required' },
          { field: 'body.dueDate', message: 'Must be a valid ISO 8601 date string' },
        ],
      },
    });

    const error = await createTask({ title: '' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    // The form labels inputs `title`/`dueDate`, not `body.title`.
    expect(error.fieldErrors).toEqual({
      title: 'Title is required',
      dueDate: 'Must be a valid ISO 8601 date string',
    });
  });

  it('keeps the first message when a field has several problems', async () => {
    stubFetch(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          { field: 'body.title', message: 'Title is required' },
          { field: 'body.title', message: 'Title must be 200 characters or fewer' },
        ],
      },
    });

    const error = await createTask({ title: '' }).catch((caught) => caught);

    expect(error.fieldErrors.title).toBe('Title is required');
  });

  it('surfaces a 404 with its status so pages can show a not-found state', async () => {
    stubFetch(404, { error: { code: 'NOT_FOUND', message: 'Task with id "x" was not found' } });

    const error = await getTask('x').catch((caught) => caught);

    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.fieldErrors).toEqual({});
  });

  it('falls back to a readable message when the error body has no shape', async () => {
    stubFetch(500, {}, false);

    const error = await getTask('x').catch((caught) => caught);

    expect(error.status).toBe(500);
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.message).toContain('500');
  });

  it('reports an unreachable API as a network error rather than a crash', async () => {
    // What the browser actually does when the backend is not running.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));

    const error = await listTasks().catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.status).toBe(0);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toMatch(/Is the backend running\?/);
  });

  it('reports an unreadable success body instead of returning undefined', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await getTask('x').catch((caught) => caught);

    expect(error.code).toBe('INVALID_RESPONSE');
  });
});
