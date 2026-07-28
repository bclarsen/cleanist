import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const NAV_ITEMS = [
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'living-space', label: 'Living Space', icon: '🏠' },
    { id: 'stats', label: 'Stats', icon: '📊' },
];

function Sidebar({ user, activeTab, setActiveTab }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <img src="/Cleanist_Logo.png" alt="Cleanist Logo" className="header-logo" />
                <h1>Cleanist</h1>
            </div>

            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        className={activeTab === item.id ? 'sidebar-tab active' : 'sidebar-tab'}
                        onClick={() => setActiveTab(item.id)}
                    >
                        <span className="sidebar-tab-icon">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="avatar-circle">
                    {user.photoURL ? (
                        <img src={user.photoURL} alt="" />
                    ) : (
                        user.displayName?.[0] || '?'
                    )}
                </div>
                <span className="sidebar-user-name">{user.displayName || user.email}</span>
                <button className="btn-ghost" onClick={() => signOut(auth)} title="Sign out">
                    ⎋
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;