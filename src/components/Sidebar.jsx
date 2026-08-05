import { BarChart3, ClipboardList, Home, Package } from 'lucide-react';
import { SETTINGS_TAB_IDS } from '../constants/settings';

const NAV_ITEMS = [
    { id: 'tasks', label: 'Tasks', Icon: ClipboardList },
    { id: 'inventory', label: 'Inventory', Icon: Package },
    { id: 'living-space', label: 'Living Space', Icon: Home },
    { id: 'stats', label: 'Stats', Icon: BarChart3 },
];

function Sidebar({ user, activeTab, setActiveTab }) {
    const isBackable = SETTINGS_TAB_IDS.includes(activeTab);

    const handleBrandClick = () => {
        if (isBackable) {
            setActiveTab('tasks');
        }
    };

    return (
        <aside className="sidebar">
            <div
                className={`sidebar-brand ${isBackable ? 'clickable' : ''}`}
                onClick={handleBrandClick}
                role={isBackable ? 'button' : undefined}
                tabIndex={isBackable ? 0 : undefined}
                onKeyDown={(e) => {
                    if (isBackable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleBrandClick();
                    }
                }}
            >
                <img src="/Mop_Logo.png" alt="Mop Logo" className="header-logo" />
                <h1>Mop</h1>
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