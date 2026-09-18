/**
 * The API stores and returns UTC ISO strings; the form works in the browser's
 * local time. These helpers are the only place that conversion happens.
 *
 * The due date is split across a `date` input and an optional `time` input
 * rather than a single `datetime-local`. A `datetime-local` reports an empty
 * value until *both* halves are filled, so entering a date and leaving the time
 * blank silently discarded the date.
 */

/** When no time is given, a task is due by the end of the chosen day. */
export const END_OF_DAY = '23:59';

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO string -> `YYYY-MM-DD` in local time, for a date input. */
export function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO string -> `HH:mm` in local time, for a time input. */
export function toTimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * `YYYY-MM-DD` + optional `HH:mm` (both local) -> UTC ISO string.
 *
 * Returns null when there is no date, which is how the field is cleared. An
 * empty time means "by the end of that day" - midnight would make a task
 * created for today instantly overdue.
 *
 * The parts are fed to the `Date` constructor individually on purpose: parsing
 * the string "2026-09-25" would be treated as *UTC* midnight, which lands on
 * the previous day for anyone behind UTC.
 */
export function combineDateAndTime(date: string, time: string): string | null {
  if (!date) return null;

  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = (time || END_OF_DAY).split(':').map(Number);

  if ([year, month, day, hours, minutes].some((part) => part === undefined || Number.isNaN(part))) {
    return null;
  }

  const local = new Date(year!, month! - 1, day!, hours!, minutes!, 0, 0);
  if (Number.isNaN(local.getTime())) return null;

  // Reject values the Date constructor would silently roll over (e.g. month 13).
  if (local.getFullYear() !== year || local.getMonth() !== month! - 1 || local.getDate() !== day) {
    return null;
  }

  return local.toISOString();
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
