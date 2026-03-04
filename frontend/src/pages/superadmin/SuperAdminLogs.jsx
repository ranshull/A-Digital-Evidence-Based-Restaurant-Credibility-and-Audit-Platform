import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { superadmin } from '../../api';
import './SuperAdminLogs.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function SuperAdminLogs() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rollbackId, setRollbackId] = useState(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fetchLogs = () => {
    setLoading(true);
    setError('');
    superadmin
      .logs()
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load logs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRollbackClick = (restaurantId) => setRollbackId(restaurantId);
  const handleRollbackCancel = () => setRollbackId(null);

  const handleRollbackConfirm = () => {
    if (!rollbackId) return;
    setRollbackLoading(true);
    superadmin
      .rollbackRestaurant(rollbackId)
      .then(() => {
        setRollbackId(null);
        fetchLogs();
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Rollback failed');
      })
      .finally(() => setRollbackLoading(false));
  };

  if (loading) {
    return <div className="superadmin-logs-loading">Loading logs...</div>;
  }
  if (error && list.length === 0) {
    return <div className="superadmin-logs-error">{error}</div>;
  }

  return (
    <div className="superadmin-logs-page">
      <div className="superadmin-logs-header">
        <h1>Logs</h1>
        <p className="superadmin-logs-sub">
          Work done and pending by restaurant. Rollback resets a restaurant to initial state (all evidence Pending, scores removed).
        </p>
      </div>
      {error && <div className="superadmin-logs-error-banner">{error}</div>}
      {list.length === 0 ? (
        <p className="superadmin-logs-empty">No restaurants.</p>
      ) : (
        <div className="superadmin-logs-list">
          {list.map((item) => (
            <div key={item.restaurant_id} className="superadmin-logs-card">
              <div className="superadmin-logs-card-head">
                <h2 className="superadmin-logs-card-title">{item.restaurant_name}</h2>
                <div className="superadmin-logs-card-actions">
                  <Link
                    to={`/superadmin/report/${item.restaurant_id}`}
                    className="superadmin-logs-btn superadmin-logs-btn-report"
                    title="View & print report"
                  >
                    <span className="superadmin-logs-print-icon" aria-hidden>🖨</span>
                    Report
                  </Link>
                  <button
                    type="button"
                    className="superadmin-logs-btn superadmin-logs-btn-rollback"
                    onClick={() => handleRollbackClick(item.restaurant_id)}
                  >
                    Rollback
                  </button>
                </div>
              </div>
              <div className="superadmin-logs-card-body">
                <section className="superadmin-logs-section">
                  <h3>Work done</h3>
                  {item.work_done.evidence_reviews.length === 0 && item.work_done.score_submissions.length === 0 ? (
                    <p className="superadmin-logs-muted">None yet.</p>
                  ) : (
                    <>
                      {item.work_done.evidence_reviews.length > 0 && (
                        <ul className="superadmin-logs-done-list">
                          {item.work_done.evidence_reviews.map((e) => (
                            <li key={e.evidence_id}>
                              Evidence ({e.category_name}): <strong>{e.action}</strong> by {e.reviewed_by_name || e.reviewed_by_email || '—'} at {formatDate(e.reviewed_timestamp)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.work_done.score_submissions.length > 0 && (
                        <ul className="superadmin-logs-done-list">
                          {item.work_done.score_submissions.map((s, i) => (
                            <li key={`${s.category_name}-${i}`}>
                              Scores submitted for {s.category_name} by {s.scored_by_name || s.scored_by_email || '—'} at {formatDate(s.scored_timestamp)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </section>
                <section className="superadmin-logs-section">
                  <h3>Pending</h3>
                  <p>
                    {item.pending.pending_evidence_count} pending evidence · {item.pending.has_scores ? 'Scores submitted' : 'No scores yet'}
                  </p>
                </section>
              </div>
            </div>
          ))}
        </div>
      )}

      {rollbackId && (
        <div className="superadmin-logs-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rollback-title">
          <div className="superadmin-logs-modal">
            <h2 id="rollback-title">Rollback restaurant?</h2>
            <p>
              This will reset the restaurant to its initial state: all evidence will be set to <strong>Pending</strong> and all scores will be removed. This cannot be undone.
            </p>
            <div className="superadmin-logs-modal-actions">
              <button
                type="button"
                className="superadmin-logs-btn superadmin-logs-btn-cancel"
                onClick={handleRollbackCancel}
                disabled={rollbackLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="superadmin-logs-btn superadmin-logs-btn-confirm"
                onClick={handleRollbackConfirm}
                disabled={rollbackLoading}
              >
                {rollbackLoading ? 'Rolling back…' : 'Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
