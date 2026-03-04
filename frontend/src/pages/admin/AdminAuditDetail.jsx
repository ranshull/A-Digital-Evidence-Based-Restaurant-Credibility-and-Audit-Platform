import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAudits, rubric } from '../../api';
import './AdminAudits.css';

export default function AdminAuditDetail() {
  const { id } = useParams();
  const auditId = Number(id);
  const [audit, setAudit] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    if (!auditId) return;
    setLoading(true);
    Promise.all([
      adminAudits.get(auditId),
      adminAudits.listEvidence(auditId),
      rubric.categories(),
    ])
      .then(([auditRes, evidenceRes, rubricRes]) => {
        setAudit(auditRes.data);
        setEvidence(Array.isArray(evidenceRes.data) ? evidenceRes.data : []);
        setCategories(rubricRes.data || []);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load audit'))
      .finally(() => setLoading(false));
  }, [auditId]);

  const handleApprove = () => {
    setActionLoading(true);
    adminAudits.approve(auditId, reviewNotes)
      .then(({ data }) => setAudit(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to approve audit'))
      .finally(() => setActionLoading(false));
  };

  const handleReject = () => {
    setActionLoading(true);
    adminAudits.reject(auditId, reviewNotes)
      .then(({ data }) => setAudit(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to reject audit'))
      .finally(() => setActionLoading(false));
  };

  if (loading) return <div className="admin-loading">Loading audit...</div>;
  if (error && !audit) return <div className="admin-error">{error}</div>;
  if (!audit) return null;

  const evidenceByCategory = categories.reduce((acc, c) => {
    acc[c.id] = [];
    return acc;
  }, {});
  evidence.forEach((e) => {
    if (!evidenceByCategory[e.category]) evidenceByCategory[e.category] = [];
    evidenceByCategory[e.category].push(e);
  });

  const isPending = audit.status === 'SUBMITTED_BY_AUDITOR';

  return (
    <div className="admin-audits-page">
      <p className="admin-audits-back">
        <Link to="/admin/audits">← Back to audits list</Link>
      </p>
      <h1>Audit review for {audit.restaurant_name}</h1>
      <p className="admin-audits-meta">
        Status: <strong>{audit.status}</strong>
        {audit.assigned_to_name && <> · Auditor: {audit.assigned_to_name}</>}
      </p>
      {error && <div className="admin-error">{error}</div>}

      <section className="admin-audits-section">
        <h2>Evidence by category</h2>
        <div className="admin-audits-category-grid">
          {categories.map((cat) => (
            <div key={cat.id} className="admin-audits-category-card">
              <h3>{cat.name}</h3>
              <p className="admin-audits-category-desc">{cat.description}</p>
              {evidenceByCategory[cat.id] && evidenceByCategory[cat.id].length > 0 ? (
                <div className="admin-audits-evidence-thumbs">
                  {evidenceByCategory[cat.id].map((e) =>
                    e.file_type === 'IMAGE' ? (
                      <a key={e.id} href={e.file_url} target="_blank" rel="noreferrer">
                        <img src={e.file_url} alt={e.description || ''} />
                      </a>
                    ) : (
                      <a key={e.id} href={e.file_url} target="_blank" rel="noreferrer" className="admin-audits-video">Video</a>
                    )
                  )}
                </div>
              ) : (
                <p className="admin-empty">No evidence for this category.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-audits-section">
        <h2>Admin decision</h2>
        <textarea
          rows={3}
          className="admin-audits-notes"
          placeholder="Review notes (optional, but recommended)"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
        />
        <div className="admin-audits-actions">
          <button
            type="button"
            className="admin-audits-btn admin-audits-btn-approve"
            onClick={handleApprove}
            disabled={!isPending || actionLoading}
          >
            {actionLoading ? 'Working...' : 'Approve and apply scores'}
          </button>
          <button
            type="button"
            className="admin-audits-btn admin-audits-btn-reject"
            onClick={handleReject}
            disabled={!isPending || actionLoading}
          >
            Reject audit
          </button>
        </div>
      </section>
    </div>
  );
}

