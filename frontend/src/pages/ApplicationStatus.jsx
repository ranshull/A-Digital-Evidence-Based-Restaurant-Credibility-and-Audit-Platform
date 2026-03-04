import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { owner } from '../api';
import './ApplicationStatus.css';

export default function ApplicationStatus() {
  const [data, setData] = useState({ applications: [], latest: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    owner
      .applicationStatus()
      .then(({ data: res }) => setData(res))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="status-loading">Loading application status...</div>;
  if (error) return <div className="status-error">{error}</div>;

  const { latest, applications } = data;

  if (!latest && applications.length === 0) {
    return (
      <div className="status-empty">
        <h2>No application yet</h2>
        <p>Submit an application to request owner access.</p>
        <Link to="/apply" className="status-cta">Apply now</Link>
      </div>
    );
  }

  return (
    <div className="status-page">
      <h1>My application status</h1>
      {latest && (
        <div className={`status-card status-${latest.status.toLowerCase()}`}>
          <div className="status-header">
            <h2>{latest.restaurant_name}</h2>
            <span className="status-badge">{latest.status}</span>
          </div>
          <p className="status-meta">Submitted: {new Date(latest.submitted_at).toLocaleString()}</p>
          {latest.reviewed_at && (
            <p className="status-meta">Reviewed: {new Date(latest.reviewed_at).toLocaleString()}</p>
          )}
          {latest.review_notes && (
            <div className="status-notes">
              <strong>Review notes:</strong> {latest.review_notes}
            </div>
          )}
          {latest.status === 'PENDING' && (
            <p className="status-pending-msg">Your application is under review. You will be notified once processed.</p>
          )}
          {latest.status === 'APPROVED' && (
            <p className="status-approved-msg">Your application was approved. You now have owner dashboard access.</p>
          )}
          {latest.status === 'REJECTED' && (
            <p className="status-rejected-msg">Your application was rejected. You may submit a new application with updated details.</p>
          )}
        </div>
      )}
      {applications.length > 1 && (
        <div className="status-history">
          <h3>Previous applications</h3>
          <ul>
            {applications.slice(1).map((app) => (
              <li key={app.id}>
                {app.restaurant_name} — {app.status} ({new Date(app.submitted_at).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>
      )}
      {latest?.status !== 'APPROVED' && (
        <Link to="/apply" className="status-cta secondary">Submit new / update application</Link>
      )}
    </div>
  );
}
