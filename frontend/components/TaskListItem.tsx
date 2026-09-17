'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiClientError, deleteTask, updateTask } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/dates';
import type { Task } from '@/lib/types';
import { OverdueBadge, StatusBadge } from './ui';

interface TaskListItemProps {
  task: Task;
  /** Called after a mutation so the list can refetch. */
  onChanged: () => void;
  onError: (message: string) => void;
}

export function TaskListItem({ task, onChanged, onError }: TaskListItemProps) {
  const [busy, setBusy] = useState(false);

  async function runMutation(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (error) {
      onError(error instanceof ApiClientError ? error.message : 'The action failed. Please try again.');
      setBusy(false);
    }
  }

  function handleToggleDone() {
    void runMutation(() => updateTask(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' }));
  }

  function handleDelete() {
    // A native confirm keeps the dependency count at zero; a real product would
    // use a proper dialog with focus management.
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    void runMutation(() => deleteTask(task.id));
  }

  const relative = formatRelative(task.dueDate);

  return (
    <li
      className={`rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm ${
        busy ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className={`block truncate font-medium text-slate-900 hover:underline ${
              task.status === 'DONE' ? 'line-through decoration-slate-400' : ''
            }`}
          >
            {task.title}
          </Link>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{task.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            {task.isOverdue && <OverdueBadge />}
            <span className="text-xs text-slate-500">
              {formatDateTime(task.dueDate)}
              {relative && ` · ${relative}`}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleToggleDone}
            disabled={busy}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed"
          >
            {task.status === 'DONE' ? 'Reopen' : 'Mark done'}
          </button>
          <Link
            href={`/tasks/${task.id}/edit`}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
