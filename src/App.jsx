import { useState, useEffect } from 'react';
import { isOverdue } from './utils/dateHelpers';
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
  getDocs,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import Login from './components/Login';
import Header from './components/Header';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import StatsPanel from './components/StatsPanel';

const tasksRef = collection(db, 'tasks');
const invitesRef = collection(db, 'teamInvites');

const FILTER_ROOMS = ['Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Other'];
const FILTER_PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const FILTER_DATE_OPTIONS = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'week', label: 'Due This Week' },
  { value: 'none', label: 'No Due Date' },
];

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterDate, setFilterDate] = useState('All');
  const [activeTab, setActiveTab] = useState('tasks');

  const [workspace, setWorkspace] = useState('personal');

  // New: filter menu UI state
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedFilterType, setExpandedFilterType] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.email) return;

    const acceptInvites = async () => {
      const q = query(
        invitesRef,
        where('inviteeEmail', '==', user.email.toLowerCase()),
        where('status', '==', 'pending'),
      );
      const snapshot = await getDocs(q);

      for (const inviteDoc of snapshot.docs) {
        const invite = inviteDoc.data();
        try {
          await updateDoc(doc(db, 'teams', invite.teamId), {
            members: arrayUnion(user.uid),
          });
          await updateDoc(doc(db, 'teamInvites', inviteDoc.id), {
            status: 'accepted',
          });
        } catch (err) {
          console.error('Error accepting invite:', invite, err);
        }
      }
    };

    acceptInvites();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(tasksRef, (snapshot) => {
      setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(invitesRef, (snapshot) => {
      setTeamMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  if (authLoading) return <div>Loading...</div>;
  if (!user) return <Login />;

  const allAssignees = [
    { uid: user.uid, name: user.displayName || 'You' },
    ...teamMembers.map((m) => ({
      uid: m.inviteeEmail,
      name: m.inviteeName || m.inviteeEmail,
    })),
  ];

  let filteredTasks = tasks;
  if (filterRoom !== 'All')
    filteredTasks = filteredTasks.filter((t) => t.room === filterRoom);
  if (filterPriority !== 'All')
    filteredTasks = filteredTasks.filter((t) => t.priority === filterPriority);
  if (filterAssignee !== 'All')
    filteredTasks = filteredTasks.filter(
      (t) => t.assignedTo === filterAssignee,
    );
  if (filterDate !== 'All') {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(
      startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    filteredTasks = filteredTasks.filter((t) => {
      if (filterDate === 'none') return !t.dueDate;
      if (filterDate === 'overdue') return isOverdue(t);
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      if (filterDate === 'today')
        return due >= startOfToday && due < endOfToday;
      if (filterDate === 'week') return due >= startOfToday && due < endOfWeek;
      return true;
    });
  }

  const workspaceTasks = filteredTasks.filter(
    (t) =>
      t.workspace === workspace || (workspace === 'personal' && !t.workspace),
  );

  const activeFilterCount = [
    filterDate !== 'All',
    filterRoom !== 'All',
    filterAssignee !== 'All',
    filterPriority !== 'All',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterDate('All');
    setFilterRoom('All');
    setFilterAssignee('All');
    setFilterPriority('All');
    setExpandedFilterType(null);
  };

  const toggleFilterType = (type) => {
    setExpandedFilterType(expandedFilterType === type ? null : type);
  };

  return (
    <div className="app">
      <Header
        user={user}
        teamMembers={teamMembers}
        allAssignees={allAssignees}
        workspace={workspace}
        setWorkspace={setWorkspace}
      />

      <nav className="tab-nav">
        <button
          className={activeTab === 'tasks' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={activeTab === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('stats')}
        >
          Stats & History
        </button>
      </nav>

      {activeTab === 'tasks' && (
        <>
          <TaskForm
            user={user}
            allAssignees={allAssignees}
            workspace={workspace}
          />

          <div className="filters" style={{ padding: '20px 24px 16px' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                className="btn-pill-outline"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
              >
                Filter by {activeFilterCount > 0 && `(${activeFilterCount})`}
              </button>

              {showFilterMenu && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 'calc(100% + 6px)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    minWidth: '220px',
                    zIndex: 20,
                    padding: '8px',
                  }}
                >
                  {/* Date */}
                  <button
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 600,
                    }}
                    onClick={() => toggleFilterType('date')}
                  >
                    Date {filterDate !== 'All' && `— ${filterDate}`}
                  </button>
                  {expandedFilterType === 'date' && (
                    <select
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      style={{ width: '100%', marginBottom: '8px' }}
                    >
                      <option value="All">All</option>
                      {FILTER_DATE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Area */}
                  <button
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 600,
                    }}
                    onClick={() => toggleFilterType('area')}
                  >
                    Area {filterRoom !== 'All' && `— ${filterRoom}`}
                  </button>
                  {expandedFilterType === 'area' && (
                    <select
                      value={filterRoom}
                      onChange={(e) => setFilterRoom(e.target.value)}
                      style={{ width: '100%', marginBottom: '8px' }}
                    >
                      <option value="All">All</option>
                      {FILTER_ROOMS.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Assigned To */}
                  <button
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 600,
                    }}
                    onClick={() => toggleFilterType('assignee')}
                  >
                    Assigned To{' '}
                    {filterAssignee !== 'All' &&
                      `— ${allAssignees.find((a) => a.uid === filterAssignee)?.name || filterAssignee}`}
                  </button>
                  {expandedFilterType === 'assignee' && (
                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      style={{ width: '100%', marginBottom: '8px' }}
                    >
                      <option value="All">All</option>
                      {allAssignees.map((a) => (
                        <option key={a.uid} value={a.uid}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Priority */}
                  <button
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 600,
                    }}
                    onClick={() => toggleFilterType('priority')}
                  >
                    Priority {filterPriority !== 'All' && `— ${filterPriority}`}
                  </button>
                  {expandedFilterType === 'priority' && (
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      style={{ width: '100%', marginBottom: '8px' }}
                    >
                      <option value="All">All</option>
                      {FILTER_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {activeFilterCount > 0 && (
                    <button
                      className="btn-ghost"
                      style={{ width: '100%', marginTop: '4px' }}
                      onClick={clearAllFilters}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <TaskList
            tasks={workspaceTasks}
            currentUser={user}
            allAssignees={allAssignees}
          />
        </>
      )}

      {activeTab === 'stats' && (
        <StatsPanel
          tasks={tasks}
          allAssignees={allAssignees}
          currentUser={user}
        />
      )}
    </div>
  );
}

export default App;
