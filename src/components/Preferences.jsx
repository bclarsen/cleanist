import { useState } from 'react';

function Preferences({ user }) {
    // Placeholder local state — wire these up to Firestore (e.g. users/{uid}.preferences)
    // once you decide what should actually be persisted.
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [defaultWorkspace, setDefaultWorkspace] = useState('personal');

    return (
        <div className="preferences-panel" style={{ padding: '0 24px' }}>
            <div style={{ marginBottom: '20px' }}>
                <h2>Preferences</h2>
            </div>

            <div
                className="task-item"
                style={{
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    maxWidth: '480px',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <strong style={{ color: 'var(--teal-dark)' }}>Email Notifications</strong>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            Get notified about upcoming and overdue tasks.
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <strong style={{ color: 'var(--teal-dark)' }}>Default Workspace</strong>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            Which workspace to open on sign-in.
                        </p>
                    </div>
                    <select
                        value={defaultWorkspace}
                        onChange={(e) => setDefaultWorkspace(e.target.value)}
                    >
                        <option value="personal">Personal</option>
                    </select>
                </div>

                <p className="empty-note" style={{ textAlign: 'left', margin: 0 }}>
                    More preferences coming soon. Changes here aren't saved yet — this page is a starting
                    point for wiring up real settings.
                </p>
            </div>
        </div>
    );
}

export default Preferences;