import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api';
import './AdminApplications.css';

export default function AdminApplications() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    admin
      .listApplications()
      .then(({ data }) => setList(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading">Loading applications...</div>;
  if (error) return <div className="admin-error">{error}</div>;

  const pending = list.filter((a) => a.status === 'PENDING');
  const others = list.filter((a) => a.status !== 'PENDING');

  return (
    <div className="admin-apps-page">
      <h1>Owner applications</h1>
      {list.length === 0 ? (
        <p className="admin-empty">No applications yet.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="admin-section">
              <h2>Pending ({pending.length})</h2>
              <ul className="admin-list">
                {pending.map((app) => (
                  <li key={app.id} className="admin-list-item pending">
                    <Link to={`/admin/applications/${app.id}`}>
                      <strong>{app.restaurant_name}</strong> — {app.user_name} ({app.user_email})
                    </Link>
                    <span className="admin-date">{new Date(app.submitted_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {others.length > 0 && (
            <section className="admin-section">
              <h2>Reviewed</h2>
              <ul className="admin-list">
                {others.map((app) => (
                  <li key={app.id} className="admin-list-item">
                    <Link to={`/admin/applications/${app.id}`}>
                      <strong>{app.restaurant_name}</strong> — {app.status}
                    </Link>
                    <span className="admin-date">{new Date(app.reviewed_at || app.submitted_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
