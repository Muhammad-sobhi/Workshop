import { describe, it, expect } from 'vitest';
import { toLocalDateString, todayString, startOfWeekSaturday, addDays } from './dates';

const pad = (n) => String(n).padStart(2, '0');

describe('toLocalDateString', () => {
  it('formats a Date using LOCAL timezone parts (YYYY-MM-DD)', () => {
    // Constructed via local-time components — no UTC offsets involved.
    expect(toLocalDateString(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(toLocalDateString(new Date(1999, 6, 15))).toBe('1999-07-15');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toLocalDateString(new Date(2026, 2, 5))).toBe('2026-03-05');
    expect(toLocalDateString(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('uses local calendar parts even for a date built near midnight', () => {
    // Local midnight on the 1st must render as the 1st regardless of timezone.
    const localMidnight = new Date(2026, 4, 1, 0, 0, 0, 0);
    const parts = `${localMidnight.getFullYear()}-${pad(localMidnight.getMonth() + 1)}-${pad(localMidnight.getDate())}`;
    expect(toLocalDateString(localMidnight)).toBe(parts);
    expect(parts.endsWith('-05-01')).toBe(true);
  });

  it('accepts date-parseable values like ISO strings at noon', () => {
    // Noon avoids any midnight UTC-shift ambiguity.
    expect(toLocalDateString('2026-03-10T12:00:00')).toBe(
      toLocalDateString(new Date(2026, 2, 10, 12))
    );
  });

  it('returns empty string for invalid input', () => {
    expect(toLocalDateString('not-a-date')).toBe('');
    expect(toLocalDateString(NaN)).toBe('');
    expect(toLocalDateString(undefined)).toBe('');
    expect(toLocalDateString(new Date('bogus'))).toBe('');
  });

  it('treats null as the epoch (JS Date coercion), matching new Date(null)', () => {
    expect(toLocalDateString(null)).toBe(toLocalDateString(new Date(null)));
    expect(toLocalDateString(null)).toBe('1970-01-01');
  });
});

describe('todayString', () => {
  it("returns today's local date as YYYY-MM-DD built from new Date() parts", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(todayString()).toBe(expected);
  });

  it('matches YYYY-MM-DD shape', () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('startOfWeekSaturday', () => {
  it('maps a Wednesday to the preceding Saturday', () => {
    // Aug 19, 2026 is a Wednesday.
    const result = startOfWeekSaturday(new Date(2026, 7, 19));
    expect(result).toEqual(new Date(2026, 7, 15));
  });

  it('returns the same day when input is already a Saturday', () => {
    // Aug 15, 2026 is a Saturday.
    expect(startOfWeekSaturday(new Date(2026, 7, 15))).toEqual(new Date(2026, 7, 15));
  });

  it('always lands on weekday 6 across a range of dates', () => {
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 28; day++) {
        const src = new Date(2026, month, day);
        expect(startOfWeekSaturday(src).getDay()).toBe(6);
      }
    }
  });

  it('never shifts a day due to time-of-day (23:59 local)', () => {
    const lateNight = new Date(2026, 7, 19, 23, 59, 59, 999);
    expect(startOfWeekSaturday(lateNight)).toEqual(new Date(2026, 7, 15));

    const earlyMorning = new Date(2026, 7, 16, 0, 0, 0, 1);
    expect(startOfWeekSaturday(earlyMorning)).toEqual(new Date(2026, 7, 15));
  });

  it('crosses month and year boundaries backwards correctly', () => {
    // Mar 1, 2026 is a Sunday -> week starts Sat Feb 28.
    expect(startOfWeekSaturday(new Date(2026, 2, 1))).toEqual(new Date(2026, 1, 28));
    // Jan 1, 2026 is a Thursday -> week starts Sat Dec 27, 2025.
    expect(startOfWeekSaturday(new Date(2026, 0, 1))).toEqual(new Date(2025, 11, 27));
  });

  it('accepts parseable string input', () => {
    expect(startOfWeekSaturday('2026-08-19')).toEqual(new Date(2026, 7, 15));
  });
});

describe('addDays', () => {
  it('shifts by N days within a month', () => {
    expect(addDays(new Date(2026, 7, 15), 3)).toEqual(new Date(2026, 7, 18));
    expect(addDays(new Date(2026, 7, 15), -3)).toEqual(new Date(2026, 7, 12));
  });

  it('crosses a month boundary: Jan 31 + 1 day = Feb 1', () => {
    expect(addDays(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
  });

  it('crosses a year boundary: Dec 31 + 1 day = next Jan 1', () => {
    expect(addDays(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 1));
  });

  it('handles leap years: Feb 28, 2028 + 1 = Feb 29', () => {
    expect(addDays(new Date(2028, 1, 28), 1)).toEqual(new Date(2028, 1, 29));
  });

  it('handles non-leap years: Feb 28, 2026 + 1 = Mar 1', () => {
    expect(addDays(new Date(2026, 1, 28), 1)).toEqual(new Date(2026, 2, 1));
  });

  it('normalizes time-of-day to local midnight and returns a new Date', () => {
    const src = new Date(2026, 7, 15, 18, 30, 45, 123);
    const result = addDays(src, 1);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    expect(result).toEqual(new Date(2026, 7, 16));
    expect(result).not.toBe(src); // immutability
    expect(src.getHours()).toBe(18); // source untouched
  });

  it('supports zero shift', () => {
    expect(addDays(new Date(2026, 7, 15), 0)).toEqual(new Date(2026, 7, 15));
  });
});
