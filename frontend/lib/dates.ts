/**
 * The API stores and returns UTC ISO strings; `<input type="datetime-local">`
 * works in the browser's local time and has no timezone. These helpers are the
 * only place that conversion happens.
 */

/** ISO string -> `YYYY-MM-DDTHH:mm` in local time, for a datetime-local input. */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** datetime-local value -> UTC ISO string, or null when the field is empty. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Human-readable absolute date, e.g. "1 Oct 2026, 09:00". */
export function formatDateTime(iso: string | null): string {
  if (!iso) return 'No due date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Relative phrasing for due dates, e.g. "in 3 days" / "2 days ago". */
export function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
}
