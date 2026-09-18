import { describe, expect, it } from 'vitest';
import {
  END_OF_DAY,
  combineDateAndTime,
  formatDateTime,
  formatRelative,
  toDateInputValue,
  toTimeInputValue,
} from '../lib/dates';

/**
 * These helpers convert between the API's UTC ISO strings and the local-time
 * values the form's date and time inputs work with - the easiest place in the
 * app for an off-by-one-timezone bug to hide.
 *
 * The assertions are deliberately timezone-*independent* (round trips, formats
 * and relative offsets) rather than hard-coded local strings: Node on Windows
 * ignores the `TZ` environment variable, so a test asserting "09:30" would pass
 * on one machine and fail on another. The round-trip tests still catch the bug
 * that matters - mixing up UTC and local getters - on any machine that is not
 * itself on UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

describe('toDateInputValue', () => {
  it('returns an empty string for null', () => {
    expect(toDateInputValue(null)).toBe('');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(toDateInputValue('not a date')).toBe('');
  });

  it('produces the zero-padded YYYY-MM-DD shape the input requires', () => {
    // January and single-digit days are where padding bugs surface.
    expect(toDateInputValue('2026-01-05T03:07:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses the local calendar day, not the UTC one', () => {
    const iso = '2026-07-15T12:00:00.000Z';
    const local = new Date(iso);

    expect(toDateInputValue(iso)).toBe(
      `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(
        local.getDate(),
      ).padStart(2, '0')}`,
    );
  });
});

describe('toTimeInputValue', () => {
  it('returns an empty string for null', () => {
    expect(toTimeInputValue(null)).toBe('');
  });

  it('produces the zero-padded HH:mm shape the input requires', () => {
    expect(toTimeInputValue('2026-01-05T03:07:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('combineDateAndTime', () => {
  it('returns null with no date, so the field can be cleared', () => {
    expect(combineDateAndTime('', '')).toBeNull();
    expect(combineDateAndTime('', '09:30')).toBeNull();
  });

  it('returns a UTC ISO string', () => {
    expect(combineDateAndTime('2026-07-15', '09:30')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('keeps a date with no time on that same local day', () => {
    // The regression this split exists for: a date entered without a time used
    // to be discarded entirely and saved as "no due date".
    const iso = combineDateAndTime('2026-07-15', '');

    expect(iso).not.toBeNull();
    expect(toDateInputValue(iso)).toBe('2026-07-15');
  });

  it('defaults a missing time to the end of the day, not midnight', () => {
    // Midnight would make a task created for today instantly overdue.
    expect(toTimeInputValue(combineDateAndTime('2026-07-15', ''))).toBe(END_OF_DAY);
  });

  it('interprets the date in local time rather than UTC', () => {
    // `new Date('2026-07-15')` is UTC midnight, which is 14 July for anyone
    // behind UTC. Building from parts keeps the day the user picked.
    const parsed = new Date(combineDateAndTime('2026-07-15', '09:30')!);

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(15);
    expect(parsed.getHours()).toBe(9);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('rejects a date the Date constructor would silently roll over', () => {
    expect(combineDateAndTime('2026-13-45', '09:30')).toBeNull();
    expect(combineDateAndTime('2026-02-30', '09:30')).toBeNull();
  });

  it('rejects an unparseable date', () => {
    expect(combineDateAndTime('tomorrow-ish', '')).toBeNull();
  });
});

describe('date round trip', () => {
  // The inputs have minute precision, so every fixture has zero seconds.
  const isoFixtures = [
    '2026-07-15T13:45:00.000Z',
    '2026-01-01T00:00:00.000Z',
    '2026-12-31T23:59:00.000Z',
    '2027-03-04T09:30:00.000Z',
    '2026-06-30T12:00:00.000Z',
  ];

  it.each(isoFixtures)('survives ISO -> local date+time -> ISO unchanged (%s)', (iso) => {
    expect(combineDateAndTime(toDateInputValue(iso), toTimeInputValue(iso))).toBe(iso);
  });

  it('survives local -> ISO -> local unchanged', () => {
    const iso = combineDateAndTime('2026-09-17', '08:05');

    expect(toDateInputValue(iso)).toBe('2026-09-17');
    expect(toTimeInputValue(iso)).toBe('08:05');
  });
});

describe('formatDateTime', () => {
  it('describes a missing due date', () => {
    expect(formatDateTime(null)).toBe('No due date');
  });

  it('flags an unparseable value instead of rendering "Invalid Date"', () => {
    expect(formatDateTime('gibberish')).toBe('Invalid date');
  });

  it('includes the year, day and time for a valid date', () => {
    // Mid-year and mid-day, so no timezone can shift it across a year boundary.
    const formatted = formatDateTime('2026-07-15T12:00:00.000Z');

    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatRelative', () => {
  it('returns null when there is no date to describe', () => {
    expect(formatRelative(null)).toBeNull();
  });

  it('returns null for an unparseable date', () => {
    expect(formatRelative('nope')).toBeNull();
  });

  it('names today, tomorrow and yesterday', () => {
    expect(formatRelative(new Date(Date.now() + 60_000).toISOString())).toBe('today');
    expect(formatRelative(new Date(Date.now() + DAY_MS).toISOString())).toBe('tomorrow');
    expect(formatRelative(new Date(Date.now() - DAY_MS).toISOString())).toBe('yesterday');
  });

  it('counts forwards and backwards in days', () => {
    expect(formatRelative(new Date(Date.now() + 5 * DAY_MS).toISOString())).toBe('in 5 days');
    expect(formatRelative(new Date(Date.now() - 5 * DAY_MS).toISOString())).toBe('5 days ago');
  });
});
