import { useState, useEffect, useRef } from 'react';
import { Home, Users } from 'lucide-react';
import { isOverdue, parseDueDate, resolveCompletedWindowMs } from './utils/dateHelpers';
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
import History from './components/History';
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
  const [workspaceInvites, setWorkspaceInvites] = useState([]);
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterDate, setFilterDate] = useState('All');
  const [activeTab, setActiveTab] = useState('tasks');
  const [usersMap, setUsersMap] = useState({});

  const [workspace, setWorkspace] = useState('personal');
  const [teams, setTeams] = useState([{id: 'personal', name: 'Personal'}]);
  const [myInvites, setMyInvites] = useState([]);
  // Applied once per sign-in: after that the user's own workspace switches win.
  const appliedDefaultWorkspace = useRef(false);
  // Read from the user doc at sign-in, consumed by the teams listener below.
  const defaultWorkspaceRef = useRef(null);

  // New: filter menu UI state
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedFilterType, setExpandedFilterType] = useState(null);
  const filterMenuRef = useClickOutside(() => setShowFilterMenu(false));

  // Rooms live on the workspace doc. Tagged with the workspace they came from so
  // switching workspaces falls back to the defaults instead of briefly showing
  // the previous workspace's rooms while the new snapshot is in flight.
  const [storedRooms, setStoredRooms] = useState(null);
  const workspaceDocId = user ? getWorkspaceDocId(workspace, user.uid) : null;

  useEffect(() => {
    if (!workspaceDocId) return;
    const unsub = onSnapshot(
        doc(db, 'workspaces', workspaceDocId),
        (snap) => setStoredRooms({ id: workspaceDocId, rooms: snap.data()?.rooms }),
        (err) => console.error('Error fetching rooms:', err)
    );
    return unsub;
  }, [workspaceDocId]);

  // Fall back to the defaults when the workspace doc doesn't exist yet or was
  // emptied, so the room picker is never blank.
  const rooms = storedRooms?.id === workspaceDocId && storedRooms.rooms?.length
      ? storedRooms.rooms
      : DEFAULT_ROOMS;

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
        defaultWorkspaceRef.current =
            userDocSnap.data()?.preferences?.defaultWorkspace ?? null;

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

      // Open the user's preferred workspace, once per sign-in. Applied here because
      // it needs the team list: a stale preference (a team since left or deleted)
      // must be ignored rather than selecting a workspace the user can't read.
      if (!appliedDefaultWorkspace.current) {
        appliedDefaultWorkspace.current = true;
        const preferred = defaultWorkspaceRef.current;
        if (preferred && preferred !== 'personal'
            && fetchedTeams.some((t) => t.id === preferred)) {
          setWorkspace(preferred);
        }
      }
    });
    return () => {
      unsub();
      // Next sign-in should apply the preference again.
      appliedDefaultWorkspace.current = false;
    };
  }, [user]);



  // Every invite belonging to the active team, whatever its status — used to show
  // roommates who've been invited but haven't accepted yet alongside real members.
  useEffect(() => {
    if (!user || !workspace || workspace === 'personal') {
      setWorkspaceInvites([]);
      return;
    }
    const q = query(invitesRef, where('teamId', '==', workspace));
    const unsub = onSnapshot(
        q,
        (snapshot) => setWorkspaceInvites(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error('Error fetching invites:', err)
    );
    return unsub;
  }, [user, workspace]);

  // Invites addressed to me, regardless of which workspace I'm viewing.
  // Must stay separate from the workspace-scoped listener above: you aren't a
  // member of the inviting team yet, so it can't surface your own invites.
  useEffect(() => {
    if (!user?.email) return;
    const q = query(
        invitesRef,
        where('inviteeEmail', '==', user.email.toLowerCase()),
        where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(
        q,
        (snapshot) => setMyInvites(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error('Error fetching my invites:', err)
    );
    return unsub;
  }, [user]);

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

  // Your own window wins; otherwise fall back to the team's shared setting.
  const completedWindowMs = resolveCompletedWindowMs(
      usersMap[user.uid]?.preferences?.completedWindowMs,
      activeTeam?.preferences?.completedWindowMs,
  );

  const myPendingInvites = myInvites;

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
    const pendingInvites = workspaceInvites.filter(
        (m) => m.teamId === workspace && m.status === 'pending'
    );
    pendingInvites.forEach((invite) => {
      // inviteeEmail is stored lowercased; member emails come from auth as-is
      const inviteeEmail = invite.inviteeEmail?.toLowerCase();
      const isAlreadyMember = allAssignees.some(
          (a) => a.email?.toLowerCase() === inviteeEmail || a.uid === invite.inviteeEmail
      );
      if (!isAlreadyMember) {
        allAssignees.push({
          uid: invite.inviteeEmail,
          name: invite.inviteeEmail,
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
      const due = parseDueDate(t.dueDate);
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

          {activeTab !== 'profile' && activeTab !== 'preferences' && activeTab !== 'history' && (
          <div className="workspace-banner">
            <div className="workspace-details">
              <span className="workspace-label">Workspace</span>
              <h2 className="workspace-title-text">
                {workspace === 'personal' ? (
                    <>
                      <Home size={19} strokeWidth={2}/>
                      Personal Tasks
                    </>
                ) : (
                    <>
                      <Users size={19} strokeWidth={2}/>
                      {activeTeam?.name || 'Loading Team...'}
                    </>
                )}
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
            {activeTab === 'profile' && (
                <UserProfile
                    user={user}
                    profile={usersMap[user.uid]}
                    onProfileSave={(displayName) =>
                        // Mirror ProfileSetup: keep the local auth user in step so the
                        // sidebar and task attribution update without a reload.
                        setUser((prev) => ({ ...prev, displayName }))
                    }
                />
            )}
            {activeTab === 'preferences' && (
                <Preferences
                    user={user}
                    profile={usersMap[user.uid]}
                    teams={teams}
                    workspace={workspace}
                />
            )}
            {activeTab === 'history' && (
                <History user={user} workspace={workspace} tasks={tasks} />
            )}
            {activeTab === 'tasks' && (
                <>
                  <TaskForm
                      user={user}
                      allAssignees={allAssignees}
                      workspace={workspace}
                      rooms={rooms}
                      autoAssign={activeTeam?.preferences?.autoAssign}
                      tasks={tasks}
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
                      completedWindowMs={completedWindowMs}
                  />
                </>
            )}

            {activeTab === 'inventory' && (
                <Inventory user={user} workspace={workspace}/>
            )}

            {activeTab === 'living-space' && (
                <LivingSpace rooms={rooms} workspace={workspaceDocId} />
            )}

            {activeTab === 'stats' && (
                <StatsPanel
                    tasks={tasks}
                    currentUser={user}
                    workspace={workspace}
                />
            )}
          </main>
        </div>
      </div>
  );
}

export default App;
