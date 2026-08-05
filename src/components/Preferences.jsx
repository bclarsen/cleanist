import { useState } from 'react';
import { Lock, Users } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_COMPLETED_WINDOW_MS,
  formatDuration,
  msToParts,
  partsToMs,
} from '../utils/dateHelpers';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const COMPLETED_PRESETS = [
  { value: HOUR_MS, label: '1 hour' },
  { value: DAY_MS, label: '1 day' },
  { value: WEEK_MS, label: '1 week' },
];

const THIRTY_MINS_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const REMINDER_PRESETS = [
  { value: THIRTY_MINS_MS, label: '30 mins' },
  { value: ONE_HOUR_MS, label: '1 hr' },
];

const DEFAULT_USER_PREFS = {
  emailNotifications: true,
  defaultWorkspace: 'personal',
  // null, not a number: "follow the team's window". See resolveCompletedWindowMs.
  completedWindowMs: null,
};

const DEFAULT_TEAM_PREFS = {
  quietHours: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  autoAssign: 'manual',
  completedWindowMs: DEFAULT_COMPLETED_WINDOW_MS,
  taskRemindersEnabled: true,
  reminderAdvanceMs: THIRTY_MINS_MS,
};

function ReminderAdvanceControl({ value, disabled, onChange }) {
  const isPreset = REMINDER_PRESETS.some((p) => p.value === value);
  const [custom, setCustom] = useState(() =>
    msToParts(value ?? THIRTY_MINS_MS)
  );
  const [showCustom, setShowCustom] = useState(!isPreset);

  const selectValue = showCustom ? 'custom' : String(value ?? THIRTY_MINS_MS);

  const handleSelect = (next) => {
    if (next === 'custom') {
      setCustom(msToParts(value ?? THIRTY_MINS_MS));
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(Number(next));
  };

  const customMs = partsToMs(custom);

  return (
    <div className="completed-window-control">
      <select
        value={selectValue}
        disabled={disabled}
        onChange={(e) => handleSelect(e.target.value)}
      >
        {REMINDER_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>

      {showCustom && (
        <div className="completed-window-custom">
          <div className="completed-window-fields">
            {[
              { key: 'hours', label: 'Hours', max: 72 },
              { key: 'minutes', label: 'Minutes', max: 59 },
            ].map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <input
                  type="number"
                  min="0"
                  max={field.max}
                  value={custom[field.key]}
                  disabled={disabled}
                  onChange={(e) =>
                    setCustom((prev) => ({
                      ...prev,
                      [field.key]: e.target.value === ''
                        ? ''
                        : Math.max(0, Number(e.target.value)),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="completed-window-actions">
            <button
              className="btn-primary"
              disabled={disabled || customMs <= 0 || customMs === value}
              onClick={() => onChange(customMs)}
            >
              Apply
            </button>
            <span className="completed-window-preview">
              {customMs > 0
                ? `Reminds ${formatDuration(customMs)} before due`
                : 'Pick at least one minute'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * How long completed tasks stay visible. Presets cover the common cases; "Custom"
 * swaps in days/hours/minutes inputs.
 *
 * The inputs are local state so a half-typed value ("1 day and 0 hours and…")
 * doesn't get written on every keystroke — the write happens on Apply.
 */
function CompletedWindowControl({ value, allowInherit, disabled, onChange }) {
  const isPreset = COMPLETED_PRESETS.some((p) => p.value === value);
  const inherits = allowInherit && (value === null || value === undefined);
  const [custom, setCustom] = useState(() =>
    msToParts(value ?? DEFAULT_COMPLETED_WINDOW_MS),
  );
  const [showCustom, setShowCustom] = useState(!inherits && !isPreset);

  const selectValue = showCustom
      ? 'custom'
      : inherits
          ? 'inherit'
          : String(value);

  const handleSelect = (next) => {
    if (next === 'custom') {
      setCustom(msToParts(value ?? DEFAULT_COMPLETED_WINDOW_MS));
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(next === 'inherit' ? null : Number(next));
  };

  const customMs = partsToMs(custom);

  return (
      <div className="completed-window-control">
        <select
            value={selectValue}
            disabled={disabled}
            onChange={(e) => handleSelect(e.target.value)}
        >
          {allowInherit && <option value="inherit">Match the team&apos;s setting</option>}
          {COMPLETED_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
          ))}
          <option value="custom">Custom…</option>
        </select>

        {showCustom && (
            <div className="completed-window-custom">
              <div className="completed-window-fields">
                {[
                  { key: 'days', label: 'Days', max: 365 },
                  { key: 'hours', label: 'Hours', max: 23 },
                  { key: 'minutes', label: 'Minutes', max: 59 },
                ].map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <input
                          type="number"
                          min="0"
                          max={field.max}
                          value={custom[field.key]}
                          disabled={disabled}
                          onChange={(e) =>
                              setCustom((prev) => ({
                                ...prev,
                                [field.key]: e.target.value === ''
                                    ? ''
                                    : Math.max(0, Number(e.target.value)),
                              }))
                          }
                      />
                    </label>
                ))}
              </div>
              <div className="completed-window-actions">
                <button
                    className="btn-primary"
                    disabled={disabled || customMs <= 0 || customMs === value}
                    onClick={() => onChange(customMs)}
                >
                  Apply
                </button>
                <span className="completed-window-preview">
                  {customMs > 0
                      ? `Hides after ${formatDuration(customMs)}`
                      : 'Pick at least one minute'}
                </span>
              </div>
            </div>
        )}
      </div>
  );
}

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

              <h3 className="preference-group-heading">Completed tasks</h3>
              <div className="preference-list">
                <div className="preference-row">
                  <div className="preference-label">
                    <strong>Task Disappearance Window</strong>
                    <p>
                      How long a finished task stays in <strong>Completed</strong> before
                      it disappears. Only affects your view.
                    </p>
                  </div>
                  <div className="preference-control">
                    <CompletedWindowControl
                        value={userPrefs.completedWindowMs}
                        allowInherit
                        disabled={savingUser}
                        onChange={(completedWindowMs) => saveUserPref({ completedWindowMs })}
                    />
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
                          <strong>Task Reminders</strong>
                          <p>
                            Notify household members about upcoming tasks before they are due.
                          </p>
                          {teamPrefs.taskRemindersEnabled && (
                            <div style={{ marginTop: '10px' }}>
                              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--teal-dark)', display: 'block', marginBottom: '6px' }}>
                                Notify in advance:
                              </label>
                              <ReminderAdvanceControl
                                value={teamPrefs.reminderAdvanceMs}
                                disabled={!canEditTeam || savingTeam}
                                onChange={(reminderAdvanceMs) => saveTeamPref({ reminderAdvanceMs })}
                              />
                            </div>
                          )}
                        </div>
                        <div className="preference-control">
                          <input
                            type="checkbox"
                            checked={teamPrefs.taskRemindersEnabled}
                            disabled={!canEditTeam || savingTeam}
                            onChange={(e) => saveTeamPref({ taskRemindersEnabled: e.target.checked })}
                          />
                        </div>
                      </div>
                      <div className="preference-row">
                        <div className="preference-label">
                          <strong>Quiet Hours</strong>
                          <p>
                            Hold task reminders for everyone during configured hours.
                          </p>
                          {teamPrefs.quietHours && (
                            <div className="quiet-hours-controls">
                              <div className="quiet-hours-field">
                                <label htmlFor="quiet-start">Start Time</label>
                                <input
                                  id="quiet-start"
                                  type="time"
                                  className="time-input"
                                  value={teamPrefs.quietHoursStart || '22:00'}
                                  disabled={!canEditTeam || savingTeam}
                                  onChange={(e) =>
                                    saveTeamPref({ quietHoursStart: e.target.value })
                                  }
                                />
                              </div>
                              <span className="quiet-hours-separator">to</span>
                              <div className="quiet-hours-field">
                                <label htmlFor="quiet-end">End Time</label>
                                <input
                                  id="quiet-end"
                                  type="time"
                                  className="time-input"
                                  value={teamPrefs.quietHoursEnd || '08:00'}
                                  disabled={!canEditTeam || savingTeam}
                                  onChange={(e) =>
                                    saveTeamPref({ quietHoursEnd: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                          )}
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

                    <h3 className="preference-group-heading">Completed tasks</h3>
                    <div className="preference-list">
                      <div className="preference-row">
                        <div className="preference-label">
                          <strong>Task Disappearance Window</strong>
                          <p>
                            The household default for how long finished tasks stay in{' '}
                            <strong>Completed</strong>. Members can override it for
                            themselves.
                          </p>
                        </div>
                        <div className="preference-control">
                          <CompletedWindowControl
                              value={teamPrefs.completedWindowMs}
                              disabled={!canEditTeam || savingTeam}
                              onChange={(completedWindowMs) => saveTeamPref({ completedWindowMs })}
                          />
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
