import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { formatCompletedAt, formatDueDate } from '../utils/dateHelpers';

function History({ user, workspace, tasks = [] }) {
  const [storedEntries, setStoredEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const historyQuery = workspace === 'personal'
      ? query(
          collection(db, 'taskHistory'),
          where('workspace', '==', 'personal'),
          where('ownerUid', '==', user.uid),
        )
      : query(collection(db, 'taskHistory'), where('workspace', '==', workspace));

    return onSnapshot(
      historyQuery,
      (snapshot) => {
        setStoredEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Error loading task history:', snapshotError);
        setError('Could not load the task history. Please try again.');
        setLoading(false);
      },
    );
  }, [user.uid, workspace]);

  // Existing task documents already have their own completion arrays. Include
  // those records too, so History can show completions made before this page was
  // introduced. Newer completions are deduplicated against taskHistory.
  const entries = useMemo(() => {
    const storedKeys = new Set(
      storedEntries.map((entry) => `${entry.taskId}:${entry.completedAt}`),
    );
    const legacyEntries = tasks.flatMap((task) =>
      (task.completionHistory || [])
        .filter((entry) => !storedKeys.has(`${task.id}:${entry.completedAt}`))
        .map((entry, index) => ({
          ...entry,
          id: `legacy-${task.id}-${entry.completedAt}-${index}`,
          taskId: task.id,
          taskName: task.name,
          room: task.room || 'Other',
          frequency: task.frequency || 'once',
        })),
    );
    return [...storedEntries, ...legacyEntries].sort(
      (a, b) => b.completedAt - a.completedAt,
    );
  }, [storedEntries, tasks]);

  return (
    <div className="settings-panel">
      <div className="settings-panel-heading">
        <h2>History</h2>
        <p className="history-page-description">
          Every task completed in this workspace, including tasks that have since been deleted.
        </p>
      </div>

      <div className="task-item settings-card history-settings-card">
        {loading ? (
          <p className="settings-card-note">Loading completed tasks…</p>
        ) : error ? (
          <p className="profile-setup-error">{error}</p>
        ) : entries.length === 0 ? (
          <div className="settings-empty-scope">
            <CheckCircle2 size={30} strokeWidth={1.8} />
            <p>No completed tasks in this workspace yet.</p>
          </div>
        ) : (
          <ol className="workspace-history-list">
            {entries.map((entry) => (
              <li key={entry.id} className="workspace-history-entry">
                <div className="workspace-history-icon"><CheckCircle2 size={18} /></div>
                <div className="workspace-history-content">
                  <strong>{entry.taskName || 'Untitled task'}</strong>
                  <span>{entry.room || 'Other'} · {entry.frequency || 'One-time'}</span>
                  <span>Completed by {entry.completedByName || 'Unknown'} · {formatCompletedAt(entry.completedAt)}</span>
                  {entry.dueAt && (
                    <span className={entry.wasLate ? 'history-late' : 'workspace-history-on-time'}>
                      <Clock size={13} />
                      {entry.wasLate ? `Completed late (due ${formatDueDate(entry.dueAt)})` : `Completed on time (due ${formatDueDate(entry.dueAt)})`}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default History;
