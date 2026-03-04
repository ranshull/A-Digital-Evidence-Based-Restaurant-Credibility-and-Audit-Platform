import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin, rubric } from '../../api';
import EvidenceReviewModal from '../../components/EvidenceReviewModal';
import './AdminEvidenceQueue.css';

export default function AdminEvidenceQueue() {
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalEvidence, setModalEvidence] = useState(null);
  const [quickActioning, setQuickActioning] = useState(null);

  const loadEvidence = () => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    admin.evidence
      .pending(params)
      .then(({ data }) => setList(Array.isArray(data) ? data : data.results || []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadEvidence();
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    rubric.categories().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

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
      loadEvidence();
    });
  };

  const handleQuickApprove = (e, id) => {
    e.preventDefault();
    setQuickActioning(id);
    admin.evidence
      .approve(id, {})
      .then(loadEvidence)
      .catch((err) => setError(err.response?.data?.detail || 'Approve failed'))
      .finally(() => setQuickActioning(null));
  };

  return (
    <div className="admin-evidence-page">
      <h1>Evidence queue</h1>
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
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <Link to="/admin/scoring" className="admin-evidence-link">Score restaurants →</Link>
      </div>
      {error && <div className="admin-evidence-error">{error}</div>}
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
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6}>No evidence found.</td>
                </tr>
              ) : (
                list.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.file_type === 'IMAGE' ? (
                        <img src={e.file_url} alt="" className="admin-evidence-thumb" />
                      ) : (
                        <div className="admin-evidence-thumb admin-evidence-thumb-video">Video</div>
                      )}
                    </td>
                    <td>
                      <Link to={`/admin/scoring?restaurant=${e.restaurant}`}>{e.restaurant_name}</Link>
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
