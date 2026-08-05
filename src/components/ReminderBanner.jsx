import { Bell } from 'lucide-react';

function ReminderBanner({ task, onDismiss }) {
  if (!task) return null;

  return (
    <div className="invite-banner reminder-banner">
      <div className="invite-banner-icon">
        <Bell size={20} strokeWidth={2} />
      </div>

      <div className="invite-banner-text">
        Reminder: <strong>{task.name}</strong> is due soon!
      </div>

      <div className="invite-banner-actions">
        <button className="btn-primary" onClick={() => onDismiss(task.id)}>
          Got it
        </button>
      </div>
    </div>
  );
}

export default ReminderBanner;
