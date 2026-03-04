import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { admin } from '../../api';
import './AdminApplicationDetail.css';

export default function AdminApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [action, setAction] = useState(null);

  useEffect(() => {
    admin
      .getApplication(id)
      .then(({ data }) => setApp(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = () => {
    setAction('approve');
    admin
      .approve(id, reviewNotes)
      .then(() => navigate('/admin/applications'))
      .catch((err) => setError(err.response?.data?.detail || 'Approve failed'))
      .finally(() => setAction(null));
  };

  const handleReject = () => {
    setAction('reject');
    admin
      .reject(id, reviewNotes)
      .then(() => navigate('/admin/applications'))
      .catch((err) => setError(err.response?.data?.detail || 'Reject failed'))
      .finally(() => setAction(null));
  };

  if (loading) return <div className="admin-loading">Loading...</div>;
  if (error && !app) return <div className="admin-error">{error}</div>;
  if (!app) return null;

  const proofUrls = [
    { label: 'Proof document', url: app.proof_document_url },
    { label: 'Business card', url: app.business_card_url },
    { label: 'Owner photo', url: app.owner_photo_url },
    { label: 'Utility bill', url: app.utility_bill_url },
  ].filter((x) => x.url);

  return (
    <div className="admin-detail-page">
      <div className="admin-detail-header">
        <h1>{app.restaurant_name}</h1>
        <span className={`admin-detail-badge ${app.status.toLowerCase()}`}>{app.status}</span>
      </div>
      {error && <div className="admin-detail-error">{error}</div>}

      <section className="admin-detail-section">
        <h3>Applicant</h3>
        <p><strong>{app.user_name}</strong> — {app.user_email}</p>
      </section>

      <section className="admin-detail-section">
        <h3>Business</h3>
        <p><strong>Address:</strong> {app.business_address}, {app.city}</p>
        {app.landmark && <p><strong>Landmark:</strong> {app.landmark}</p>}
        <p><strong>Google Maps:</strong> <a href={app.google_maps_link} target="_blank" rel="noreferrer">Link</a></p>
      </section>

      <section className="admin-detail-section">
        <h3>Contact</h3>
        <p>{app.contact_person_name} — {app.contact_phone}</p>
        {app.alternate_phone && <p>Alt: {app.alternate_phone}</p>}
        {app.operating_hours && <p>Hours: {app.operating_hours}</p>}
      </section>

      <section className="admin-detail-section">
        <h3>Proof documents</h3>
        <ul className="admin-detail-links">
          {proofUrls.map(({ label, url }) => (
            <li key={url}><a href={url} target="_blank" rel="noreferrer">{label}</a></li>
          ))}
        </ul>
        {(app.storefront_photo_url || app.dining_photo_url) && (
          <>
            <p><strong>Photos:</strong></p>
            {app.storefront_photo_url && <a href={app.storefront_photo_url} target="_blank" rel="noreferrer">Storefront</a>}
            {app.dining_photo_url && <a href={app.dining_photo_url} target="_blank" rel="noreferrer">Dining</a>}
          </>
        )}
      </section>

      {app.review_notes && (
        <section className="admin-detail-section">
          <h3>Review notes</h3>
          <p>{app.review_notes}</p>
          {app.reviewed_at && <p className="admin-detail-meta">Reviewed at {new Date(app.reviewed_at).toLocaleString()}</p>}
        </section>
      )}

      {app.status === 'PENDING' && (
        <section className="admin-detail-actions">
          <h3>Review notes (optional)</h3>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Add notes for the applicant..."
            rows={3}
          />
          <div className="admin-detail-buttons">
            <button type="button" className="btn-approve" onClick={handleApprove} disabled={!!action}>
              {action === 'approve' ? 'Approving...' : 'Approve'}
            </button>
            <button type="button" className="btn-reject" onClick={handleReject} disabled={!!action}>
              {action === 'reject' ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </section>
      )}

      <p className="admin-detail-back">
        <button type="button" onClick={() => navigate('/admin/applications')}>← Back to list</button>
      </p>
    </div>
  );
}
