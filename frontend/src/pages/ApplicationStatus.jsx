import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { owner } from '../api';
import './ApplicationStatus.css';

export default function ApplicationStatus() {
  const [data, setData] = useState({ applications: [], latest: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    owner
      .applicationStatus()
      .then(({ data: res }) => setData(res))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="status-loading">Loading application status...</div>;
  if (error) return <div className="status-error">{error}</div>;

  const { latest, applications } = data;

  if (!latest && applications.length === 0) {
    return (
      <div className="status-empty">
        <h2>No application yet</h2>
        <p>Submit an application to request owner access.</p>
        <Link to="/apply" className="status-cta">Apply now</Link>
      </div>
    );
  }

  const formatVal = (v) => (v == null || String(v).trim() === '' ? '—' : String(v).trim());

  return (
    <div className="status-page">
      <h1>My application status</h1>
      {latest && (
        <>
          <p className="status-intro">You have already filled the form. Below is a summary of what you submitted.</p>
          <div className={`status-card status-${latest.status.toLowerCase()}`}>
            <div className="status-header">
              <h2>{latest.restaurant_name}</h2>
              <span className="status-badge">{latest.status}</span>
            </div>
            <p className="status-meta">Submitted: {new Date(latest.submitted_at).toLocaleString()}</p>
            {latest.reviewed_at && (
              <p className="status-meta">Reviewed: {new Date(latest.reviewed_at).toLocaleString()}</p>
            )}
            {latest.review_notes && (
              <div className="status-notes">
                <strong>Review notes:</strong> {latest.review_notes}
              </div>
            )}
            {latest.status === 'PENDING' && (
              <p className="status-pending-msg">Your application is under review. You will be notified once processed.</p>
            )}
            {latest.status === 'APPROVED' && (
              <p className="status-approved-msg">Your application was approved. You now have owner dashboard access.</p>
            )}
            {latest.status === 'REJECTED' && (
              <p className="status-rejected-msg">Your application was rejected. You may submit a new application with updated details.</p>
            )}
          </div>

          <section className="status-summary">
            <h3 className="status-summary-title">Form summary</h3>
            <dl className="status-summary-list">
              <dt>Restaurant name</dt>
              <dd>{formatVal(latest.restaurant_name)}</dd>
              <dt>Business address</dt>
              <dd>{formatVal(latest.business_address)}</dd>
              <dt>City</dt>
              <dd>{formatVal(latest.city)}</dd>
              <dt>Google Maps link</dt>
              <dd>
                {latest.google_maps_link ? (
                  <a href={latest.google_maps_link} target="_blank" rel="noreferrer" className="status-summary-link">View on map</a>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Landmark</dt>
              <dd>{formatVal(latest.landmark)}</dd>
              <dt>Contact person</dt>
              <dd>{formatVal(latest.contact_person_name)}</dd>
              <dt>Contact phone</dt>
              <dd>{formatVal(latest.contact_phone)}</dd>
              <dt>Alternate phone</dt>
              <dd>{formatVal(latest.alternate_phone)}</dd>
              <dt>Operating hours</dt>
              <dd>{formatVal(latest.operating_hours)}</dd>
              <dt>Proof document</dt>
              <dd>{latest.proof_document_url ? <a href={latest.proof_document_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Business card</dt>
              <dd>{latest.business_card_url ? <a href={latest.business_card_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Owner photo</dt>
              <dd>{latest.owner_photo_url ? <a href={latest.owner_photo_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Utility bill</dt>
              <dd>{latest.utility_bill_url ? <a href={latest.utility_bill_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Storefront photo</dt>
              <dd>{latest.storefront_photo_url ? <a href={latest.storefront_photo_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Dining area photo</dt>
              <dd>{latest.dining_photo_url ? <a href={latest.dining_photo_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Declaration accepted</dt>
              <dd>{latest.declaration_accepted ? 'Yes' : '—'}</dd>
            </dl>
          </section>

          <div className="status-actions">
            <Link to="/apply" className="status-cta">Update application</Link>
          </div>
        </>
      )}
      {applications.length > 1 && (
        <div className="status-history">
          <h3>Previous applications</h3>
          <ul>
            {applications.slice(1).map((app) => (
              <li key={app.id}>
                {app.restaurant_name} — {app.status} ({new Date(app.submitted_at).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
