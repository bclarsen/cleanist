import { useState, useEffect } from 'react';
import { isOverdue } from './utils/dateHelpers';
import { getWorkspaceDocId } from "./utils/workspaceHelpers.js";
import { useClickOutside } from './hooks/useClickOutside';
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  arrayUnion,
  getDocs,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import Inventory from './components/Inventory';
import Login from './components/Login';
import Header from './components/Header';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import StatsPanel from './components/StatsPanel';
import LivingSpace from './components/LivingSpace';
import ProfileSetup from './components/ProfileSetup';
import Sidebar from './components/Sidebar';
import UserProfile from './components/UserProfile';
import Preferences from './components/Preferences';
import InviteBanner from './components/InviteBanner';


const tasksRef = collection(db, 'tasks');
const invitesRef = collection(db, 'teamInvites');
const teamsRef = collection(db, 'teams');

const DEFAULT_ROOMS = ['Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Other'];
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
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterDate, setFilterDate] = useState('All');
  const [activeTab, setActiveTab] = useState('tasks');
  const [usersMap, setUsersMap] = useState({});

  const [workspace, setWorkspace] = useState('personal');
  const [teams, setTeams] = useState([{id: 'personal', name: 'Personal'}]);

  // New: filter menu UI state
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedFilterType, setExpandedFilterType] = useState(null);
  const filterMenuRef = useClickOutside(() => setShowFilterMenu(false));

  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  useEffect(() => {
    if (!user || !workspace) return;
    const q = workspace === 'personal'
        ? query(tasksRef, where('workspace', '==', 'personal'), where('ownerUid', '==', user.uid))
        : query(tasksRef, where('workspace', '==', workspace));

    const unsub = onSnapshot(
        q,
        (snapshot) => setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error('Error fetching tasks:', err)
    );
    return unsub;
  }, [user, workspace]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check if the user has already completed their profile setup
        const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const profileComplete = userDocSnap.exists() && userDocSnap.data().profileComplete;

        if (!profileComplete) {
          // First time: show profile setup before entering the app
          setUser(currentUser);
          setNeedsProfileSetup(true);
          setAuthLoading(false);
          return;
        }

        // Returning user: refresh email/photo in case they changed
        await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              email: currentUser.email,
              photoURL: currentUser.photoURL,
            },
            {merge: true},
        );
      }
      setUser(currentUser);
      setNeedsProfileSetup(false);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(teamsRef, where('members', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedTeams = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setTeams([{id: 'personal', name: 'Personal'}, ...fetchedTeams]);
    });
    return unsub;
  }, [user]);



  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(tasksRef, (snapshot) => {
      setTasks(snapshot.docs.map((d) => ({id: d.id, ...d.data()})));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user || !workspace || workspace === 'personal') {
      setTeamMembers([]);
      return;
    }
    const q = query(invitesRef, where('teamId', '==', workspace));
    const unsub = onSnapshot(
        q,
        (snapshot) => setTeamMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error('Error fetching invites:', err)
    );
    return unsub;
  }, [user, workspace]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map = {};
      snapshot.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setUsersMap(map);
    });
    return unsub;
  }, []);

  if (authLoading) return <div>Loading...</div>;
  if (!user) return <Login/>;
  if (needsProfileSetup) return (
      <ProfileSetup
          user={user}
          onComplete={(displayName) => {
            // Update the local user object's displayName so the rest of the app sees it immediately
            setUser((prev) => ({...prev, displayName}));
            setNeedsProfileSetup(false);
          }}
      />
  );

  const activeTeam = teams.find((t) => t.id === workspace);

  const myPendingInvites = teamMembers.filter(
      (inv) => inv.inviteeEmail === user.email?.toLowerCase() && inv.status === 'pending'
  );

  const allAssignees = [];
  if (workspace === 'personal') {
    allAssignees.push({
      uid: user.uid,
      name: user.displayName || 'You',
      photoURL: user.photoURL,
      email: user.email,
    });
  } else if (activeTeam) {
    // Add active members from the current team
    (activeTeam.members || []).forEach((uid) => {
      const u = usersMap[uid];
      allAssignees.push({
        uid: uid,
        name: u?.displayName || (uid === user.uid ? (user.displayName || 'You') : u?.email || 'Unknown Roommate'),
        photoURL: u?.photoURL,
        email: u?.email,
      });
    });

    // Add pending invites for the current team
    const pendingInvites = teamMembers.filter(
        (m) => m.teamId === workspace && m.status === 'pending'
    );
    pendingInvites.forEach((invite) => {
      const isAlreadyMember = allAssignees.some((a) => a.email === invite.inviteeEmail || a.uid === invite.inviteeEmail);
      if (!isAlreadyMember) {
        allAssignees.push({
          uid: invite.inviteeEmail,
          name: invite.inviteeName || invite.inviteeEmail,
          isPending: true,
        });
      }
    });
  }

  const handleAcceptInvite = async (invite) => {
    try {
      await updateDoc(doc(db, 'teams', invite.teamId), {
        members: arrayUnion(user.uid),
      });
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'accepted',
      });
      setWorkspace(invite.teamId);
    } catch (err) {
      console.error('Error accepting invite:', err);
    }
  };

  const handleDeclineInvite = async (invite) => {
    try {
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'declined',
      });
    } catch (err) {
      console.error('Error declining invite:', err);
    }
  };

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

  const workspaceTasks = filteredTasks.filter((t) => {
    if (workspace === 'personal') {
      return (t.workspace === 'personal' || !t.workspace) && t.ownerUid === user.uid;
    }
    return t.workspace === workspace;
  });

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
      <div className="app-shell">
        <Sidebar user={user} activeTab={activeTab} setActiveTab={setActiveTab}/>
        <div className="main-area">
          <Header
              user={user}
              usersMap={usersMap}
              workspace={workspace}
              setWorkspace={setWorkspace}
              teams={teams}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
          />

          {myPendingInvites.map((invite) => (
              <InviteBanner
                  key={invite.id}
                  invite={invite}
                  inviterName={usersMap[invite.inviterUid]?.displayName || 'Someone'}
                  onAccept={() => handleAcceptInvite(invite)}
                  onDecline={() => handleDeclineInvite(invite)}
              />
          ))}

          {activeTab !== 'profile' && activeTab !== 'preferences' && (
          <div className="workspace-banner">
            <div className="workspace-details">
              <span className="workspace-label">Workspace</span>
              <h2 className="workspace-title-text">
                {workspace === 'personal' ? '🏠 Personal Tasks' : `👥 ${activeTeam?.name || 'Loading Team...'}`}
              </h2>
            </div>

            {workspace !== 'personal' && allAssignees.length > 0 && (
                <div className="workspace-members">
                  <span className="members-label">Roommates:</span>
                  <div className="members-list">
                    {allAssignees.map((assignee) => (
                        <div
                            key={assignee.uid}
                            className={`member-avatar-chip ${assignee.isPending ? 'pending' : ''}`}
                            title={`${assignee.name}${assignee.isPending ? ' (Pending Invite)' : ''}`}
                        >
                          {assignee.photoURL ? (
                              <img src={assignee.photoURL} alt="" className="avatar-sm"/>
                          ) : (
                              <div className="avatar-sm placeholder">
                                {assignee.name?.[0] || '?'}
                              </div>
                          )}
                          <span className="member-name-tag">
                    {assignee.name}
                  </span>
                          {assignee.isPending && <span className="pending-indicator">Pending</span>}
                        </div>
                    ))}
                  </div>
                </div>
            )}
          </div>
          )}

          <main className="app-content">
            {activeTab === 'profile' && <UserProfile user={user} />}
            {activeTab === 'preferences' && <Preferences user={user} />}
            {activeTab === 'tasks' && (
                <>
                  <TaskForm
                      user={user}
                      allAssignees={allAssignees}
                      workspace={workspace}
                      rooms={rooms}
                  />

                  <div className="filters" style={{padding: '20px 24px 16px'}}>
                    <div style={{position: 'relative', display: 'inline-block'}} ref={filterMenuRef}>
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
                                    style={{width: '100%', marginBottom: '8px'}}
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
                                    style={{width: '100%', marginBottom: '8px'}}
                                >
                                  <option value="All">All</option>
                                  {rooms.map((room) => (
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
                                    style={{width: '100%', marginBottom: '8px'}}
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
                                    style={{width: '100%', marginBottom: '8px'}}
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
                                    style={{width: '100%', marginTop: '4px'}}
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

            {activeTab === 'inventory' && (
                <Inventory user={user} workspace={workspace}/>
            )}

            {activeTab === 'living-space' && (
                <LivingSpace rooms={rooms} workspace={getWorkspaceDocId(workspace, user.uid)} />
            )}

            {activeTab === 'stats' && (
                <StatsPanel
                    tasks={tasks}
                    currentUser={user}
                />
            )}
          </main>
        </div>
      </div>
  );
}

export default App;
