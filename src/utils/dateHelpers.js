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

  if (task.dueDate) return new Date(task.dueDate) < new Date();
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

export function isRecentlyCompleted(task, hours = 24) {
  if (!task.lastCompleted) return false;
  return Date.now() - task.lastCompleted < hours * 60 * 60 * 1000;
}
