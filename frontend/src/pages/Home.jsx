import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="home">
        <div className="home-hero">
          <h1>Restaurant Owner Verification</h1>
          <p>Apply for owner access. Get verified by admin and unlock your restaurant dashboard.</p>
          <div className="home-actions">
            <Link to="/login" className="btn btn-primary">Sign in</Link>
            <Link to="/register" className="btn btn-secondary">Register</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="home-welcome">
        <h1>Welcome, {user.name}</h1>
        <p className="home-role">
          Role: <strong>{user.role}</strong>
        </p>
        <div className="home-cards">
          {user.role === 'USER' && (
            <Link to="/apply" className="card-link">
              <div className="home-card">
                <h3>Apply as Owner</h3>
                <p>Submit your restaurant details and proof, then see your application status here.</p>
              </div>
            </Link>
          )}
          {user.role === 'OWNER' && (
            <Link to="/owner-dashboard" className="card-link">
              <div className="home-card">
                <h3>Owner Dashboard</h3>
                <p>Manage your restaurant.</p>
              </div>
            </Link>
          )}
          {user.role === 'ADMIN' && (
            <Link to="/admin/applications" className="card-link">
              <div className="home-card">
                <h3>Review Applications</h3>
                <p>Approve or reject owner applications.</p>
              </div>
            </Link>
          )}
          {user.role === 'AUDITOR' && (
            <Link to="/admin/review" className="card-link">
              <div className="home-card">
                <h3>My pending work</h3>
                <p>Review owner evidence assigned to you.</p>
              </div>
            </Link>
          )}
          {user.role === 'SUPER_ADMIN' && (
            <Link to="/superadmin/assignments" className="card-link">
              <div className="home-card">
                <h3>Assignments</h3>
                <p>Assign and oversee review work across the platform.</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
