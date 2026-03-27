import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api';
import './AdminApplications.css';

export default function AdminApplications() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    admin
      .listApplications()
      .then(({ data }) => setList(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading">Loading applications...</div>;
  if (error) return <div className="admin-error">{error}</div>;

  const uniqueRestaurantNames = Array.from(
    new Set(list.map((a) => (a.restaurant_name || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = list.filter((a) => {
    const statusOk = !statusFilter || a.status === statusFilter;
    const nameOk = !nameFilter.trim()
      || (a.restaurant_name || '').toLowerCase().includes(nameFilter.trim().toLowerCase());
    return statusOk && nameOk;
  });

  return (
    <div className="admin-apps-page">
      <h1>Owner applications</h1>
      <div className="admin-apps-filters">
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <label>
          <span>Restaurant name</span>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search by restaurant"
            list="admin-app-restaurant-suggestions"
          />
          <datalist id="admin-app-restaurant-suggestions">
            {uniqueRestaurantNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="admin-empty">No applications yet.</p>
      ) : (
        <section className="admin-section">
          <ul className="admin-list admin-card-grid">
            {filtered.map((app) => (
              <li key={app.id} className={`admin-list-item ${app.status === 'PENDING' ? 'pending' : ''}`}>
                <Link to={`/admin/applications/${app.id}`} className="admin-app-card-link">
                  <div className="admin-app-card-main">
                    <strong>{app.restaurant_name}</strong>
                    <span className="admin-app-card-sub">{app.user_name}</span>
                  </div>
                  <span className={`admin-app-card-status admin-status-${(app.status || '').toLowerCase()}`}>
                    {app.status}
                  </span>
                  <span className="admin-date">{new Date(app.reviewed_at || app.submitted_at).toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
