import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

const teamsRef = collection(db, 'teams');
const invitesRef = collection(db, 'teamInvites');

function Header({ user, teamMembers, allAssignees, workspace, setWorkspace }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null);

  const [teams, setTeams] = useState([{ id: 'personal', name: 'Personal' }]);
  const [isNamingTeam, setIsNamingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(teamsRef, where('members', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedTeams = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setTeams([{ id: 'personal', name: 'Personal' }, ...fetchedTeams]);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    setShowManageMenu(false);
    setShowAddMembers(false);
    setInviteStatus(null);
  }, [workspace]);

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const currentTeam = teams.find((t) => t.id === workspace);
  const isCreator = currentTeam?.createdBy === user.uid;

  const handleAddTeam = async () => {
    if (!newTeamName.trim() || teams.length >= 5) return;
    const docRef = await addDoc(teamsRef, {
      name: newTeamName.trim(),
      members: [user.uid],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    setWorkspace(docRef.id);
    setNewTeamName('');
    setIsNamingTeam(false);
  };

  const handleCancelAddTeam = () => {
    setNewTeamName('');
    setIsNamingTeam(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || workspace === 'personal') return;
    if (!currentTeam) return;

    try {
      await addDoc(invitesRef, {
        teamId: workspace,
        teamName: currentTeam.name,
        inviterUid: user.uid,
        inviteeEmail: inviteEmail.trim().toLowerCase(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setInviteStatus({
        type: 'success',
        message: `Invite sent to ${inviteEmail}`,
      });
      setInviteEmail('');
    } catch (err) {
      console.error('Invite error:', err);
      setInviteStatus({
        type: 'error',
        message: 'Could not send invite. Try again.',
      });
    }
  };

  const handleCancelInvite = () => {
    setShowAddMembers(false);
    setInviteEmail('');
    setInviteStatus(null);
  };

  const handleDeleteTeam = async () => {
    if (workspace === 'personal' || !currentTeam) return;
    if (!isCreator) return; // client-side guard; Firestore rules enforce the real check

    const confirmed = window.confirm(
      `Delete "${currentTeam.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'teams', workspace));
      setWorkspace('personal');
      setShowManageMenu(false);
    } catch (err) {
      console.error('Delete team error:', err);
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-title">
          <span className="header-emoji">🧹</span>
          <h1>Cleanist</h1>
        </div>
        <div className="header-actions">
          <button
            className="btn-pill-outline"
            onClick={() => setShowInvite(!showInvite)}
          >
            Teams
          </button>
          <button className="btn-pill-outline" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </header>

      {showInvite && (
        <div className="team-dropdown">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '15px',
              gap: '8px',
            }}
          >
            <div
              className="workspace-toggle"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
            >
              {teams.map((team) => (
                <button
                  key={team.id}
                  className={
                    workspace === team.id ? 'btn-primary' : 'btn-ghost'
                  }
                  onClick={() => setWorkspace(team.id)}
                >
                  {team.name}
                </button>
              ))}

              {teams.length < 5 && !isNamingTeam && (
                <button
                  className="btn-ghost"
                  onClick={() => setIsNamingTeam(true)}
                >
                  +
                </button>
              )}
            </div>

            {workspace !== 'personal' && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  className="btn-pill-outline"
                  onClick={() => setShowManageMenu(!showManageMenu)}
                >
                  Manage Team
                </button>

                {showManageMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      minWidth: '160px',
                      zIndex: 20,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        border: 'none',
                        background: 'transparent',
                      }}
                      onClick={() => {
                        setShowAddMembers(true);
                        setShowManageMenu(false);
                      }}
                    >
                      Add members
                    </button>
                    {isCreator && (
                      <button
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--priority-high, #b45309)',
                        }}
                        onClick={handleDeleteTeam}
                      >
                        Delete team
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isNamingTeam && (
            <div className="create-team-form" style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="New Team Name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <button className="btn-primary" onClick={handleAddTeam}>
                Create
              </button>
              <button className="btn-ghost" onClick={handleCancelAddTeam}>
                Cancel
              </button>
            </div>
          )}

          {showAddMembers && workspace !== 'personal' && (
            <div
              className="invite-form"
              style={{
                marginTop: '15px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <input
                type="email"
                placeholder="Roommate's email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <button className="btn-primary" onClick={handleInvite}>
                Invite
              </button>
              <button className="btn-ghost" onClick={handleCancelInvite}>
                Cancel
              </button>
              {inviteStatus && (
                <p
                  className={
                    inviteStatus.type === 'success'
                      ? 'status-success'
                      : 'status-error'
                  }
                  style={{ margin: 0 }}
                >
                  {inviteStatus.message}
                </p>
              )}
            </div>
          )}

          <ul className="team-list">
            {/* Optional: render pending invites for this team here later */}
          </ul>
        </div>
      )}
    </>
  );
}

export default Header;