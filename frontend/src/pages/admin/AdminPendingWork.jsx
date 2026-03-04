import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '../../api';
import './AdminPendingWork.css';

export default function AdminPendingWork() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);
  const [confirmRestaurant, setConfirmRestaurant] = useState(null);

  const fetchPending = () => {
    setLoading(true);
    admin.pendingWork()
      .then(({ data }) => setRestaurants(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleClick = (r) => {
    if (r.is_assigned_to_me) {
      navigate(`/admin/review/${r.restaurant_id}`);
      return;
    }
    setConfirmRestaurant(r);
  };

  const handleAcceptConfirm = () => {
    if (!confirmRestaurant) return;
    setAcceptingId(confirmRestaurant.restaurant_id);
    admin.acceptWork(confirmRestaurant.restaurant_id)
      .then(() => {
        setConfirmRestaurant(null);
        navigate(`/admin/review/${confirmRestaurant.restaurant_id}`);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to accept work'))
      .finally(() => setAcceptingId(null));
  };

  const handleAcceptCancel = () => setConfirmRestaurant(null);

  if (loading) return <div className="admin-loading">Loading pending work...</div>;
  if (error && restaurants.length === 0) return <div className="admin-error">{error}</div>;

  return (
    <div className="admin-pending-work">
      <h1>My pending work</h1>
      <p className="admin-pending-intro">
        Restaurants with evidence waiting for your review. Click unassigned work to accept it (it will be removed from others&apos; queues).
      </p>
      {error && <div className="admin-error-banner">{error}</div>}
      {restaurants.length === 0 ? (
        <p className="admin-empty">No pending evidence. All clear.</p>
      ) : (
        <ul className="admin-pending-list">
          {restaurants.map((r) => (
            <li key={r.restaurant_id} className="admin-pending-item">
              <button
                type="button"
                className="admin-pending-link"
                onClick={() => handleClick(r)}
                disabled={!!acceptingId}
              >
                <strong>{r.restaurant_name}</strong>
                <span className="admin-pending-badge">{r.pending_count} pending</span>
                {r.is_assigned_to_me && <span className="admin-pending-mine">(yours)</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmRestaurant && (
        <div className="admin-pending-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="accept-work-title">
          <div className="admin-pending-modal">
            <h2 id="accept-work-title">Accept this work?</h2>
            <p>
              <strong>{confirmRestaurant.restaurant_name}</strong> will be assigned to you and removed from other admins&apos; and auditors&apos; pending lists. Only you will be able to review evidence and submit scores for this restaurant.
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
