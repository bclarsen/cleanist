import { useState } from 'react';
import { Lock, Users } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULT_USER_PREFS = {
  emailNotifications: true,
  defaultWorkspace: 'personal',
};

const DEFAULT_TEAM_PREFS = {
  quietHours: false,
  autoAssign: 'manual',
};

/**
 * Two scopes behind a toggle:
 *  - "You"  — per-user settings, belong on `users/{uid}.preferences`
 *  - "Team" — settings for the active team, on `teams/{teamId}.preferences`
 *
 * Every member can read team preferences; only the creator can change them.
 * The disabled inputs here are UX only — `firestore.rules` is what enforces it.
 */
function Preferences({ user, profile, teams = [], workspace }) {
  const [scope, setScope] = useState('user');

  // Read straight from the `users` snapshot rather than mirroring into local state:
  // writes come back through App's usersMap listener, so this stays in step.
  const userPrefs = { ...DEFAULT_USER_PREFS, ...(profile?.preferences || {}) };

  const activeTeam = teams.find((t) => t.id === workspace);
  const isPersonal = workspace === 'personal' || !activeTeam;
  const canEditTeam = !!activeTeam && activeTeam.createdBy === user.uid;
  const teamPrefs = { ...DEFAULT_TEAM_PREFS, ...(activeTeam?.preferences || {}) };

  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');

  const saveUserPref = async (patch) => {
    setSavingUser(true);
    setUserError('');
    try {
      // Merge against the current values so a partial write can't drop the others.
      await updateDoc(doc(db, 'users', user.uid), {
        preferences: { ...userPrefs, ...patch },
      });
    } catch (err) {
      console.error('Error saving preferences:', err);
      setUserError('Could not save preferences. Please try again.');
    } finally {
      setSavingUser(false);
    }
  };

  const saveTeamPref = async (patch) => {
    if (!canEditTeam) return;
    setSavingTeam(true);
    setTeamError('');
    try {
      // Merge against the current values so a partial write can't drop the others.
      await updateDoc(doc(db, 'teams', activeTeam.id), {
        preferences: { ...teamPrefs, ...patch },
      });
    } catch (err) {
      console.error('Error saving team preferences:', err);
      setTeamError('Could not save team preferences. Please try again.');
    } finally {
      setSavingTeam(false);
    }
  };

  return (
      <div className="settings-panel">
        <div className="settings-panel-heading">
          <h2>Preferences</h2>
        </div>

        <div className="task-item settings-card">
          <div className="settings-card-toolbar">
            <div className="settings-scope-toggle">
              <button
                  className={scope === 'user' ? 'active' : ''}
                  onClick={() => setScope('user')}
              >
                You
              </button>
              <button
                  className={scope === 'team' ? 'active' : ''}
                  onClick={() => setScope('team')}
              >
                Team
              </button>
            </div>
          </div>

          {scope === 'user' ? (
            <>
              <div className="preference-list">
                <div className="preference-row">
                  <div className="preference-label">
                    <strong>Email Notifications</strong>
                    <p>
                      Get notified about upcoming and overdue tasks.
                      <em> Saved, but reminders aren&apos;t sent yet.</em>
                    </p>
                  </div>
                  <div className="preference-control">
                    <input
                        type="checkbox"
                        checked={userPrefs.emailNotifications}
                        disabled={savingUser}
                        onChange={(e) => saveUserPref({ emailNotifications: e.target.checked })}
                    />
                  </div>
                </div>

                <div className="preference-row">
                  <div className="preference-label">
                    <strong>Default Workspace</strong>
                    <p>Which workspace to open on sign-in.</p>
                  </div>
                  <div className="preference-control">
                    <select
                        value={userPrefs.defaultWorkspace}
                        disabled={savingUser}
                        onChange={(e) => saveUserPref({ defaultWorkspace: e.target.value })}
                    >
                      {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {userError && <p className="profile-setup-error">{userError}</p>}

              <p className="settings-card-note">
                These preferences apply only to <strong>{user.email}</strong>.
              </p>
            </>
          ) : (
            <>
              {isPersonal ? (
                  <div className="settings-empty-scope">
                    <Users size={26} strokeWidth={1.75} />
                    <p className="settings-card-note">
                      You&apos;re in your <strong>Personal</strong> workspace, which has no team
                      settings. Switch to a team from the Teams menu to see its preferences.
                    </p>
                  </div>
              ) : (
                  <>
                    {!canEditTeam && (
                        <span className="settings-readonly-badge">
                    <Lock size={12} strokeWidth={2.5} />
                    View only
                  </span>
                    )}

                    <div className="preference-list">
                      <div className="preference-row">
                        <div className="preference-label">
                          <strong>Quiet Hours</strong>
                          <p>
                            Hold task reminders for everyone between 10pm and 8am.
                            <em> Saved, but reminders aren&apos;t sent yet.</em>
                          </p>
                        </div>
                        <div className="preference-control">
                          <input
                              type="checkbox"
                              checked={teamPrefs.quietHours}
                              disabled={!canEditTeam || savingTeam}
                              onChange={(e) => saveTeamPref({ quietHours: e.target.checked })}
                          />
                        </div>
                      </div>

                      <div className="preference-row">
                        <div className="preference-label">
                          <strong>Task Assignment</strong>
                          <p>
                            How new tasks get assigned to roommates. Rotating gives each
                            new task to whoever has the fewest.
                          </p>
                        </div>
                        <div className="preference-control">
                          <select
                              value={teamPrefs.autoAssign}
                              disabled={!canEditTeam || savingTeam}
                              onChange={(e) => saveTeamPref({ autoAssign: e.target.value })}
                          >
                            <option value="manual">Assign manually</option>
                            <option value="rotate">Rotate between roommates</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {teamError && <p className="profile-setup-error">{teamError}</p>}

                    <p className="settings-card-note">
                      {canEditTeam ? (
                          <>
                            These settings apply to everyone in{' '}
                            <strong>{activeTeam.name}</strong>. You own this team, so you can
                            change them.
                          </>
                      ) : (
                          <>
                            These settings apply to everyone in{' '}
                            <strong>{activeTeam.name}</strong>. Only the person who created the
                            team can change them.
                          </>
                      )}
                    </p>
                  </>
              )}
            </>
          )}
        </div>
      </div>
  );
}

export default Preferences;
