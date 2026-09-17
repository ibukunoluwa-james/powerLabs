import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const api = () => request(app);

/** A task payload with every field populated; overridable per test. */
function taskPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Write the assessment README',
    description: 'Include setup steps and the decisions log.',
    status: 'TODO',
    dueDate: '2030-01-15T09:00:00.000Z',
    ...overrides,
  };
}

async function createTask(overrides: Record<string, unknown> = {}) {
  const response = await api().post('/api/tasks').send(taskPayload(overrides));
  expect(response.status).toBe(201);
  return response.body.data;
}

beforeEach(async () => {
  await prisma.task.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /health', () => {
  it('reports that the service is up', async () => {
    const response = await api().get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('POST /api/tasks', () => {
  it('creates a task and returns it with generated fields', async () => {
    const response = await api().post('/api/tasks').send(taskPayload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toMatch(/^\/api\/tasks\//);
    expect(response.body.data).toMatchObject({
      title: 'Write the assessment README',
      description: 'Include setup steps and the decisions log.',
      status: 'TODO',
      dueDate: '2030-01-15T09:00:00.000Z',
      isOverdue: false,
    });
    expect(response.body.data.id).toEqual(expect.any(String));
    expect(Date.parse(response.body.data.createdAt)).not.toBeNaN();
  });

  it('applies defaults when only a title is supplied', async () => {
    const response = await api().post('/api/tasks').send({ title: 'Minimal task' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      title: 'Minimal task',
      description: null,
      status: 'TODO',
      dueDate: null,
    });
  });

  it('trims whitespace from the title', async () => {
    const response = await api().post('/api/tasks').send({ title: '   Padded title   ' });
    expect(response.body.data.title).toBe('Padded title');
  });

  it('rejects a missing title', async () => {
    const response = await api().post('/api/tasks').send({ description: 'no title here' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'body.title' }),
    );
  });

  it('rejects a blank title', async () => {
    const response = await api().post('/api/tasks').send({ title: '    ' });
    expect(response.status).toBe(422);
  });

  it('rejects an unknown status', async () => {
    const response = await api().post('/api/tasks').send(taskPayload({ status: 'ALMOST_DONE' }));

    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'body.status' }),
    );
  });

  it('rejects an unparseable due date', async () => {
    const response = await api().post('/api/tasks').send(taskPayload({ dueDate: 'next tuesday' }));

    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'body.dueDate' }),
    );
  });

  it('rejects unknown fields rather than silently dropping them', async () => {
    const response = await api().post('/api/tasks').send(taskPayload({ priority: 'HIGH' }));
    expect(response.status).toBe(422);
  });

  it('rejects a malformed JSON body with 400', async () => {
    const response = await api()
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": "broken"');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('flags a past due date as overdue', async () => {
    const task = await createTask({ dueDate: '2020-01-01T00:00:00.000Z' });
    expect(task.isOverdue).toBe(true);
  });

  it('does not flag a completed task as overdue', async () => {
    const task = await createTask({ dueDate: '2020-01-01T00:00:00.000Z', status: 'DONE' });
    expect(task.isOverdue).toBe(false);
  });
});

describe('GET /api/tasks', () => {
  it('returns an empty list with pagination metadata', async () => {
    const response = await api().get('/api/tasks');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it('lists every task', async () => {
    await createTask({ title: 'One' });
    await createTask({ title: 'Two' });

    const response = await api().get('/api/tasks');

    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination.total).toBe(2);
  });

  it('filters by status', async () => {
    await createTask({ title: 'Open work', status: 'TODO' });
    await createTask({ title: 'Finished work', status: 'DONE' });

    const response = await api().get('/api/tasks?status=DONE');

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Finished work');
  });

  it('searches title and description case-insensitively', async () => {
    await createTask({ title: 'Deploy the API', description: 'ship it' });
    await createTask({ title: 'Buy milk', description: 'semi-skimmed' });

    const byTitle = await api().get('/api/tasks?search=deploy');
    expect(byTitle.body.data).toHaveLength(1);

    const byDescription = await api().get('/api/tasks?search=SEMI');
    expect(byDescription.body.data).toHaveLength(1);
    expect(byDescription.body.data[0].title).toBe('Buy milk');
  });

  it('sorts by the requested field and direction', async () => {
    await createTask({ title: 'B task' });
    await createTask({ title: 'A task' });
    await createTask({ title: 'C task' });

    const response = await api().get('/api/tasks?sortBy=title&order=asc');

    expect(response.body.data.map((task: { title: string }) => task.title)).toEqual([
      'A task',
      'B task',
      'C task',
    ]);
  });

  it('paginates', async () => {
    for (let index = 0; index < 5; index += 1) {
      await createTask({ title: `Task ${index}` });
    }

    const response = await api().get('/api/tasks?page=2&limit=2');

    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('rejects an out-of-range limit', async () => {
    const response = await api().get('/api/tasks?limit=5000');
    expect(response.status).toBe(422);
  });

  it('rejects a non-numeric page', async () => {
    const response = await api().get('/api/tasks?page=abc');
    expect(response.status).toBe(422);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns a single task', async () => {
    const created = await createTask();

    const response = await api().get(`/api/tasks/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(created.id);
  });

  it('returns 404 for an id that does not exist', async () => {
    const response = await api().get('/api/tasks/3f1a8b4e-0000-4000-8000-000000000000');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 for a malformed id', async () => {
    const response = await api().get('/api/tasks/not-a-uuid');

    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'params.id' }),
    );
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates only the supplied fields', async () => {
    const created = await createTask();

    const response = await api().patch(`/api/tasks/${created.id}`).send({ status: 'IN_PROGRESS' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'IN_PROGRESS',
      title: created.title,
      description: created.description,
      dueDate: created.dueDate,
    });
  });

  it('bumps updatedAt', async () => {
    const created = await createTask();
    await new Promise((resolve) => setTimeout(resolve, 5));

    const response = await api().patch(`/api/tasks/${created.id}`).send({ title: 'Renamed' });

    expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(created.updatedAt),
    );
  });

  it('clears the description and due date when given null', async () => {
    const created = await createTask();

    const response = await api()
      .patch(`/api/tasks/${created.id}`)
      .send({ description: null, dueDate: null });

    expect(response.body.data.description).toBeNull();
    expect(response.body.data.dueDate).toBeNull();
    expect(response.body.data.isOverdue).toBe(false);
  });

  it('rejects an empty body', async () => {
    const created = await createTask();

    const response = await api().patch(`/api/tasks/${created.id}`).send({});

    expect(response.status).toBe(422);
  });

  it('rejects an invalid status', async () => {
    const created = await createTask();

    const response = await api().patch(`/api/tasks/${created.id}`).send({ status: 'nope' });

    expect(response.status).toBe(422);
  });

  it('returns 404 when the task does not exist', async () => {
    const response = await api()
      .patch('/api/tasks/3f1a8b4e-0000-4000-8000-000000000000')
      .send({ title: 'Ghost' });

    expect(response.status).toBe(404);
  });

  it('accepts PUT as an alias', async () => {
    const created = await createTask();

    const response = await api().put(`/api/tasks/${created.id}`).send({ title: 'Via PUT' });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe('Via PUT');
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and makes it unreachable afterwards', async () => {
    const created = await createTask();

    const deleted = await api().delete(`/api/tasks/${created.id}`);
    expect(deleted.status).toBe(204);
    expect(deleted.body).toEqual({});

    const fetched = await api().get(`/api/tasks/${created.id}`);
    expect(fetched.status).toBe(404);
  });

  it('returns 404 when deleting twice', async () => {
    const created = await createTask();

    await api().delete(`/api/tasks/${created.id}`);
    const second = await api().delete(`/api/tasks/${created.id}`);

    expect(second.status).toBe(404);
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const response = await api().get('/api/tasks').set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('rejects an unknown origin with 403 rather than a generic 500', async () => {
    const response = await api().get('/api/tasks').set('Origin', 'http://evil.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CORS_FORBIDDEN');
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404', async () => {
    const response = await api().get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/tasks/meta', () => {
  it('exposes the allowed statuses', async () => {
    const response = await api().get('/api/tasks/meta');

    expect(response.status).toBe(200);
    expect(response.body.data.statuses).toEqual(['TODO', 'IN_PROGRESS', 'DONE']);
  });
});
