import { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import {
  formatCompletedAt,
  formatDueDate,
  getNextDue,
  hasDueTime,
  isOverdue,
  parseDueDate,
} from '../utils/dateHelpers';

const PRIORITY_CONFIG = {
  high: { label: 'High', color: '#b45309', bg: '#fffbeb' }, // Sienna
  medium: { label: 'Medium', color: '#928054', bg: '#fef3c7' }, // Warm sand
  low: { label: 'Low', color: '#4d7c0f', bg: '#f7fee7' }, // Sage
};

const FREQ_LABELS = {
  once: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
};


function TaskItem({ task, currentUser, allAssignees = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState('');
  const assignee = allAssignees.find((a) => a.uid === task.assignedTo);
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const overdue = isOverdue(task);

  const markDone = async () => {
    setActionError('');
    const now = Date.now();
    const completion = {
      completedAt: now,
      completedBy: currentUser.uid,
      completedByName: currentUser.displayName,
      dueAt: task.dueDate || null, // snapshot due date for permanent history
      // Snapshot too: whether this completion beat its deadline. Derived now
      // because `dueAt` alone can't tell you later — the task may be edited.
      wasLate: task.dueDate ? now > parseDueDate(task.dueDate).getTime() : null,
    };
    try {
      // This preserves the existing task behavior even before the new
      // taskHistory collection's Firestore rules are deployed.
      await updateDoc(doc(db, 'tasks', task.id), {
        lastCompleted: now,
        lastCompletedBy: currentUser.uid,
        lastCompletedByName: currentUser.displayName,
        completionHistory: arrayUnion(completion),
      });
    } catch (err) {
      console.error('Error completing task:', err);
      setActionError('Could not mark this task complete. Please try again.');
      return;
    }

    try {
      // A separate permanent entry makes completed work survive task deletion.
      await addDoc(collection(db, 'taskHistory'), {
        ...completion,
        taskId: task.id,
        taskName: task.name,
        room: task.room || 'Other',
        priority: task.priority || 'medium',
        frequency: task.frequency || 'once',
        workspace: task.workspace || 'personal',
        ownerUid: task.ownerUid || currentUser.uid,
      });
    } catch (err) {
      // The task was completed successfully above; it remains visible in the
      // History page through completionHistory until the new rules are live.
      console.error('Error storing permanent task history:', err);
    }
  };

  const removeTask = async () => {
    setActionError('');
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
    } catch (err) {
      console.error('Error deleting task:', err);
      setActionError('Could not delete this task. Please try again.');
    }
  };
  const nextDue = task.lastCompleted
    ? getNextDue(task.lastCompleted, task.frequency)
    : null;

  return (
    <div
      className={`task-item-card ${overdue ? 'overdue' : ''} ${task.lastCompleted && task.frequency === 'once' ? 'done' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        className="task-border-left"
        style={{ backgroundColor: priority.color }}
      ></div>
      <div className="task-item-content-wrapper">
        <div className="task-main-content">
          <div className="task-info-stack">
            <span className="task-title">{task.name}</span>
            <span className="task-subtitle">
              <span className="meta-chip">{task.room}</span> ·
              <span className="meta-chip">
                {FREQ_LABELS[task.frequency] || task.frequency}
              </span>
              {task.tags?.map((t) => (
                <span key={t} className="meta-chip tag">
                  {t}
                </span>
              ))}
            </span>
          </div>

          <div className="task-actions">
            <span
              className="priority-pill"
              style={{ backgroundColor: priority.bg, color: priority.color }}
            >
              {priority.label}
            </span>

            {assignee && (
              <div
                className="assignee-badge"
                title={`Assigned to ${assignee.name || 'Unknown'}`}
              >
                {assignee.photoURL ? (
                  <img src={assignee.photoURL} alt="" className="avatar-sm" />
                ) : (
                  <div className="avatar-sm placeholder">
                    {assignee.name?.[0] || '?'}
                  </div>
                )}
              </div>
            )}
            {task.dueDate && (
              <span
                className={`due-date ${overdue ? 'overdue-text' : ''}`}
                title={`Due ${formatDueDate(task.dueDate)}`}
              >
                {hasDueTime(task.dueDate) ? (
                  <Clock size={13} strokeWidth={2} />
                ) : (
                  <Calendar size={13} strokeWidth={2} />
                )}
                {formatDueDate(task.dueDate)}
              </span>
            )}
            {overdue && (
                <span className="overdue-badge">
                  <AlertCircle size={12} strokeWidth={2.5} />
                  Overdue
                </span>
            )}

            <button
              className="btn-done-fresh"
              onClick={(e) => {
                e.stopPropagation();
                markDone();
              }}
            >
              <Check size={14} strokeWidth={2.5} />
              Done
            </button>
            <button
              className="btn-delete"
              title="Delete task"
              onClick={(e) => {
                e.stopPropagation();
                removeTask();
              }}
            >
              <Trash2 size={15} strokeWidth={2} />
            </button>
            <span className="expand-icon">
              {expanded ? (
                <ChevronUp size={15} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={15} strokeWidth={2.5} />
              )}
            </span>
          </div>
        </div>

        {expanded && (
          <div className="task-details" onClick={(e) => e.stopPropagation()}>
            {task.lastCompleted && (
              <p className="detail-line">
                <span className="detail-label">Last done:</span>
                {formatCompletedAt(task.lastCompleted)}
                {task.lastCompletedByName && ` by ${task.lastCompletedByName}`}
              </p>
            )}
            {nextDue && task.frequency !== 'once' && (
              <p className="detail-line">
                <span className="detail-label">Next due:</span>
                {/* Derived from `lastCompleted`, so it carries a time of day. */}
                {formatCompletedAt(nextDue.getTime())}
              </p>
            )}
            {task.notes && (
              <p className="detail-line">
                <span className="detail-label">Notes:</span>
                {task.notes}
              </p>
            )}
            {task.completionHistory?.length > 0 && (
              <div className="history">
                <p className="detail-label">
                  History ({task.completionHistory.length} completions):
                </p>
                <ul>
                  {[...task.completionHistory]
                    .reverse()
                    .slice(0, 5)
                    .map((h, i) => (
                      <li key={i}>
                        {formatCompletedAt(h.completedAt)} —{' '}
                        {h.completedByName || 'Unknown'}
                        {h.wasLate && <span className="history-late"> late</span>}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {actionError && <p className="task-action-error">{actionError}</p>}
      </div>
    </div>
  );
}

export default TaskItem;
