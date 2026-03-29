import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { admin, rubric } from '../../api';
import EvidenceReviewModal from '../../components/EvidenceReviewModal';
import './AdminEvidenceQueue.css';

export default function AdminEvidenceQueue() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab =
    tabFromUrl === 'completed' || tabFromUrl === 'all' || tabFromUrl === 'active' ? tabFromUrl : 'active';
  const [tab, setTab] = useState(initialTab);
  const [restaurantCards, setRestaurantCards] = useState([]);
  const [historyCards, setHistoryCards] = useState([]);
  const [evidenceRows, setEvidenceRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalEvidence, setModalEvidence] = useState(null);
  const [quickActioning, setQuickActioning] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [confirmRestaurant, setConfirmRestaurant] = useState(null);

  const loadActive = useCallback(() => {
    setLoading(true);
    admin
      .pendingWork()
      .then(({ data }) => setRestaurantCards(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = useCallback(() => {
    setLoading(true);
    admin
      .reviewHistory()
      .then(({ data }) => setHistoryCards(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  const loadEvidenceRows = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    admin.evidence
      .pending(params)
      .then(({ data }) => setEvidenceRows(Array.isArray(data) ? data : data.results || []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load evidence'))
      .finally(() => setLoading(false));
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    setError('');
    if (tab === 'active') loadActive();
    else if (tab === 'completed') loadHistory();
    else loadEvidenceRows();
  }, [tab, loadActive, loadHistory, loadEvidenceRows]);

  useEffect(() => {
    rubric.categories().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'completed' || t === 'all' || t === 'active') setTab(t);
  }, [searchParams]);

  const setTabAndUrl = (next) => {
    setTab(next);
    setSearchParams(next === 'active' ? {} : { tab: next });
  };

  const handleModalAction = (evidenceId, action, notes) => {
    const body = { review_notes: notes };
    const req =
      action === 'approve'
        ? admin.evidence.approve(evidenceId, body)
        : action === 'reject'
          ? admin.evidence.reject(evidenceId, body)
          : admin.evidence.flag(evidenceId, body);
    return req.then(() => {
      setModalEvidence(null);
      loadEvidenceRows();
    });
  };

  const handleQuickApprove = (e, id) => {
    e.preventDefault();
    setQuickActioning(id);
    admin.evidence
      .approve(id, {})
      .then(loadEvidenceRows)
      .catch((err) => setError(err.response?.data?.detail || 'Approve failed'))
      .finally(() => setQuickActioning(null));
  };

  const handleAcceptConfirm = () => {
    if (!confirmRestaurant) return;
    const rid = confirmRestaurant.restaurant_id;
    setAcceptingId(rid);
    admin
      .acceptWork(rid)
      .then(() => {
        setConfirmRestaurant(null);
        navigate(`/admin/evidence/${rid}`);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to accept work'))
      .finally(() => setAcceptingId(null));
  };

  return (
    <div className="admin-evidence-page">
      <h1>Evidence queue</h1>
      <p className="admin-evidence-intro">
        Review owner uploads by restaurant: accept work to claim a restaurant, then review each item and score categories.
      </p>

      <div className="admin-evidence-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={tab === 'active' ? 'active' : ''}
          onClick={() => setTabAndUrl('active')}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'completed'}
          className={tab === 'completed' ? 'active' : ''}
          onClick={() => setTabAndUrl('completed')}
        >
          Completed
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={tab === 'all' ? 'active' : ''}
          onClick={() => setTabAndUrl('all')}
        >
          All evidence rows
        </button>
      </div>

      {error && <div className="admin-evidence-error">{error}</div>}

      {tab === 'active' && (
        <>
          {loading ? (
            <div className="admin-loading">Loading queue...</div>
          ) : restaurantCards.length === 0 ? (
            <p className="admin-evidence-empty">No restaurants with pending evidence in your queue.</p>
          ) : (
            <ul className="admin-evidence-card-grid">
              {restaurantCards.map((r) => (
                <li key={r.restaurant_id} className="admin-evidence-rest-card">
                  <h2 className="admin-evidence-rest-card-title">{r.restaurant_name}</h2>
                  <p className="admin-evidence-rest-card-meta">
                    <span className="admin-evidence-pill">{r.pending_count} pending</span>
                    {r.is_assigned_to_me && <span className="admin-evidence-pill assigned">Assigned to you</span>}
                    {!r.is_assigned_to_me && (
                      <span className="admin-evidence-pill muted">Unclaimed</span>
                    )}
                  </p>
                  <div className="admin-evidence-rest-card-actions">
                    {r.is_assigned_to_me ? (
                      <button
                        type="button"
                        className="admin-evidence-btn primary"
                        onClick={() => navigate(`/admin/evidence/${r.restaurant_id}`)}
                      >
                        Continue review
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-evidence-btn primary"
                        onClick={() => setConfirmRestaurant(r)}
                        disabled={!!acceptingId}
                      >
                        Accept work
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'completed' && (
        <>
          {loading ? (
            <div className="admin-loading">Loading history...</div>
          ) : historyCards.length === 0 ? (
            <p className="admin-evidence-empty">No completed reviews yet.</p>
          ) : (
            <ul className="admin-evidence-card-grid">
              {historyCards.map((r) => (
                <li key={r.restaurant_id} className="admin-evidence-rest-card readonly">
                  <h2 className="admin-evidence-rest-card-title">{r.restaurant_name}</h2>
                  <p className="admin-evidence-rest-card-meta">
                    {r.review_completed_at && (
                      <span className="admin-evidence-pill muted">
                        {new Date(r.review_completed_at).toLocaleString()}
                      </span>
                    )}
                    {r.completed_by_name && (
                      <span className="admin-evidence-pill muted">By {r.completed_by_name}</span>
                    )}
                  </p>
                  {r.credibility_score != null && (
                    <p className="admin-evidence-summary-line">
                      <strong>Score:</strong> {r.credibility_score.toFixed(1)}
                    </p>
                  )}
                  {r.evidence_counts && (
                    <p className="admin-evidence-summary-line">
                      Evidence: {r.evidence_counts.approved ?? 0} approved, {r.evidence_counts.pending ?? 0}{' '}
                      pending, {r.evidence_counts.flagged ?? 0} flagged, {r.evidence_counts.rejected ?? 0}{' '}
                      rejected
                    </p>
                  )}
                  {Array.isArray(r.score_breakdown) && r.score_breakdown.length > 0 && (
                    <ul className="admin-evidence-breakdown">
                      {r.score_breakdown.map((row, i) => (
                        <li key={i}>
                          {row.name}:{' '}
                          {row.is_applicable && row.score != null ? `${Number(row.score).toFixed(1)}` : 'N/A'}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'all' && (
        <>
          <div className="admin-evidence-filters">
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="FLAGGED">Flagged</option>
              </select>
            </label>
            <label>
              Category
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <div className="admin-loading">Loading evidence...</div>
          ) : (
            <div className="admin-evidence-table-wrap">
              <table className="admin-evidence-table">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Restaurant</th>
                    <th>Category</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No evidence found.</td>
                    </tr>
                  ) : (
                    evidenceRows.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.file_type === 'IMAGE' ? (
                            <img src={e.file_url} alt="" className="admin-evidence-thumb" />
                          ) : (
                            <div className="admin-evidence-thumb admin-evidence-thumb-video">Video</div>
                          )}
                        </td>
                        <td>
                          <Link to={`/admin/evidence/${e.restaurant}`}>{e.restaurant_name}</Link>
                        </td>
                        <td>{e.category_name}</td>
                        <td>{new Date(e.upload_timestamp).toLocaleString()}</td>
                        <td>
                          <span className={`admin-evidence-status ${e.status.toLowerCase()}`}>{e.status}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-evidence-btn view"
                            onClick={() => setModalEvidence(e)}
                          >
                            View
                          </button>
                          {e.status === 'PENDING' && (
                            <button
                              type="button"
                              className="admin-evidence-btn approve"
                              onClick={(ev) => handleQuickApprove(ev, e.id)}
                              disabled={quickActioning === e.id}
                            >
                              {quickActioning === e.id ? '...' : 'Approve'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {confirmRestaurant && (
        <div className="admin-evidence-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="accept-ev-title">
          <div className="admin-evidence-modal">
            <h2 id="accept-ev-title">Accept this work?</h2>
            <p>
              <strong>{confirmRestaurant.restaurant_name}</strong> will be assigned to you. You can then review
              all evidence and scoring for this restaurant.
            </p>
            <div className="admin-evidence-modal-actions">
              <button
                type="button"
                className="admin-evidence-btn-cancel"
                onClick={() => setConfirmRestaurant(null)}
                disabled={!!acceptingId}
              >
                Cancel
              </button>
              <button type="button" className="admin-evidence-btn-accept" onClick={handleAcceptConfirm} disabled={!!acceptingId}>
                {acceptingId ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEvidence && (
        <EvidenceReviewModal
          evidence={modalEvidence}
          onClose={() => setModalEvidence(null)}
          onAction={handleModalAction}
        />
      )}
    </div>
  );
}
