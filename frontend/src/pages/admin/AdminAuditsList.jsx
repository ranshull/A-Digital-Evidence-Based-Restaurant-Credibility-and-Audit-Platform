import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAudits } from '../../api';
import './AdminAudits.css';

export default function AdminAuditsList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminAudits
      .pending()
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load audits'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading">Loading audits...</div>;
  if (error) return <div className="admin-error">{error}</div>;

  return (
    <div className="admin-audits-page">
      <h1>Auditor audits to review</h1>
      <p className="admin-audits-sub">Audits submitted by auditors and waiting for admin approval.</p>
      {list.length === 0 ? (
        <p className="admin-empty">No audits pending review.</p>
      ) : (
        <div className="admin-audits-table-wrap">
          <table className="admin-audits-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Auditor</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.restaurant_name}</td>
                  <td>{a.assigned_to_name || '—'}</td>
                  <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td>
                    <Link to={`/admin/audits/${a.id}`} className="admin-audits-link">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

