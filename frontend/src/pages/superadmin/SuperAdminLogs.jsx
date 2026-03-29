import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { superadmin } from '../../api';
import './SuperAdminLogs.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function SuperAdminLogs() {
  const [lane, setLane] = useState('admin');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rollbackId, setRollbackId] = useState(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackAuditWorkId, setRollbackAuditWorkId] = useState(null);
  const [rollbackAuditLoading, setRollbackAuditLoading] = useState(false);
  const fetchSeqRef = useRef(0);

  const fetchLogs = useCallback(() => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError('');
    setList([]);
    superadmin
      .logs({ lane })
      .then(({ data }) => {
        if (seq !== fetchSeqRef.current) return;
        const arr = Array.isArray(data) ? data : [];
        setList(arr);
      })
      .catch((err) => {
        if (seq !== fetchSeqRef.current) return;
        setList([]);
        setError(err.response?.data?.detail || 'Failed to load logs');
      })
      .finally(() => {
        if (seq === fetchSeqRef.current) setLoading(false);
      });
  }, [lane]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /** Avoid one render with new lane + stale list (auditor shape has no `pending` → crash). */
  const switchLane = (next) => {
    if (next === lane) return;
    setLane(next);
    setLoading(true);
    setList([]);
    setError('');
  };

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

  const handleRollbackAuditCancel = () => setRollbackAuditWorkId(null);

  const handleRollbackAuditConfirm = () => {
    if (rollbackAuditWorkId == null) return;
    setRollbackAuditLoading(true);
    superadmin
      .rollbackAuditPublish(rollbackAuditWorkId)
      .then(() => {
        setRollbackAuditWorkId(null);
        fetchLogs();
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Rollback failed');
      })
      .finally(() => setRollbackAuditLoading(false));
  };

  const subtitleAdmin =
    'Evidence reviews, desk scoring, and published on-site audit visits. Full restaurant rollback clears everything; use “Rollback publish” only to undo a published field audit (scores from that visit removed, visit returns to admin review).';
  const subtitleAuditor =
    'On-site audit visits by restaurant: who requested, which auditor accepted, and status (pending, in progress, or done).';

  return (
    <div className="superadmin-logs-page">
      <div className="superadmin-logs-header">
        <h1>Logs</h1>
        <div className="superadmin-logs-lane-toggle" role="group" aria-label="Log type">
          <button
            type="button"
            className={`superadmin-logs-lane-btn ${lane === 'admin' ? 'active' : ''}`}
            onClick={() => switchLane('admin')}
            aria-pressed={lane === 'admin'}
          >
            Admin
          </button>
          <button
            type="button"
            className={`superadmin-logs-lane-btn ${lane === 'auditor' ? 'active' : ''}`}
            onClick={() => switchLane('auditor')}
            aria-pressed={lane === 'auditor'}
          >
            Auditor
          </button>
        </div>
        <p className="superadmin-logs-sub">{lane === 'admin' ? subtitleAdmin : subtitleAuditor}</p>
      </div>
      {error && <div className="superadmin-logs-error-banner">{error}</div>}

      {loading && <div className="superadmin-logs-loading">Loading logs...</div>}

      {!loading && list.length === 0 && !error && (
        <p className="superadmin-logs-empty">
          {lane === 'auditor'
            ? 'No on-site audit activity yet. When an owner requests a visit from their dashboard, it will appear here with status and auditor.'
            : 'No restaurants.'}
        </p>
      )}

      {!loading && list.length > 0 && lane === 'admin' && (
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
                  {(() => {
                    const wd = item.work_done || {};
                    const ev = wd.evidence_reviews || [];
                    const ss = wd.score_submissions || [];
                    const ap = wd.audit_publishes || [];
                    const empty = ev.length === 0 && ss.length === 0 && ap.length === 0;
                    if (empty) return <p className="superadmin-logs-muted">None yet.</p>;
                    return (
                      <>
                        {ev.length > 0 && (
                          <ul className="superadmin-logs-done-list">
                            {ev.map((e) => (
                              <li key={e.evidence_id}>
                                Evidence ({e.category_name}): <strong>{e.action}</strong> by{' '}
                                {e.reviewed_by_name || e.reviewed_by_email || '—'} at {formatDate(e.reviewed_timestamp)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {ss.length > 0 && (
                          <ul className="superadmin-logs-done-list">
                            {ss.map((s, i) => (
                              <li key={`${s.category_name}-${i}`}>
                                Scores submitted for {s.category_name} by {s.scored_by_name || s.scored_by_email || '—'} at{' '}
                                {formatDate(s.scored_timestamp)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {ap.length > 0 && (
                          <div className="superadmin-logs-audit-publishes">
                            <h4 className="superadmin-logs-subsection-title">Published on-site audits (owner-facing)</h4>
                            <ul className="superadmin-logs-done-list">
                              {ap.map((a) => (
                                <li key={a.work_item_id} className="superadmin-logs-audit-publish-row">
                                  <span className="superadmin-logs-audit-publish-text">
                                    Visit #{a.work_item_id}: published by {a.published_by_name || a.published_by_email || '—'} at{' '}
                                    {formatDate(a.published_at)}
                                    {a.field_auditor_name && (
                                      <>
                                        {' '}
                                        · Field auditor: {a.field_auditor_name}
                                      </>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    className="superadmin-logs-btn superadmin-logs-btn-rollback-audit"
                                    onClick={() => setRollbackAuditWorkId(a.work_item_id)}
                                  >
                                    Rollback publish
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </section>
                <section className="superadmin-logs-section">
                  <h3>Pending</h3>
                  <p>
                    {item.pending?.pending_evidence_count ?? 0} pending evidence ·{' '}
                    {item.pending?.has_scores ? 'Scores submitted' : 'No scores yet'}
                  </p>
                </section>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && list.length > 0 && lane === 'auditor' && (
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
                  <h3>Audit visits</h3>
                  <ul className="superadmin-logs-done-list">
                    {(item.audit_work_items || []).map((w) => (
                      <li key={w.work_item_id}>
                        <strong>{w.status}</strong>
                        {' · '}
                        Requested by {w.requested_by_name || w.requested_by_email || '—'} at {formatDate(w.requested_at)}
                        {' · '}
                        {w.assigned_to_name || w.assigned_to_email ? (
                          <>Auditor: {w.assigned_to_name || w.assigned_to_email}</>
                        ) : (
                          <>Auditor: unclaimed</>
                        )}
                        {w.accepted_at && (
                          <>
                            {' · '}
                            Accepted {formatDate(w.accepted_at)}
                          </>
                        )}
                        {w.completed_at && (
                          <>
                            {' · '}
                            Completed {formatDate(w.completed_at)}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
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
              This will reset the restaurant to its initial state: all evidence will be set to <strong>Pending</strong>, all scores removed, and{' '}
              <strong>all on-site audit visit records</strong> for this restaurant deleted. This cannot be undone.
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

      {rollbackAuditWorkId != null && (
        <div
          className="superadmin-logs-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rollback-audit-title"
        >
          <div className="superadmin-logs-modal">
            <h2 id="rollback-audit-title">Rollback published audit?</h2>
            <p>
              This removes the <strong>credibility scores</strong> that were copied from this on-site visit when an admin published it. The visit
              returns to <strong>submitted to admin</strong> so it can be edited and published again. Scores deleted for &quot;not applicable&quot;
              categories at publish time are not automatically restored.
            </p>
            <div className="superadmin-logs-modal-actions">
              <button
                type="button"
                className="superadmin-logs-btn superadmin-logs-btn-cancel"
                onClick={handleRollbackAuditCancel}
                disabled={rollbackAuditLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="superadmin-logs-btn superadmin-logs-btn-confirm"
                onClick={handleRollbackAuditConfirm}
                disabled={rollbackAuditLoading}
              >
                {rollbackAuditLoading ? 'Rolling back…' : 'Rollback publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
