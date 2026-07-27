import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function ProfileSetup({ user, onComplete }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst) {
      setError('Please enter at least a first name.');
      return;
    }

    setSaving(true);
    setError('');

    const displayName = trimmedLast
      ? `${trimmedFirst} ${trimmedLast}`
      : trimmedFirst;

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          firstName: trimmedFirst,
          lastName: trimmedLast,
          displayName,
          email: user.email,
          photoURL: user.photoURL,
          profileComplete: true,
        },
        { merge: true },
      );
      onComplete(displayName);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Could not save your name. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="profile-setup-overlay">
      <div className="profile-setup-card">
        <div className="profile-setup-icon">👋</div>
        <h1 className="profile-setup-title">Welcome to Cleanist!</h1>
        <p className="profile-setup-subtitle">
          Before you dive in, let us know what to call you — your roommates will
          see this name.
        </p>

        <form onSubmit={handleSubmit} className="profile-setup-form">
          <div className="profile-name-row">
            <div className="profile-field">
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                type="text"
                placeholder="e.g. Alex"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                autoComplete="given-name"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                type="text"
                placeholder="e.g. Johnson"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          {error && <p className="profile-setup-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary profile-setup-submit"
            disabled={saving || !firstName.trim()}
          >
            {saving ? 'Saving…' : 'Let\'s Go →'}
          </button>
        </form>

        <p className="profile-setup-note">
          Signed in as <strong>{user.email}</strong>
        </p>
      </div>
    </div>
  );
}

export default ProfileSetup;
