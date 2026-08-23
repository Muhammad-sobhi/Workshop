/**
 * Local-timezone date helpers.
 *
 * NEVER use `date.toISOString().split('T')[0]` for calendar dates:
 * toISOString() converts to UTC, which shifts the date back a day for
 * users east of UTC (e.g. UTC+2/UTC+3) between midnight and 02:00 local.
 */

const pad = (n) => String(n).padStart(2, '0');

/**
 * Format a Date (or date-parseable value) as a local calendar date
 * string: YYYY-MM-DD, using the user's timezone.
 */
export function toLocalDateString(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayString() {
  return toLocalDateString(new Date());
}

/**
 * Saturday that starts the week containing `value`.
 * Work week is Sat–Thu, so weeks start on Saturday.
 */
export function startOfWeekSaturday(value = new Date()) {
  const src = value instanceof Date ? value : new Date(value);
  // Normalize to local midnight to avoid any time-of-day carryover.
  const d = new Date(src.getFullYear(), src.getMonth(), src.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d;
}

/**
 * Shift a Date by N days without DST/timezone surprises,
 * returning a new Date at local midnight.
 */
export function addDays(value, days) {
  const src = value instanceof Date ? value : new Date(value);
  const d = new Date(src.getFullYear(), src.getMonth(), src.getDate());
  d.setDate(d.getDate() + days);
  return d;
}
