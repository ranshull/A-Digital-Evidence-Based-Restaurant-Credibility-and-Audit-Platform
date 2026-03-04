import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { evidence } from '../api';
import './OwnerEvidenceList.css';

const STATUS_CLASS = {
  PENDING: 'evidence-status-pending',
  APPROVED: 'evidence-status-approved',
  REJECTED: 'evidence-status-rejected',
  FLAGGED: 'evidence-status-flagged',
};

export default function OwnerEvidenceList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    evidence
      .listMine()
      .then(({ data }) => setList(data.results ?? data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load evidence'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = (id) => {
    if (!window.confirm('Delete this evidence?')) return;
    evidence
      .delete(id)
      .then(load)
      .catch((err) => setError(err.response?.data?.detail || 'Delete failed'));
  };

  const total = list.length;
  const pending = list.filter((e) => e.status === 'PENDING').length;
  const approved = list.filter((e) => e.status === 'APPROVED').length;
  const rejected = list.filter((e) => e.status === 'REJECTED').length;

  if (loading) return <div className="owner-evidence-loading">Loading evidence...</div>;
  if (error) return <div className="owner-evidence-error">{error}</div>;

  return (
    <div className="owner-evidence-list">
      <h1>Evidence</h1>
      <div className="owner-evidence-stats">
        <span>Total: {total}</span>
        <span className="evidence-status-pending">Pending: {pending}</span>
        <span className="evidence-status-approved">Approved: {approved}</span>
        <span className="evidence-status-rejected">Rejected: {rejected}</span>
      </div>
      <div className="owner-evidence-list-actions">
        <Link to="/owner-dashboard/evidence/upload" className="owner-btn owner-btn-edit">
          Upload New Evidence
        </Link>
        <Link to="/owner-dashboard" className="owner-btn owner-btn-view">Back to dashboard</Link>
      </div>
      <div className="owner-evidence-table-wrap">
        <table className="owner-evidence-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Category</th>
              <th>Upload date</th>
              <th>Status</th>
              <th>Admin notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6}>No evidence yet. Upload evidence to get your restaurant scored.</td>
              </tr>
            ) : (
              list.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.file_type === 'IMAGE' ? (
                      <img src={e.file_url} alt="" className="owner-evidence-thumb" />
                    ) : (
                      <div className="owner-evidence-thumb owner-evidence-thumb-video">Video</div>
                    )}
                  </td>
                  <td>{e.category_name}</td>
                  <td>{new Date(e.upload_timestamp).toLocaleDateString()}</td>
                  <td>
                    <span className={`evidence-status ${STATUS_CLASS[e.status] || ''}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="owner-evidence-notes">{e.review_notes || '—'}</td>
                  <td>
                    {e.status === 'PENDING' && (
                      <button
                        type="button"
                        className="owner-evidence-delete-btn"
                        onClick={() => handleDelete(e.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
