import { useState } from 'react';
import './EvidenceReviewModal.css';

export default function EvidenceReviewModal({ evidence, onClose, onAction }) {
  const [notes, setNotes] = useState('');
  const [actioning, setActioning] = useState(null);

  if (!evidence) return null;

  const handleAction = (action) => {
    if ((action === 'reject' || action === 'flag') && !notes.trim()) return;
    setActioning(action);
    onAction(evidence.id, action, notes.trim())
      .finally(() => setActioning(null));
  };

  return (
    <div className="evidence-modal-overlay" onClick={onClose}>
      <div className="evidence-modal" onClick={(e) => e.stopPropagation()}>
        <div className="evidence-modal-header">
          <h2>Review evidence</h2>
          <button type="button" className="evidence-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="evidence-modal-body">
          <p className="evidence-modal-meta">
            <strong>{evidence.restaurant_name}</strong> — {evidence.category_name} · {new Date(evidence.upload_timestamp).toLocaleString()}
          </p>
          <p className="evidence-modal-meta">
            {evidence.original_filename} · {(evidence.file_size_bytes / 1024).toFixed(1)} KB
          </p>
          <div className="evidence-modal-media">
            {evidence.file_type === 'IMAGE' ? (
              <img src={evidence.file_url} alt="" />
            ) : (
              <video src={evidence.file_url} controls />
            )}
          </div>
          <div className="evidence-modal-description">
            <strong>Description</strong>
            <p>{evidence.description}</p>
          </div>
          <div className="evidence-modal-notes">
            <label>Notes (required for Reject / Flag)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add review notes..."
              rows={3}
            />
          </div>
        </div>
        <div className="evidence-modal-actions">
          <button
            type="button"
            className="evidence-modal-btn approve"
            onClick={() => handleAction('approve')}
            disabled={!!actioning}
          >
            {actioning === 'approve' ? '...' : 'Approve'}
          </button>
          <button
            type="button"
            className="evidence-modal-btn reject"
            onClick={() => handleAction('reject')}
            disabled={!!actioning || !notes.trim()}
          >
            {actioning === 'reject' ? '...' : 'Reject'}
          </button>
          <button
            type="button"
            className="evidence-modal-btn flag"
            onClick={() => handleAction('flag')}
            disabled={!!actioning || !notes.trim()}
          >
            {actioning === 'flag' ? '...' : 'Flag'}
          </button>
        </div>
      </div>
    </div>
  );
}
