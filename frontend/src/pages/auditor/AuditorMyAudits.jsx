import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auditor } from '../../api';
import './AuditorMyAudits.css';

export default function AuditorMyAudits() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    auditor
      .myAudits()
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load audits'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="auditor-loading">Loading audits...</div>;
  if (error) return <div className="auditor-error">{error}</div>;

  return (
    <div className="auditor-my-audits-page">
      <h1>My audits</h1>
      <p className="auditor-subtext">Audits assigned to you for on-site verification.</p>
      {list.length === 0 ? (
        <p className="auditor-empty">No audits assigned at the moment.</p>
      ) : (
        <ul className="auditor-audit-list">
          {list.map((a) => (
            <li key={a.id} className="auditor-audit-item">
              <Link to={`/auditor/audits/${a.id}`}>
                <div>
                  <strong>{a.restaurant_name}</strong>
                  <span className="auditor-status">{a.status}</span>
                </div>
                {a.submitted_at && (
                  <span className="auditor-meta">
                    Submitted: {new Date(a.submitted_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

