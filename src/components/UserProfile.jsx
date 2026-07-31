import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

function UserProfile({ user }) {
    const [editing, setEditing] = useState(false);
    const [firstName, setFirstName] = useState(user.displayName?.split(' ')[0] || '');
    const [lastName, setLastName] = useState(
        user.displayName?.split(' ').slice(1).join(' ') || ''
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();
        if (!trimmedFirst) {
            setError('First name is required.');
            return;
        }

        const displayName = trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst;

        setSaving(true);
        setError('');
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                firstName: trimmedFirst,
                lastName: trimmedLast,
                displayName,
            });
            setEditing(false);
        } catch (err) {
            console.error('Error updating profile:', err);
            setError('Could not save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setFirstName(user.displayName?.split(' ')[0] || '');
        setLastName(user.displayName?.split(' ').slice(1).join(' ') || '');
        setError('');
        setEditing(false);
    };

    return (
        <div className="profile-panel" style={{ padding: '0 24px' }}>
            <div style={{ marginBottom: '20px' }}>
                <h2>User Profile</h2>
            </div>

            <div
                className="task-item"
                style={{
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    maxWidth: '420px',
                }}
            >
                <div className="avatar-circle avatar-lg-wrap">
                    {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="avatar-lg" />
                    ) : (
                        <div className="avatar-lg placeholder">
                            {(user.displayName || user.email || '?')[0].toUpperCase()}
                        </div>
                    )}
                </div>

                {!editing ? (
                    <>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ margin: '0 0 4px', color: 'var(--teal-dark)', fontSize: 'var(--text-lg)' }}>
                                {user.displayName || 'No name set'}
                            </h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                {user.email}
                            </p>
                        </div>
                        <button className="btn-primary" onClick={() => setEditing(true)}>
                            Edit Name
                        </button>
                    </>
                ) : (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="profile-name-row">
                            <div className="profile-field">
                                <label>First Name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="profile-field">
                                <label>Last Name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && <p className="profile-setup-error">{error}</p>}

                        <div className="form-actions">
                            <button className="btn-ghost" onClick={handleCancel} disabled={saving}>
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSave}
                                disabled={saving || !firstName.trim()}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UserProfile;