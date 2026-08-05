import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useClickOutside } from '../hooks/useClickOutside';
import { SETTINGS_PAGES } from '../constants/settings';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  arrayRemove,
  getDocs,
  query,
  where
} from 'firebase/firestore';

const teamsRef = collection(db, 'teams');
const invitesRef = collection(db, 'teamInvites');

function Header({ user, usersMap, workspace, setWorkspace, teams, activeTab, setActiveTab }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null);

  const [isNamingTeam, setIsNamingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const containerRef = useClickOutside(() => setShowInvite(false));
  const manageMenuRef = useClickOutside(() => setShowManageMenu(false));
  const settingsMenuRef = useClickOutside(() => setShowSettingsMenu(false));

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
      // Don't stack duplicate invites — they'd render as repeated banners
      const existing = await getDocs(query(
          invitesRef,
          where('teamId', '==', workspace),
          where('inviteeEmail', '==', normalizedEmail),
          where('status', '==', 'pending'),
      ));
      if (!existing.empty) {
        setInviteStatus({
          type: 'error',
          message: 'This person already has a pending invite.',
        });
        return;
      }

      await addDoc(invitesRef, {
        teamId: workspace,
        teamName: currentTeam.name,
        inviterUid: user.uid,
        inviteeEmail: normalizedEmail,
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
      <div ref={containerRef}>
      <header className="flex justify-between items-center px-6 py-3.5 sticky top-0 z-10 bg-white/75 backdrop-blur-[14px] border-b border-[rgba(196,232,224,0.7)] transition-shadow hover:shadow-[0_2px_20px_rgba(16,185,129,0.06)] dark:bg-[rgba(13,17,23,0.92)] dark:border-b-[rgba(33,38,45,0.95)]">
        <div className="flex items-center gap-2.5 flex-wrap max-sm:gap-2">
          <button
              className="flex items-center gap-1.5 bg-white/70 border border-[var(--border)] text-[color:var(--teal-dark)] px-3.5 py-1.5 rounded-[var(--radius-xl)] text-sm font-semibold hover:bg-[var(--bg-subtle)] hover:border-[var(--teal-main)] dark:bg-[rgba(22,27,34,0.85)]"
              onClick={() => setShowInvite(!showInvite)}
          >
            Teams
          </button>
        </div>

        {/* Sibling of .header-actions, not a child — the header's space-between
            is what pushes this to the right edge. */}
        <div className="relative shrink-0 ml-auto" ref={settingsMenuRef}>
          <button
              className="inline-flex items-center bg-transparent border-none px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[color:var(--teal-dark)] hover:bg-[var(--bg-subtle)]"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="Settings"
          >
            <Settings size={18} strokeWidth={2} />
          </button>

          {showSettingsMenu && (
              <div className="absolute right-0 top-[calc(100%+8px)] bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] min-w-[180px] z-20 overflow-hidden flex flex-col">
                {SETTINGS_PAGES.map(({ id, label }) => (
                  <button
                    key={id}
                    className="text-left px-4 py-2.5 border-none bg-transparent font-semibold text-[color:var(--text-main)] hover:bg-[var(--bg-subtle)]"
                    onClick={() => {
                      setActiveTab(id);
                      setShowSettingsMenu(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button onClick={() => signOut(auth)} className="text-left px-4 py-2.5 border-none bg-transparent font-semibold text-[color:var(--priority-high)] hover:bg-[var(--bg-subtle)]">
                  Sign Out
                </button>
              </div>
          )}
        </div>
      </header>

      {showInvite && (
        <div className="mx-6 mb-4 p-[18px] border border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] animate-[slideDown_0.25s_ease_both]">
          <div className="flex justify-between items-start mb-[15px] gap-2">
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  className={
                    workspace === team.id
                      ? 'bg-[var(--teal-main)] text-white border-none px-[18px] py-2 font-bold rounded-[var(--radius-sm)] hover:enabled:bg-[var(--teal-dark)] hover:enabled:-translate-y-px hover:enabled:shadow-[0_3px_10px_rgba(16,185,129,0.25)] active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none'
                      : 'bg-transparent border-none px-3.5 py-1.5 text-[color:var(--text-muted)] font-semibold rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] hover:text-[color:var(--teal-dark)]'
                  }
                  onClick={() => handleWorkspaceChange(team.id)}
                >
                  {team.name}
                </button>
              ))}

              {teams.length < 5 && !isNamingTeam && (
                <button
                  className="bg-transparent border-none px-3.5 py-1.5 text-[color:var(--text-muted)] font-semibold rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] hover:text-[color:var(--teal-dark)]"
                  onClick={() => setIsNamingTeam(true)}
                >
                  +
                </button>
              )}
            </div>

            {workspace !== 'personal' && (
                <div className="relative shrink-0" ref={manageMenuRef}>
                <button
                  className="flex items-center gap-1.5 bg-white/70 border border-[var(--border)] text-[color:var(--teal-dark)] px-3.5 py-1.5 rounded-[var(--radius-xl)] text-sm font-semibold hover:bg-[var(--bg-subtle)] hover:border-[var(--teal-main)] dark:bg-[rgba(22,27,34,0.85)]"
                  onClick={() => setShowManageMenu(!showManageMenu)}
                >
                  Manage Team
                </button>

                {showManageMenu && (
                  <div className="absolute right-0 top-[calc(100%+6px)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08)] min-w-[160px] z-20 overflow-hidden">
                    <button
                        className="block w-full text-left px-3.5 py-2.5 border-none bg-transparent"
                        onClick={() => {
                          setShowAddMembers(true);
                          setShowManageMenu(false);
                        }}
                    >
                      Team members
                    </button>
                    {isCreator && (
                      <button
                        className="block w-full text-left px-3.5 py-2.5 border-none bg-transparent text-[color:var(--priority-high)]"
                        onClick={handleDeleteTeam}
                      >
                        Delete team
                      </button>
                    )}

                    {!isCreator && (
                        <button
                            className="block w-full text-left px-3.5 py-2.5 border-none bg-transparent text-[color:var(--priority-high)]"
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
            <div className="flex gap-2 mb-[15px]">
              <input
                type="text"
                placeholder="New Team Name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <button className="bg-[var(--teal-main)] text-white border-none px-[18px] py-2 font-bold rounded-[var(--radius-sm)] hover:enabled:bg-[var(--teal-dark)] hover:enabled:-translate-y-px hover:enabled:shadow-[0_3px_10px_rgba(16,185,129,0.25)] active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none" onClick={handleAddTeam}>
                Create
              </button>
              <button className="bg-transparent border-none px-3.5 py-1.5 text-[color:var(--text-muted)] font-semibold rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] hover:text-[color:var(--teal-dark)]" onClick={handleCancelAddTeam}>
                Cancel
              </button>
            </div>
          )}

          {showAddMembers && workspace !== 'personal' && (
              <div className="mt-[15px]">
                <ul className="list-none p-0 mb-3 flex gap-2 flex-wrap">
                  {(currentTeam?.members || []).map((uid) => {
                    const member = usersMap[uid];
                    return (
                        <li key={uid} className="flex items-center gap-1.5 text-[length:var(--text-sm)] bg-[var(--bg-subtle)] px-3 py-1 rounded-[var(--radius-xl)] transition-colors hover:bg-[var(--accent-light)]">
                          {member?.displayName || (uid === user.uid ? (user.displayName || 'You') : uid)}
                          {isCreator && uid !== user.uid && (
                              <button
                                  className="inline-flex items-center justify-center bg-transparent border-none p-1 opacity-35 rounded-[var(--radius-sm)] transition-opacity hover:opacity-100 hover:text-[color:var(--priority-high)]"
                                  title="Remove member"
                                  onClick={() => handleRemoveMember(uid)}
                              >
                                <X size={15} strokeWidth={2.5} />
                              </button>
                          )}
                        </li>
                    );
                  })}
                </ul>

                <div
                    className="mt-[15px] flex gap-2 items-center"
                >
                  <input
                      type="email"
                      placeholder="Roommate's email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                  />
                  <button className="bg-[var(--teal-main)] text-white border-none px-[18px] py-2 font-bold rounded-[var(--radius-sm)] hover:enabled:bg-[var(--teal-dark)] hover:enabled:-translate-y-px hover:enabled:shadow-[0_3px_10px_rgba(16,185,129,0.25)] active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none" onClick={handleInvite}>
                    Invite
                  </button>
                  <button className="bg-transparent border-none px-3.5 py-1.5 text-[color:var(--text-muted)] font-semibold rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] hover:text-[color:var(--teal-dark)]" onClick={handleCancelInvite}>
                    Cancel
                  </button>
                  {inviteStatus && (
                      <p
                          className={
                            inviteStatus.type === 'success'
                                ? 'm-0 text-[length:var(--text-sm)] font-semibold text-[color:var(--accent-text)]'
                                : 'm-0 text-[length:var(--text-sm)] font-semibold text-[color:var(--priority-high)]'
                          }
                      >
                        {inviteStatus.message}
                      </p>
                  )}
                </div>
              </div>
          )}

          <ul className="list-none p-0 mb-3 flex gap-2 flex-wrap">
            {/* Optional: render pending invites for this team here later */}
          </ul>
        </div>
      )}
      </div>
  );
}

export default Header;
