import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api';
import './AdminAuditorEvidence.css';

export default function AdminAuditorEvidence() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    admin
      .auditorEvidenceList()
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading">Loading auditor evidence…</div>;

  return (
    <div className="admin-auditor-evidence-page">
      <h1>Auditor evidence</h1>
      <p className="admin-auditor-evidence-hint">
        Review on-site auditor visits before scores are published to restaurant owners. Approve only when photos and
        scores are correct.
      </p>
      {error && <div className="admin-auditor-evidence-error">{error}</div>}
      {rows.length === 0 && !error && (
        <p className="admin-auditor-evidence-empty">No visits awaiting review.</p>
      )}
      <ul className="admin-auditor-evidence-list">
        {rows.map((r) => (
          <li key={r.work_item_id}>
            <Link to={`/admin/auditor-evidence/${r.work_item_id}`} className="admin-auditor-evidence-link">
              <span className="admin-auditor-evidence-rest">{r.restaurant_name}</span>
              <span className="admin-auditor-evidence-sub">
                {r.submission_status}
                {r.submitted_to_admin_at && (
                  <span className="admin-auditor-evidence-date">
                    {' '}
                    · Submitted {new Date(r.submitted_to_admin_at).toLocaleString()}
                  </span>
                )}
              </span>
              <span className="admin-auditor-evidence-auditor">Auditor: {r.auditor_name || '—'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
