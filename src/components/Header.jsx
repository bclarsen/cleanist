import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  arrayRemove
} from 'firebase/firestore';

const teamsRef = collection(db, 'teams');
const invitesRef = collection(db, 'teamInvites');

function Header({ user, usersMap, workspace, setWorkspace, teams }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null);

  const [isNamingTeam, setIsNamingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const handleWorkspaceChange = (teamId) => {
    setWorkspace(teamId);
    setShowManageMenu(false);
    setShowAddMembers(false);
    setInviteStatus(null);
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

  const handleRemoveMember = async (uid) => {
    if (!currentTeam || uid === user.uid) return; // can't remove yourself here
    try {
      await updateDoc(doc(db, 'teams', workspace), {
        members: arrayRemove(uid),
      });
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleLeaveTeam = async () => {
    if (workspace === 'personal' || !currentTeam) return;
    if (isCreator) return; // creators use Delete Team instead

    const confirmed = window.confirm(`Leave "${currentTeam.name}"?`);
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'teams', workspace), {
        members: arrayRemove(user.uid),
      });
      setWorkspace('personal');
      setShowManageMenu(false);
    } catch (err) {
      console.error('Error leaving team:', err);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || workspace === 'personal') return;
    if (!currentTeam) return;

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    const alreadyMember = (currentTeam.members || []).some(
        (uid) => usersMap[uid]?.email?.toLowerCase() === normalizedEmail
    );

    if (alreadyMember) {
      setInviteStatus({
        type: 'error',
        message: 'This person is already on the team.',
      });
      return;
    }

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
        <div className="header-actions">
          <button
            className="btn-pill-outline"
            onClick={() => setShowInvite(!showInvite)}
          >
            Teams
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
                  onClick={() => handleWorkspaceChange(team.id)}
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
                      Team members
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

                    {!isCreator && (
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
                            onClick={handleLeaveTeam}
                        >
                          Leave team
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
              <div style={{ marginTop: '15px' }}>
                <ul className="team-list">
                  {(currentTeam?.members || []).map((uid) => {
                    const member = usersMap[uid];
                    return (
                        <li key={uid} className="team-member">
                          {member?.displayName || (uid === user.uid ? (user.displayName || 'You') : uid)}
                          {isCreator && uid !== user.uid && (
                              <button
                                  className="btn-delete"
                                  title="Remove member"
                                  onClick={() => handleRemoveMember(uid)}
                              >
                                ✕
                              </button>
                          )}
                        </li>
                    );
                  })}
                </ul>

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