import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

function UserProfile({ user, profile, onProfileSave }) {
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const trimmedName = displayName.trim();
        const trimmedPhone = phoneNumber.trim();
        if (!trimmedName) {
            setError('Display name is required.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            // firstName/lastName are kept in sync with displayName so the doc written
            // by ProfileSetup stays coherent.
            const [first, ...rest] = trimmedName.split(' ');
            await updateDoc(doc(db, 'users', user.uid), {
                displayName: trimmedName,
                firstName: first,
                lastName: rest.join(' '),
                phoneNumber: trimmedPhone,
            });
            onProfileSave?.(trimmedName);
            setEditing(false);
        } catch (err) {
            console.error('Error updating profile:', err);
            setError('Could not save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDisplayName(user.displayName || '');
        setPhoneNumber(profile?.phoneNumber || '');
        setError('');
        setEditing(false);
    };

    return (
        <div className="settings-panel">
            <div className="settings-panel-heading">
                <h2>User Profile</h2>
            </div>

            <div className="task-item settings-card">
                <div className="profile-avatar">
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
                        <div className="profile-identity">
                            <h3>{user.displayName || 'No name set'}</h3>
                            <p>{user.email}</p>
                        </div>

                        <dl className="profile-details">
                            <div className="profile-detail-row">
                                <dt>Display Name</dt>
                                <dd>{user.displayName || <span className="profile-detail-empty">Not set</span>}</dd>
                            </div>
                            <div className="profile-detail-row">
                                <dt>Email</dt>
                                <dd>{user.email}</dd>
                            </div>
                            <div className="profile-detail-row">
                                <dt>Phone Number</dt>
                                <dd>
                                    {profile?.phoneNumber || <span className="profile-detail-empty">Not set</span>}
                                </dd>
                            </div>
                        </dl>

                        <button className="btn-primary" onClick={() => setEditing(true)}>
                            Edit Profile
                        </button>
                    </>
                ) : (
                    <div className="profile-edit-form">
                        <div className="profile-field">
                            <label htmlFor="displayName">Display Name</label>
                            <input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="e.g. Alex Johnson"
                                autoFocus
                                autoComplete="name"
                            />
                            <p className="profile-field-note">
                                This is the name your roommates see.
                            </p>
                        </div>

                        <div className="profile-field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={user.email || ''}
                                readOnly
                                disabled
                            />
                            <p className="profile-field-note">
                                Comes from your Google account and can&apos;t be changed here — team
                                invites are matched to this address.
                            </p>
                        </div>

                        <div className="profile-field">
                            <label htmlFor="phoneNumber">Phone Number</label>
                            <input
                                id="phoneNumber"
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="e.g. (555) 123-4567"
                                autoComplete="tel"
                            />
                        </div>

                        {error && <p className="profile-setup-error">{error}</p>}

                        <div className="form-actions">
                            <button className="btn-ghost" onClick={handleCancel} disabled={saving}>
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSave}
                                disabled={saving || !displayName.trim()}
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
