import { useState } from 'react';
import { updateDoc, deleteDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { getNextDue, isOverdue } from '../utils/dateHelpers';

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
  const assignee = allAssignees.find((a) => a.uid === task.assignedTo);
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const overdue = isOverdue(task);

  const markDone = async () => {
    const now = Date.now();
    await updateDoc(doc(db, 'tasks', task.id), {
      lastCompleted: now,
      lastCompletedBy: currentUser.uid,
      lastCompletedByName: currentUser.displayName,
      completionHistory: arrayUnion({
        completedAt: now,
        completedBy: currentUser.uid,
        completedByName: currentUser.displayName,
        dueAt: task.dueDate || null, // snapshot due date for permanent history
      }),
    });
  };

  const removeTask = () => deleteDoc(doc(db, 'tasks', task.id));
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
              <span className={`due-date ${overdue ? 'overdue-text' : ''}`}>
                📅 {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {overdue && (
                <span className="overdue-badge">❗ Overdue</span>
            )}

            <button
              className="btn-done-fresh"
              onClick={(e) => {
                e.stopPropagation();
                markDone();
              }}
            >
              ✓ Done
            </button>
            <button
              className="btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                removeTask();
              }}
            >
              🗑
            </button>
            <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {expanded && (
          <div className="task-details" onClick={(e) => e.stopPropagation()}>
            {task.lastCompleted && (
              <p className="detail-line">
                <span className="detail-label">Last done:</span>
                {new Date(task.lastCompleted).toLocaleDateString()}{' '}
                {task.lastCompletedByName && ` by ${task.lastCompletedByName}`}
              </p>
            )}
            {nextDue && task.frequency !== 'once' && (
              <p className="detail-line">
                <span className="detail-label">Next due:</span>
                {nextDue.toLocaleDateString()}
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
                        {new Date(h.completedAt).toLocaleDateString()} —{' '}
                        {h.completedByName || 'Unknown'}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskItem;
