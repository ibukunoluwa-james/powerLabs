'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import {
  ButtonLink,
  ErrorNotice,
  OverdueBadge,
  Spinner,
  StatusBadge,
  buttonStyles,
} from '@/components/ui';
import { ApiClientError, deleteTask, updateTask } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/dates';
import { useTask } from '@/lib/useTask';
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from '@/lib/types';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16 hands route params to client components as a promise.
  const { id } = use(params);
  const router = useRouter();

  const { state, reload, replaceTask } = useTask(id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleStatusChange(status: TaskStatus) {
    setBusy(true);
    setActionError(null);
    try {
      replaceTask(await updateTask(id, { status }));
    } catch (caught) {
      setActionError(caught instanceof ApiClientError ? caught.message : 'Could not update the status.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(title: string) {
    // A native confirm keeps the dependency count at zero; a real product would
    // use a proper dialog with focus management.
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setBusy(true);
    setActionError(null);
    try {
      await deleteTask(id);
      router.push('/');
      router.refresh();
    } catch (caught) {
      setActionError(caught instanceof ApiClientError ? caught.message : 'Could not delete the task.');
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <Spinner label="Loading task…" />;

  if (state.status === 'not-found') {
    return (
      <div className="space-y-4">
        <ErrorNotice
          title="Task not found"
          message="This task does not exist, or it has already been deleted."
        />
        <ButtonLink href="/">← Back to tasks</ButtonLink>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-4">
        <ErrorNotice message={state.message} onRetry={reload} />
        <ButtonLink href="/">← Back to tasks</ButtonLink>
      </div>
    );
  }

  const { task } = state;
  const relative = formatRelative(task.dueDate);

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-block text-sm text-slate-500 hover:text-slate-900 hover:underline">
        ← Back to tasks
      </Link>

      {actionError && <ErrorNotice message={actionError} />}

      <article className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          {task.isOverdue && <OverdueBadge />}
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight break-words">{task.title}</h1>

        <p className="mt-4 whitespace-pre-wrap text-slate-700">
          {task.description ?? <span className="text-slate-400">No description</span>}
        </p>

        <dl className="mt-8 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Due date</dt>
            <dd className={`mt-1 text-sm ${task.isOverdue ? 'font-medium text-rose-600' : 'text-slate-700'}`}>
              {formatDateTime(task.dueDate)}
              {relative && <span className="block text-xs text-slate-400">{relative}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Created</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatDateTime(task.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Last updated</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatDateTime(task.updatedAt)}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
          <label htmlFor="status" className="text-sm text-slate-600">
            Status
          </label>
          <select
            id="status"
            value={task.status}
            disabled={busy}
            onChange={(event) => void handleStatusChange(event.target.value as TaskStatus)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
          >
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>

          <div className="ml-auto flex gap-3">
            <ButtonLink href={`/tasks/${task.id}/edit`} variant="primary">
              Edit
            </ButtonLink>
            <button
              type="button"
              onClick={() => void handleDelete(task.title)}
              disabled={busy}
              className={buttonStyles.danger}
            >
              Delete
            </button>
          </div>
        </div>
      </article>

      <p className="text-xs text-slate-400">Task ID: {task.id}</p>
    </div>
  );
}
