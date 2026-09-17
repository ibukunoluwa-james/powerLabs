'use client';

import Link from 'next/link';
import { use } from 'react';
import { TaskForm } from '@/components/TaskForm';
import { ButtonLink, ErrorNotice, Spinner } from '@/components/ui';
import { useTask } from '@/lib/useTask';

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, reload } = useTask(id);

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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm text-slate-500 hover:text-slate-900 hover:underline"
        >
          ← Back to task
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit task</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <TaskForm task={task} />
      </div>
    </div>
  );
}
