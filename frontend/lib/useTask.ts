'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, getTask } from './api';
import type { Task } from './types';

export type TaskState =
  | { status: 'loading' }
  | { status: 'loaded'; task: Task }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

/**
 * Loads one task by id, shared by the detail and edit pages.
 *
 * The fetch result is tagged with the query it answers, so "loading" is derived
 * rather than stored - that keeps every state update on the far side of an
 * `await` (no cascading renders) and makes a stale response impossible to apply.
 */
export function useTask(id: string) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ key: string; state: TaskState } | null>(null);

  const key = `${id}:${reloadToken}`;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let next: TaskState;
      try {
        next = { status: 'loaded', task: await getTask(id) };
      } catch (caught) {
        if (caught instanceof ApiClientError && caught.status === 404) {
          next = { status: 'not-found' };
        } else {
          next = {
            status: 'error',
            message: caught instanceof ApiClientError ? caught.message : 'Could not load this task.',
          };
        }
      }
      if (!cancelled) setResult({ key, state: next });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [key, id]);

  const state: TaskState = result?.key === key ? result.state : { status: 'loading' };

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /** Applies a task the caller already has (e.g. the result of a mutation). */
  const replaceTask = useCallback(
    (task: Task) => setResult({ key: `${task.id}:${reloadToken}`, state: { status: 'loaded', task } }),
    [reloadToken],
  );

  return { state, reload, replaceTask };
}
