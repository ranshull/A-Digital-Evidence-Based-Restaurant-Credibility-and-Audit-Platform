import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '../../api';
import './AdminPendingWork.css';

export default function AdminPendingWork() {
  const navigate = useNavigate();
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);
  const [confirmWork, setConfirmWork] = useState(null);

  const fetchPending = () => {
    setLoading(true);
    admin.auditWork()
      .then(({ data }) => setWorkItems(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleClick = (w) => {
    if (w.is_assigned_to_me || w.status === 'DONE') {
      navigate(`/admin/review/work/${w.work_item_id}`);
      return;
    }
    setConfirmWork(w);
  };

  const handleAcceptConfirm = () => {
    if (!confirmWork) return;
    setAcceptingId(confirmWork.work_item_id);
    admin.acceptAuditWork(confirmWork.work_item_id)
      .then(() => {
        setConfirmWork(null);
        navigate(`/admin/review/work/${confirmWork.work_item_id}`);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to accept work'))
      .finally(() => setAcceptingId(null));
  };

  const handleAcceptCancel = () => setConfirmWork(null);

  if (loading) return <div className="admin-loading">Loading audit visit requests...</div>;
  if (error && workItems.length === 0) return <div className="admin-error">{error}</div>;

  return (
    <div className="admin-pending-work">
      <h1>Audit visit requests</h1>
      <p className="admin-pending-intro">
        Restaurants that requested an on-site auditor visit. Click a card to accept or open it.
      </p>
      {error && <div className="admin-error-banner">{error}</div>}
      {workItems.length === 0 ? (
        <p className="admin-empty">No audit visit requests right now. Owners will appear here when they request an on-site visit.</p>
      ) : (
        <ul className="admin-pending-list">
          {workItems.map((w) => (
            <li key={w.work_item_id} className="admin-pending-item">
              <button
                type="button"
                className="admin-pending-link"
                onClick={() => handleClick(w)}
                disabled={!!acceptingId}
              >
                <strong>{w.restaurant_name}</strong>
                <span className="admin-pending-owner">Owner: {w.owner_name}</span>
                <span className={`admin-pending-status admin-pending-status-${(w.status || '').toLowerCase()}`}>
                  {w.status}
                </span>
                {w.is_assigned_to_me && <span className="admin-pending-mine">(yours)</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmWork && (
        <div className="admin-pending-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="accept-work-title">
          <div className="admin-pending-modal">
            <h2 id="accept-work-title">Accept this work?</h2>
            <p>
              <strong>{confirmWork.restaurant_name}</strong> will be assigned to you and removed from other auditors&apos; pending lists.
            </p>
            <div className="admin-pending-modal-actions">
              <button type="button" className="admin-pending-btn-cancel" onClick={handleAcceptCancel} disabled={!!acceptingId}>
                Cancel
              </button>
              <button type="button" className="admin-pending-btn-accept" onClick={handleAcceptConfirm} disabled={!!acceptingId}>
                {acceptingId ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
