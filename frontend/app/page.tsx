'use client';

import { useEffect, useState } from 'react';
import { TaskListItem } from '@/components/TaskListItem';
import { ButtonLink, EmptyState, ErrorNotice, Spinner, buttonStyles } from '@/components/ui';
import { ApiClientError, listTasks } from '@/lib/api';
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type ListTasksParams,
  type Pagination,
  type Task,
  type TaskStatus,
} from '@/lib/types';

const PAGE_SIZE = 10;

const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: NonNullable<ListTasksParams['sortBy']>;
  order: 'asc' | 'desc';
}> = [
  { value: 'createdAt:desc', label: 'Newest first', sortBy: 'createdAt', order: 'desc' },
  { value: 'createdAt:asc', label: 'Oldest first', sortBy: 'createdAt', order: 'asc' },
  { value: 'dueDate:asc', label: 'Due soonest', sortBy: 'dueDate', order: 'asc' },
  { value: 'dueDate:desc', label: 'Due latest', sortBy: 'dueDate', order: 'desc' },
  { value: 'title:asc', label: 'Title A–Z', sortBy: 'title', order: 'asc' },
];

const selectStyles =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';

/** The outcome of one fetch, tagged with the query it answers. */
interface LoadedState {
  key: string;
  tasks: Task[];
  pagination: Pagination | null;
  error: string | null;
}

export default function TaskListPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(SORT_OPTIONS[0].value);
  const [page, setPage] = useState(1);
  /** Bumped to force a refetch of the same query (retry, or after a mutation). */
  const [reloadToken, setReloadToken] = useState(0);

  const [result, setResult] = useState<LoadedState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Every input that affects the request is folded into one key. Loading is then
  // derived - "the result I hold does not answer the query I am showing" -
  // rather than being a separate piece of state to keep in sync.
  const queryKey = JSON.stringify({ statusFilter, search, sort, page, reloadToken });
  const loading = result === null || result.key !== queryKey;

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // Guards against a slow earlier request overwriting a newer result.
    let cancelled = false;
    const option = SORT_OPTIONS.find((item) => item.value === sort) ?? SORT_OPTIONS[0];

    async function run() {
      try {
        const response = await listTasks({
          status: statusFilter,
          search,
          sortBy: option.sortBy,
          order: option.order,
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;

        setResult({ key: queryKey, tasks: response.data, pagination: response.pagination, error: null });

        // Deleting the last task on a page would otherwise leave the user
        // staring at an empty page N.
        if (page > response.pagination.totalPages) {
          setPage(response.pagination.totalPages);
        }
      } catch (caught) {
        if (cancelled) return;
        setResult({
          key: queryKey,
          tasks: [],
          pagination: null,
          error:
            caught instanceof ApiClientError ? caught.message : 'Could not load tasks. Please try again.',
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [queryKey, statusFilter, search, sort, page]);

  const refresh = () => setReloadToken((token) => token + 1);

  const tasks = result?.tasks ?? [];
  const pagination = result?.pagination ?? null;
  const loadError = result?.error ?? null;
  const hasFilters = statusFilter !== '' || search !== '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your tasks</h1>
        <p className="mt-1 text-sm text-slate-500">
          {/* Three distinct states: a failed load must not keep claiming to be
              loading underneath an error notice that says otherwise. */}
          {loading
            ? 'Loading…'
            : loadError
              ? 'Could not load your tasks'
              : `${pagination?.total ?? 0} ${pagination?.total === 1 ? 'task' : 'tasks'}${
                  hasFilters ? ' matching your filters' : ''
                }`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search title or description…"
          aria-label="Search tasks"
          className={`flex-1 ${selectStyles}`}
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as TaskStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
          className={selectStyles}
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
          aria-label="Sort tasks"
          className={selectStyles}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {actionError && <ErrorNotice message={actionError} />}
      {loadError && <ErrorNotice message={loadError} onRetry={refresh} />}

      {loading && <Spinner label="Loading tasks…" />}

      {!loading && !loadError && tasks.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No tasks match your filters' : 'No tasks yet'}
          message={
            hasFilters
              ? 'Try a different search term or clear the status filter.'
              : 'Create your first task to get started.'
          }
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setSearchInput('');
                  setPage(1);
                }}
                className={buttonStyles.secondary}
              >
                Clear filters
              </button>
            ) : (
              <ButtonLink href="/tasks/new" variant="primary">
                New task
              </ButtonLink>
            )
          }
        />
      )}

      {!loading && !loadError && tasks.length > 0 && (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              onChanged={() => {
                setActionError(null);
                refresh();
              }}
              onError={setActionError}
            />
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav
          className="flex items-center justify-between border-t border-slate-200 pt-4"
          aria-label="Pagination"
        >
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={pagination.page <= 1 || loading}
            className={buttonStyles.secondary}
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
            disabled={pagination.page >= pagination.totalPages || loading}
            className={buttonStyles.secondary}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
