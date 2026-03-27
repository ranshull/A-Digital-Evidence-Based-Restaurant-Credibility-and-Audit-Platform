import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { admin } from '../../api';

export default function AdminAuditWorkDetail() {
  const { workId } = useParams();
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingDone, setMarkingDone] = useState(false);

  const load = () => {
    setLoading(true);
    admin.getAuditWork(workId)
      .then(({ data }) => setWork(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load work item'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [workId]);

  const handleDone = () => {
    setMarkingDone(true);
    admin.markAuditWorkDone(workId)
      .then(load)
      .catch((err) => setError(err.response?.data?.detail || 'Failed to mark done'))
      .finally(() => setMarkingDone(false));
  };

  if (loading) return <div className="admin-loading">Loading work...</div>;
  if (error && !work) return <div className="admin-error">{error}</div>;
  if (!work) return null;

  return (
    <div className="admin-pending-work">
      <h1>Work detail</h1>
      {error && <div className="admin-error-banner">{error}</div>}
      <div className="admin-pending-item">
        <div className="admin-pending-link">
          <strong>{work.restaurant_name}</strong>
          <span className="admin-pending-owner">Owner: {work.owner_name}</span>
          <span className={`admin-pending-status admin-pending-status-${(work.status || '').toLowerCase()}`}>
            {work.status}
          </span>
        </div>
      </div>
      <p className="admin-pending-owner">Placeholder page for assigned work content.</p>
      {work.status !== 'DONE' && (
        <button
          type="button"
          className="admin-pending-btn-accept"
          onClick={handleDone}
          disabled={markingDone}
        >
          {markingDone ? 'Marking...' : 'Mark as done'}
        </button>
      )}
      <p style={{ marginTop: '1rem' }}>
        <Link to="/admin/review">Back to pending work</Link>
      </p>
    </div>
  );
}
