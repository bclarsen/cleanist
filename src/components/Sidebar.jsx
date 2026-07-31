import { BarChart3, ClipboardList, Home, Package } from 'lucide-react';

const NAV_ITEMS = [
    { id: 'tasks', label: 'Tasks', Icon: ClipboardList },
    { id: 'inventory', label: 'Inventory', Icon: Package },
    { id: 'living-space', label: 'Living Space', Icon: Home },
    { id: 'stats', label: 'Stats', Icon: BarChart3 },
];

function Sidebar({ user, activeTab, setActiveTab }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <img src="/Cleanist_Logo.png" alt="Cleanist Logo" className="header-logo" />
                <h1>Cleanist</h1>
            </div>

            <nav className="sidebar-nav">
                {NAV_ITEMS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        className={activeTab === id ? 'sidebar-tab active' : 'sidebar-tab'}
                        onClick={() => setActiveTab(id)}
                    >
                        <Icon className="sidebar-tab-icon" size={17} strokeWidth={2} />
                        {label}
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
            </div>
        </aside>
    );
}

export default Sidebar;