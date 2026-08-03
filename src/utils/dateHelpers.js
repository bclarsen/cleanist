/**
 * Parses a `dueDate` into a local-time Date, or null.
 *
 * Two formats exist in the data and they must not be parsed the same way:
 *  - `YYYY-MM-DD`        — legacy, date-only. `new Date()` reads this as UTC
 *                          midnight, which lands on the previous day west of
 *                          Greenwich, so it's split and built locally instead.
 *  - `YYYY-MM-DDTHH:mm`  — date + time, already parsed as local time.
 *
 * A date-only value means "end of that day" — a task due today isn't overdue at
 * 00:01. `hasDueTime` distinguishes the two so callers can format accordingly.
 */
export function parseDueDate(dueDate) {
  if (!dueDate) return null;
  const [datePart, timePart] = String(dueDate).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  if (timePart) {
    const [hh, mm] = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0);
  }
  // Date-only: due at the end of the day.
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function hasDueTime(dueDate) {
  return !!dueDate && String(dueDate).includes('T');
}

// Formats a due date, showing the time only when one was actually set.
export function formatDueDate(dueDate) {
  const d = parseDueDate(dueDate);
  if (!d) return '';
  if (!hasDueTime(dueDate)) return d.toLocaleDateString();
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

// Formats a completion timestamp (millisecond number) with its time of day.
export function formatCompletedAt(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// getNextDue: returns the next due Date object, or null if not applicable
export function getNextDue(lastCompleted, frequency) {
  if (!lastCompleted) return null;
  const d = new Date(lastCompleted);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      return null;
  }
  return d;
}

// isOverdue: single source of truth for overdue logic
export function isOverdue(task) {
  // A completed one-time task is never overdue
  if (task.frequency === 'once' && task.lastCompleted) return false;

  // parseDueDate, not `new Date()`: date-only values need local-time parsing and
  // an end-of-day cutoff, so a task due today isn't overdue at 00:01.
  if (task.dueDate) return parseDueDate(task.dueDate) < new Date();
  if (task.lastCompleted && task.frequency !== 'once') {
    const next = getNextDue(task.lastCompleted, task.frequency);
    return next && next < new Date();
  }
  return false;
}

// getNextDueLabel: your original human-readable string version, renamed to avoid clashing
export function getNextDueLabel(lastCompleted, frequency) {
  if (!lastCompleted) return 'Not done yet';
  const last = new Date(lastCompleted);
  const next = new Date(last);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  const now = new Date();
  if (next < now) return 'Overdue!';
  return `Due: ${next.toLocaleDateString()}`;
}

// How long a finished task lingers in the Tasks page "Completed" section when
// no workspace preference says otherwise.
export const DEFAULT_COMPLETED_WINDOW_MS = 24 * 60 * 60 * 1000;

// Note the unit: `windowMs` is milliseconds, not hours. The preference behind it
// goes down to minutes, which hours couldn't express.
export function isRecentlyCompleted(task, windowMs = DEFAULT_COMPLETED_WINDOW_MS) {
  if (!task.lastCompleted) return false;
  return Date.now() - task.lastCompleted < windowMs;
}

// A stored window is a single millisecond number; the Preferences UI edits it as
// days/hours/minutes. These two convert between the shapes.
export function msToParts(ms) {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

export function partsToMs({ days = 0, hours = 0, minutes = 0 } = {}) {
  const d = Math.max(0, Number(days) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const m = Math.max(0, Number(minutes) || 0);
  return ((d * 24 + h) * 60 + m) * 60 * 1000;
}

/**
 * Which "Completed" window actually applies right now.
 *
 * The team's value is the shared setting for the whole household; a member who
 * picks their own window overrides it for themselves only. `null`/absent on the
 * user side means "match the team", which is the default — otherwise a personal
 * value would always be set and the team setting could never take effect.
 */
export function resolveCompletedWindowMs(userWindowMs, teamWindowMs) {
  if (typeof userWindowMs === 'number' && userWindowMs > 0) return userWindowMs;
  if (typeof teamWindowMs === 'number' && teamWindowMs > 0) return teamWindowMs;
  return DEFAULT_COMPLETED_WINDOW_MS;
}

export function formatDuration(ms) {
  const { days, hours, minutes } = msToParts(ms);
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' ') : 'less than a minute';
}
