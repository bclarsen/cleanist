import { useEffect, useMemo, useState } from 'react';
import { Award, Check, Medal, Trophy } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { formatCompletedAt, isOverdue } from '../utils/dateHelpers';

// Gold / silver / bronze for the top three finishers
const PODIUM = [
  { Icon: Trophy, color: '#d4a017', label: '1st place' },
  { Icon: Medal, color: '#9ca3af', label: '2nd place' },
  { Icon: Award, color: '#b07d4a', label: '3rd place' },
];

function StatsPanel({ tasks, currentUser, workspace }) {
  const [historyEntries, setHistoryEntries] = useState([]);

  useEffect(() => {
    const historyQuery = workspace === 'personal'
      ? query(
          collection(db, 'taskHistory'),
          where('workspace', '==', 'personal'),
          where('ownerUid', '==', currentUser.uid),
        )
      : query(collection(db, 'taskHistory'), where('workspace', '==', workspace));

    return onSnapshot(
      historyQuery,
      (snapshot) => setHistoryEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error('Error loading activity history:', error),
    );
  }, [currentUser.uid, workspace]);

  const totalTasks = tasks.length;
  const totalCompletions = tasks.reduce((sum, t) => sum + (t.completionHistory?.length || 0), 0);

  // Completions per person
  const byPerson = {};
  tasks.forEach(task => {
    (task.completionHistory || []).forEach(h => {
      const key = h.completedBy;
      if (!byPerson[key]) byPerson[key] = { name: h.completedByName || "Unknown", count: 0 };
      byPerson[key].count++;
    });
  });

  // Completions per room
  const byRoom = {};
  tasks.forEach(task => {
    const room = task.room || "Other";
    if (!byRoom[room]) byRoom[room] = { total: 0, completions: 0 };
    byRoom[room].total++;
    byRoom[room].completions += (task.completionHistory?.length || 0);
  });

  // Combine the permanent History records with task-embedded records created
  // before History existed. New records appear in both places, so deduplicate
  // by task and completion time.
  const allCompletionEntries = useMemo(() => {
    const storedKeys = new Set(
      historyEntries.map((entry) => `${entry.taskId}:${entry.completedAt}`),
    );
    const legacyEntries = tasks.flatMap((task) =>
      (task.completionHistory || [])
        .filter((entry) => !storedKeys.has(`${task.id}:${entry.completedAt}`))
        .map((entry, index) => ({
          ...entry,
          id: `legacy-${task.id}-${entry.completedAt}-${index}`,
          taskName: task.name,
          room: task.room || 'Other',
        })),
    );
    return [...historyEntries, ...legacyEntries];
  }, [historyEntries, tasks]);

  // Recent Activity intentionally remains a rolling seven-day view even
  // though its source records are kept permanently by History.
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCompletions = allCompletionEntries
    .filter((entry) => entry.completedAt > sevenDaysAgo)
    .sort((a, b) => b.completedAt - a.completedAt);

  // Overdue count
  const overdueCount = tasks.filter(isOverdue).length;


  const sortedPeople = Object.entries(byPerson).sort((a, b) => b[1].count - a[1].count);
  const maxCount = sortedPeople[0]?.[1].count || 1;

  return (
    <div className="stats-panel">
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-number">{totalTasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{totalCompletions}</div>
          <div className="stat-label">Total Completions</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{recentCompletions.length}</div>
          <div className="stat-label">Done This Week</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-number">{overdueCount}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div className="stats-grid">
        <section className="stats-section">
          <h3>
            Leaderboard
            <Trophy size={16} strokeWidth={2} className="section-title-icon" />
          </h3>
          {sortedPeople.length === 0 ? (
            <p className="empty-note">No completions yet — get cleaning!</p>
          ) : (
            <ul className="leaderboard">
              {sortedPeople.map(([uid, data], i) => {
                const podium = PODIUM[i];
                const PodiumIcon = podium?.Icon;
                return (
                  <li key={uid} className="leaderboard-item">
                    <span className="rank">
                      {PodiumIcon ? (
                        <PodiumIcon
                          size={17}
                          strokeWidth={2}
                          color={podium.color}
                          aria-label={podium.label}
                        />
                      ) : (
                        `#${i + 1}`
                      )}
                    </span>
                    <span className="lb-name">{data.name}{uid === currentUser.uid ? " (you)" : ""}</span>
                    <div className="lb-bar-wrap">
                      <div className="lb-bar" style={{ width: `${(data.count / maxCount) * 100}%` }} />
                    </div>
                    <span className="lb-count">{data.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="stats-section">
          <h3>By Room</h3>
          <table className="room-table">
            <thead>
            <tr><th>Room</th><th>Tasks</th><th>Completions</th></tr>
            </thead>
            <tbody>
            {Object.entries(byRoom).map(([room, data]) => (
              <tr key={room}>
                <td>{room}</td>
                <td>{data.total}</td>
                <td>{data.completions}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="stats-section">
        <h3>Recent Activity (last 7 days)</h3>
        {recentCompletions.length === 0 ? (
          <p className="empty-note">Nothing completed in the last 7 days.</p>
        ) : (
          <ul className="activity-feed">
            {recentCompletions.slice(0, 20).map((h) => (
              <li key={h.id} className="activity-item">
                <span className="activity-dot">
                  <Check size={14} strokeWidth={3} />
                </span>
                <div>
                  <strong>{h.taskName}</strong>
                  <span className="activity-meta"> · {h.room} · {h.completedByName} · {formatCompletedAt(h.completedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default StatsPanel;
