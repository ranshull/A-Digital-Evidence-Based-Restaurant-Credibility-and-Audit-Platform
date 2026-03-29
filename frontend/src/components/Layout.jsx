import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="layout">
      <button type="button" className="layout-toggle" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle menu">
        <span className="layout-toggle-bar" />
        <span className="layout-toggle-bar" />
        <span className="layout-toggle-bar" />
      </button>
      {sidebarOpen && <div className="layout-sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />}
      <aside className={`layout-sidebar ${sidebarOpen ? 'layout-sidebar-open' : ''}`}>
        <div className="layout-sidebar-inner">
          <Link to="/" className="layout-brand" onClick={closeSidebar}>FOODAS</Link>
          <div className="layout-theme-toggle" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <button
              type="button"
              className="layout-theme-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
          <nav className="layout-nav">
            <Link to="/" className={isActive('/') && location.pathname === '/' ? 'layout-nav-active' : ''} onClick={closeSidebar}>Browse</Link>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Dashboard</Link>
            {user ? (
              <>
                {user.role === 'USER' && (
                  <Link to="/apply" className={isActive('/apply') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Apply as Owner</Link>
                )}
                {user.role === 'OWNER' && (
                  <Link to="/owner-dashboard" className={isActive('/owner-dashboard') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Owner Dashboard</Link>
                )}
                {user.role === 'AUDITOR' && (
                  <>
                    <Link to="/admin/review" className={isActive('/admin/review') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Audit visit requests</Link>
                  </>
                )}
                {user.role === 'ADMIN' && (
                  <>
                    <Link to="/admin/evidence" className={isActive('/admin/evidence') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Evidence queue</Link>
                    <Link
                      to="/admin/auditor-evidence"
                      className={isActive('/admin/auditor-evidence') ? 'layout-nav-active' : ''}
                      onClick={closeSidebar}
                    >
                      Auditor evidence
                    </Link>
                    <Link to="/admin/applications" className={isActive('/admin/applications') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Review Applications</Link>
                  </>
                )}
                {user.role === 'SUPER_ADMIN' && (
                  <>
                    <span className="layout-nav-section-label">Evidence &amp; applications</span>
                    <Link to="/admin/evidence" className={isActive('/admin/evidence') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Evidence queue</Link>
                    <Link
                      to="/admin/auditor-evidence"
                      className={isActive('/admin/auditor-evidence') ? 'layout-nav-active' : ''}
                      onClick={closeSidebar}
                    >
                      Auditor evidence
                    </Link>
                    <Link to="/admin/applications" className={isActive('/admin/applications') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Review Applications</Link>
                    <span className="layout-nav-section-label">Field audits</span>
                    <Link to="/admin/review" className={isActive('/admin/review') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Audit visit requests</Link>
                    <span className="layout-nav-section-label">Super admin</span>
                    <Link to="/superadmin/users" className={isActive('/superadmin/users') ? 'layout-nav-active' : ''} onClick={closeSidebar}>User Management</Link>
                    <Link to="/superadmin/users/create" className={isActive('/superadmin/users/create') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Create User</Link>
                    <Link to="/superadmin/logs" className={isActive('/superadmin/logs') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Logs</Link>
                    <Link to="/superadmin/assignments" className={isActive('/superadmin/assignments') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Assignments</Link>
                    <Link to="/superadmin/crypto" className={isActive('/superadmin/crypto') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Crypto status</Link>
                    <Link to="/superadmin/evidence" className={isActive('/superadmin/evidence') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Evidence</Link>
                  </>
                )}
                <Link
                  to="/profile"
                  className={`layout-user-block ${isActive('/profile') ? 'layout-nav-active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="layout-user">{user.name}</span>
                  <span className="layout-user-role">{user.role}</span>
                </Link>
                <button type="button" className="layout-logout" onClick={() => { closeSidebar(); handleLogout(); }}>Logout</button>
              </>
            ) : (
              <Link to="/login" onClick={closeSidebar}>Sign in</Link>
            )}
          </nav>
        </div>
      </aside>
      <main className="layout-main">{children}</main>
    </div>
  );
}
