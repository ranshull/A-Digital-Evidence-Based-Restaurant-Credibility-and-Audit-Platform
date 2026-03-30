import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { restaurants, scores, owner } from '../api';
import './OwnerDashboard.css';

export default function OwnerDashboard() {
  const [restaurant, setRestaurant] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auditRequestLoading, setAuditRequestLoading] = useState(false);
  const [auditRevokeLoading, setAuditRevokeLoading] = useState(false);
  const [auditRequestMessage, setAuditRequestMessage] = useState('');
  const [auditStatus, setAuditStatus] = useState(null);
  const [auditCanRevoke, setAuditCanRevoke] = useState(false);
  const [showAuditConfirm, setShowAuditConfirm] = useState(false);
  const [auditHistory, setAuditHistory] = useState(null);
  const [privateFeedback, setPrivateFeedback] = useState(null);

  const applyAuditStatusPayload = (data) => {
    if (!data || data.status == null) {
      setAuditStatus(null);
      setAuditCanRevoke(false);
      return;
    }
    setAuditStatus(data.status);
    const can =
      typeof data.can_revoke === 'boolean' ? data.can_revoke : data.status === 'PENDING';
    setAuditCanRevoke(can);
  };

  useEffect(() => {
    restaurants
      .me()
      .then(({ data }) => setRestaurant(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load restaurant'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!restaurant) return;
    scores
      .myRestaurant()
      .then(({ data }) => setScoreData(data))
      .catch(() => setScoreData(null));
  }, [restaurant]);

  useEffect(() => {
    let mounted = true;
    const loadAuditStatus = () => {
      owner
        .auditStatus()
        .then(({ data }) => {
          if (!mounted) return;
          if (!data || data.status == null) {
            setAuditStatus(null);
            setAuditCanRevoke(false);
          } else {
            setAuditStatus(data.status);
            const can =
              typeof data.can_revoke === 'boolean' ? data.can_revoke : data.status === 'PENDING';
            setAuditCanRevoke(can);
          }
        })
        .catch(() => {
          if (mounted) {
            setAuditStatus(null);
            setAuditCanRevoke(false);
          }
        });
    };
    const loadAuditHistory = () => {
      owner
        .auditHistory()
        .then(({ data }) => {
          if (mounted) setAuditHistory(data);
        })
        .catch(() => {
          if (mounted) setAuditHistory(null);
        });
    };
    const loadFeedback = () => {
      owner
        .feedback()
        .then(({ data }) => {
          if (mounted) setPrivateFeedback(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (mounted) setPrivateFeedback(null);
        });
    };
    loadAuditStatus();
    loadAuditHistory();
    loadFeedback();
    const t = setInterval(() => {
      loadAuditStatus();
      loadAuditHistory();
      loadFeedback();
    }, 20000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (loading) return <div className="owner-loading">Loading dashboard...</div>;
  if (error) return <div className="owner-error">{error}</div>;
  if (!restaurant) return null;

  const overall = scoreData?.overall_score;
  const badge = scoreData?.badge || 'PROVISIONAL';
  const lastAudit = scoreData?.last_audit_at;
  const auditPublishedAt = scoreData?.auditor_visit_published_at;
  const categories = scoreData?.categories || [];
  const suggestions = scoreData?.suggestions || [];
  const evidenceCounts = scoreData?.evidence_counts || {};

  const profileComplete = Boolean(
    (restaurant.address || '').trim()
    && (restaurant.city || '').trim()
    && (restaurant.google_maps_link || '').trim()
    && (restaurant.operating_hours || '').trim()
    && (restaurant.phone || '').trim(),
  );
  const approvedEvidenceCount = evidenceCounts.approved ?? 0;
  const totalEvidence = evidenceCounts.total ?? 0;
  const hasAnyEvidence = totalEvidence > 0;
  const evidenceReady = approvedEvidenceCount >= 1;
  const allPending = hasAnyEvidence && approvedEvidenceCount === 0;

  const submitAuditRequest = () => {
    setShowAuditConfirm(false);
    setAuditRequestLoading(true);
    owner
      .requestAudit()
      .then(({ data }) => {
        setAuditRequestMessage(
          data?.detail || 'Audit requested. A certified auditor will be assigned by the team.',
        );
        return owner.auditStatus();
      })
      .then(({ data }) => {
        applyAuditStatusPayload(data);
        owner.auditHistory().then(({ data: h }) => setAuditHistory(h)).catch(() => {});
      })
      .catch((err) => {
        const msg = err.response?.data?.detail || 'Unable to request audit right now.';
        setAuditRequestMessage(msg);
      })
      .finally(() => setAuditRequestLoading(false));
  };

  const handleRevokeAudit = () => {
    setAuditRequestMessage('');
    const ok = window.confirm(
      'Revoke this pending audit request? You can do this until an auditor accepts it.',
    );
    if (!ok) return;
    setAuditRevokeLoading(true);
    owner
      .revokeAudit()
      .then(() => owner.auditStatus())
      .then(({ data }) => {
        applyAuditStatusPayload(data);
        setAuditRequestMessage('Audit request revoked.');
      })
      .catch((err) => {
        const msg = err.response?.data?.detail || 'Unable to revoke request right now.';
        setAuditRequestMessage(msg);
      })
      .finally(() => setAuditRevokeLoading(false));
  };

  const handleRequestAudit = () => {
    setAuditRequestMessage('');
    if (auditStatus === 'PENDING' || auditStatus === 'IN_PROGRESS') {
      return;
    }
    if (!profileComplete) {
      setAuditRequestMessage('Complete your restaurant profile before requesting an audit.');
      return;
    }
    if (!evidenceReady) {
      if (!hasAnyEvidence) {
        setAuditRequestMessage('Upload at least one evidence item before requesting an audit.');
      } else {
        setAuditRequestMessage('Your evidence is awaiting review and initial scoring. You can request an audit once some evidence is approved.');
      }
      return;
    }
    setShowAuditConfirm(true);
  };

  const auditButtonLabel = auditStatus === 'PENDING'
    ? 'Audit request pending'
    : auditStatus === 'IN_PROGRESS'
      ? 'Audit in progress'
      : auditRequestLoading
        ? 'Requesting audit…'
        : 'Request auditor visit';

  return (
    <div className="owner-dashboard">
      <h1>Owner dashboard</h1>

      {!profileComplete && (
        <div className="owner-banner owner-banner-danger">
          <span>Complete your restaurant profile to be eligible for audits and verified scoring.</span>
          <Link to="/owner-dashboard/edit" className="owner-banner-link">
            Complete profile
          </Link>
        </div>
      )}

      {profileComplete && !hasAnyEvidence && (
        <div className="owner-banner owner-banner-warning">
          <span>Upload evidence so admins and auditors can review and score your restaurant.</span>
          <Link to="/owner-dashboard/evidence/upload" className="owner-banner-link">
            Upload evidence
          </Link>
        </div>
      )}

      {profileComplete && allPending && (
        <div className="owner-banner owner-banner-warning">
          <span>
            We’ve received your evidence. It is pending review and initial scoring by the team.
            You’ll be able to request an audit once some evidence is approved.
          </span>
          <Link to="/owner-dashboard/evidence" className="owner-banner-link">
            View submitted evidence
          </Link>
        </div>
      )}

      {scoreData && (
        <div className="owner-card owner-score-card">
          <h2>Credibility score</h2>
          <div className="owner-score-main">
            <span className="owner-score-value">
              {overall != null ? `${Math.round(overall)}/100` : '—'}
            </span>
            <span className={`owner-score-badge ${badge === 'AUDITOR_VERIFIED' ? 'auditor-verified' : ''}`}>
              {badge === 'AUDITOR_VERIFIED' ? 'Auditor verified' : 'Provisional'}
            </span>
            {badge === 'AUDITOR_VERIFIED' && auditPublishedAt && (
              <span className="owner-score-audit-date">
                Audit completed{' '}
                {new Date(auditPublishedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
          {lastAudit && (
            <p className="owner-meta">Last reviewed: {new Date(lastAudit).toLocaleDateString()}</p>
          )}
          {scoreData?.auditor_visit_published && (
            <p className="owner-meta owner-audit-verified-note">
              Your published credibility includes a verified on-site auditor visit.
            </p>
          )}
          {categories.filter((c) => c.is_applicable && c.score != null).length > 0 && (
            <div className="owner-score-breakdown">
              <strong>Category breakdown</strong>
              <ul>
                {categories
                  .filter((c) => c.is_applicable && c.score != null)
                  .map((c) => (
                    <li key={c.name}>
                      {c.name}: {Math.round(c.score)}/100
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="owner-score-suggestions">
              <strong>Suggestions</strong>
              <ul>
                {suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {evidenceCounts.total != null && (
            <p className="owner-meta">
              Evidence: {evidenceCounts.approved ?? 0} approved, {evidenceCounts.pending ?? 0} pending
            </p>
          )}
        </div>
      )}

      <div className="owner-card">
        <h2>{restaurant.name}</h2>
        <p><strong>Address:</strong> {restaurant.address}, {restaurant.city}</p>
        {restaurant.phone && <p><strong>Phone:</strong> <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a></p>}
        {restaurant.operating_hours && <p><strong>Hours:</strong> {restaurant.operating_hours}</p>}
        {restaurant.google_maps_link && (
          <p>
            <a href={restaurant.google_maps_link} target="_blank" rel="noreferrer">View on Google Maps</a>
          </p>
        )}
        <p><strong>Status:</strong> <span className={`owner-status ${restaurant.status.toLowerCase()}`}>{restaurant.status}</span></p>
        <p className="owner-meta">Created: {new Date(restaurant.created_at).toLocaleDateString()}</p>
        <div className="owner-card-actions">
          <Link to="/owner-dashboard/edit" className="owner-btn owner-btn-edit">Edit restaurant</Link>
          <Link to="/owner-dashboard/photos" className="owner-btn owner-btn-photos">Manage photos</Link>
          <Link to="/owner-dashboard/evidence" className="owner-btn owner-btn-photos">Manage evidence</Link>
          <Link to="/owner-dashboard/evidence/upload" className="owner-btn owner-btn-photos">Upload evidence</Link>
          <Link
            to={`/restaurants/${restaurant.id}`}
            className="owner-btn owner-btn-view"
          >
            View public listing →
          </Link>
        </div>
      </div>

      <div className="owner-card owner-feedback-card">
        <h2>Private visitor feedback</h2>
        <p className="owner-meta">
          Messages from logged-in visitors on your public listing. These are not shown to anyone else.
        </p>
        {privateFeedback == null ? (
          <p className="owner-meta">Loading…</p>
        ) : privateFeedback.length === 0 ? (
          <p className="owner-meta">No private feedback yet.</p>
        ) : (
          <ul className="owner-feedback-list">
            {privateFeedback.map((f) => (
              <li key={f.id} className="owner-feedback-item">
                <div className="owner-feedback-meta">
                  <strong>{f.author_name || 'Visitor'}</strong>
                  {f.author_email && (
                    <a href={`mailto:${f.author_email}`} className="owner-feedback-email">
                      {f.author_email}
                    </a>
                  )}
                  {f.created_at && (
                    <span className="owner-feedback-date">
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="owner-feedback-body">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="owner-card owner-audit-card">
        <h2>Audits & verification</h2>
        <p className="owner-meta">
          Request an on-site audit by a certified auditor once your profile and evidence are ready.
          You can request a new visit after any previous visit is finished and published—only one active
          request at a time.
        </p>
        <p className="owner-audit-total">
          <strong>Published on-site audits:</strong>{' '}
          {auditHistory?.total_published_audits != null ? auditHistory.total_published_audits : '—'}
        </p>
        {auditHistory?.visits?.length > 0 && (
          <div className="owner-audit-table-wrap">
            <table className="owner-audit-table">
              <thead>
                <tr>
                  <th scope="col">Auditor</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {auditHistory.visits.map((v) => (
                  <tr key={v.work_item_id}>
                    <td>{v.auditor_name || '—'}</td>
                    <td>
                      {v.published_at
                        ? new Date(v.published_at).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>
                      {v.overall_score != null ? `${Math.round(v.overall_score)}/100` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {auditHistory && auditHistory.visits?.length === 0 && (
          <p className="owner-meta owner-audit-empty">No published on-site audits yet.</p>
        )}
        <div className="owner-audit-request">
          <button
            type="button"
            className="owner-btn owner-btn-audit"
            onClick={handleRequestAudit}
            disabled={auditRequestLoading || auditRevokeLoading || auditStatus === 'PENDING' || auditStatus === 'IN_PROGRESS'}
          >
            {auditButtonLabel}
          </button>
          {auditCanRevoke && (
            <button
              type="button"
              className="owner-btn owner-btn-view"
              onClick={handleRevokeAudit}
              disabled={auditRequestLoading || auditRevokeLoading}
            >
              {auditRevokeLoading ? 'Revoking…' : 'Revoke request'}
            </button>
          )}
          {auditRequestMessage && <p className="owner-meta owner-audit-message">{auditRequestMessage}</p>}
        </div>
      </div>
      {showAuditConfirm && (
        <div className="owner-audit-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="owner-audit-confirm-title">
          <div className="owner-audit-modal">
            <h3 id="owner-audit-confirm-title">Send audit request?</h3>
            <p>This will send your restaurant to all auditors&apos; pending work queue.</p>
            <div className="owner-audit-modal-actions">
              <button type="button" className="owner-btn owner-btn-view" onClick={() => setShowAuditConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="owner-btn owner-btn-audit" onClick={submitAuditRequest} disabled={auditRequestLoading}>
                {auditRequestLoading ? 'Requesting audit…' : 'Confirm request'}
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="owner-intro">Your restaurant is active. Upload evidence and get it reviewed to improve your credibility score.</p>
    </div>
  );
}
