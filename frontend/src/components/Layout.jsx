import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
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
          <nav className="layout-nav">
            <Link to="/" className={isActive('/') && location.pathname === '/' ? 'layout-nav-active' : ''} onClick={closeSidebar}>Browse</Link>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Dashboard</Link>
            {user ? (
              <>
                {user.role === 'USER' && (
                  <>
                    <Link to="/apply" className={isActive('/apply') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Apply as Owner</Link>
                    <Link to="/application-status" className={isActive('/application-status') ? 'layout-nav-active' : ''} onClick={closeSidebar}>My Application</Link>
                  </>
                )}
                {user.role === 'OWNER' && (
                  <Link to="/owner-dashboard" className={isActive('/owner-dashboard') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Owner Dashboard</Link>
                )}
                {user.role === 'AUDITOR' && (
                  <Link to="/auditor/audits" className={isActive('/auditor/audits') ? 'layout-nav-active' : ''} onClick={closeSidebar}>My audits</Link>
                )}
                {user.role === 'ADMIN' && (
                  <>
                    <Link to="/admin/review" className={isActive('/admin/review') ? 'layout-nav-active' : ''} onClick={closeSidebar}>My pending work</Link>
                    <Link to="/admin/audits" className={isActive('/admin/audits') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Auditor audits</Link>
                    <Link to="/admin/applications" className={isActive('/admin/applications') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Review Applications</Link>
                  </>
                )}
                {user.role === 'SUPER_ADMIN' && (
                  <>
                    <Link to="/superadmin/users" className={isActive('/superadmin/users') ? 'layout-nav-active' : ''} onClick={closeSidebar}>User Management</Link>
                    <Link to="/superadmin/users/create" className={isActive('/superadmin/users/create') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Create User</Link>
                    <Link to="/superadmin/logs" className={isActive('/superadmin/logs') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Logs</Link>
                    <Link to="/superadmin/assignments" className={isActive('/superadmin/assignments') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Assignments</Link>
                    <Link to="/superadmin/audits" className={isActive('/superadmin/audits') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Audits</Link>
                    <Link to="/admin/review" className={isActive('/admin/review') ? 'layout-nav-active' : ''} onClick={closeSidebar}>My pending work</Link>
                    <Link to="/admin/applications" className={isActive('/admin/applications') ? 'layout-nav-active' : ''} onClick={closeSidebar}>Review Applications</Link>
                  </>
                )}
                <div className="layout-user-block">
                  <span className="layout-user">{user.name}</span>
                  <span className="layout-user-role">{user.role}</span>
                </div>
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
