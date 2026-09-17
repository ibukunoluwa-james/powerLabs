'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiClientError, createTask, updateTask } from '@/lib/api';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/dates';
import { STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus } from '@/lib/types';
import { ErrorNotice, buttonStyles } from './ui';

interface TaskFormProps {
  /** Omitted when creating; supplied when editing an existing task. */
  task?: Task;
}

const inputStyles =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';

export function TaskForm({ task }: TaskFormProps) {
  const router = useRouter();
  const isEdit = task !== undefined;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'TODO');
  const [dueDate, setDueDate] = useState(toDateTimeLocalValue(task?.dueDate ?? null));

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // The API is the source of truth for validation, but checking the obvious case
  // here saves a round trip and gives instant feedback.
  function validate() {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = 'Title is required';
    if (title.trim().length > 200) errors.title = 'Title must be 200 characters or fewer';
    if (description.length > 2000) errors.description = 'Description must be 2000 characters or fewer';
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const localErrors = validate();
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    const payload = {
      title: title.trim(),
      // Empty strings are sent as null so the field is genuinely cleared rather
      // than stored as "".
      description: description.trim() === '' ? null : description.trim(),
      status,
      dueDate: fromDateTimeLocalValue(dueDate),
    };

    setSubmitting(true);
    try {
      const saved = isEdit ? await updateTask(task.id, payload) : await createTask(payload);
      // refresh() drops the client router cache so the list reflects the change.
      router.push(`/tasks/${saved.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError('An unexpected error occurred. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <ErrorNotice title="Could not save the task" message={formError} />}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Title <span className="text-rose-600">*</span>
        </label>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="e.g. Write the project README"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? 'title-error' : undefined}
          className={`mt-1 ${inputStyles} ${fieldErrors.title ? 'border-rose-400' : ''}`}
        />
        {fieldErrors.title && (
          <p id="title-error" className="mt-1 text-sm text-rose-600">
            {fieldErrors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          placeholder="Any extra detail…"
          aria-invalid={Boolean(fieldErrors.description)}
          className={`mt-1 ${inputStyles} ${fieldErrors.description ? 'border-rose-400' : ''}`}
        />
        <div className="mt-1 flex justify-between">
          {fieldErrors.description ? (
            <p className="text-sm text-rose-600">{fieldErrors.description}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-400">{description.length}/2000</span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
            className={`mt-1 ${inputStyles}`}
          >
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700">
            Due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.dueDate)}
            className={`mt-1 ${inputStyles} ${fieldErrors.dueDate ? 'border-rose-400' : ''}`}
          />
          {fieldErrors.dueDate ? (
            <p className="mt-1 text-sm text-rose-600">{fieldErrors.dueDate}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Optional. Shown in your local timezone.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-6">
        <button type="submit" disabled={submitting} className={buttonStyles.primary}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting}
          className={buttonStyles.secondary}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
