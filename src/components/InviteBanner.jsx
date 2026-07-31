import { Mail } from 'lucide-react';

function InviteBanner({ invite, inviterName, onAccept, onDecline }) {
    return (
        <div className="invite-banner">
            <div className="invite-banner-icon">
                <Mail size={20} strokeWidth={2} />
            </div>

            <div className="invite-banner-text">
                <strong>{inviterName}</strong> has invited you to join their team:{' '}
                <strong>{invite.teamName}</strong>
            </div>

            <div className="invite-banner-actions">
                <button className="btn-primary" onClick={onAccept}>
                    Accept
                </button>
                <button className="btn-ghost" onClick={onDecline}>
                    Decline
                </button>
            </div>
        </div>
    );
}

export default InviteBanner;