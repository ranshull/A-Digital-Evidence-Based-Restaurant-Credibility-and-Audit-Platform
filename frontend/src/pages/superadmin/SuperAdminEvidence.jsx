import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { superadmin, restaurants, rubric } from '../../api';
import './SuperAdminEvidence.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function SuperAdminEvidence() {
  const [list, setList] = useState([]);
  const [restaurantsList, setRestaurantsList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [restaurantFilter, setRestaurantFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvidence = () => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    if (restaurantFilter) params.restaurant_id = restaurantFilter;
    setLoading(true);
    setError('');
    superadmin
      .listEvidence(params)
      .then(({ data }) => setList(Array.isArray(data) ? data : data?.results || []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load evidence'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvidence();
  }, [statusFilter, categoryFilter, restaurantFilter]);

  useEffect(() => {
    superadmin.evidenceSummary().then(({ data }) => setSummary(data)).catch(() => setSummary(null));
  }, [list]);

  useEffect(() => {
    restaurants.list().then(({ data }) => {
      const items = data?.results ?? data ?? [];
      setRestaurantsList(Array.isArray(items) ? items : []);
    }).catch(() => setRestaurantsList([]));
  }, []);

  useEffect(() => {
    rubric.categories().then(({ data }) => setCategories(Array.isArray(data) ? data : [])).catch(() => setCategories([]));
  }, []);

  return (
    <div className="superadmin-evidence-page">
      <div className="superadmin-evidence-header">
        <h1>Evidence</h1>
        <p className="superadmin-evidence-sub">
          All evidence across restaurants. Open an item to view details and run cryptographic checks.
        </p>
      </div>

      {summary && (
        <div className="superadmin-evidence-summary">
          <span className="superadmin-evidence-summary-item">
            <strong>Total evidence:</strong> {summary.total_evidence}
          </span>
          <span className="superadmin-evidence-summary-item">
            <strong>Cryptographically verified:</strong> {summary.cryptographically_verified_count}
          </span>
          <span className="superadmin-evidence-summary-item">
            <strong>Chains invalid:</strong> {summary.hash_chains_invalid_count}
          </span>
        </div>
      )}

      <div className="superadmin-evidence-filters">
        <label>
          <span>Restaurant</span>
          <select
            value={restaurantFilter}
            onChange={(e) => setRestaurantFilter(e.target.value)}
            aria-label="Filter by restaurant"
          >
            <option value="">All</option>
            {restaurantsList.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="FLAGGED">Flagged</option>
          </select>
        </label>
      </div>

      {error && <div className="superadmin-evidence-error">{error}</div>}

      {loading ? (
        <p className="superadmin-evidence-loading">Loading evidence...</p>
      ) : list.length === 0 ? (
        <p className="superadmin-evidence-empty">No evidence found.</p>
      ) : (
        <div className="superadmin-evidence-table-wrap">
          <table className="superadmin-evidence-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Restaurant</th>
                <th>Category</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Crypto</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    {ev.file_type === 'IMAGE' ? (
                      <img
                        src={ev.file_url}
                        alt=""
                        className="superadmin-evidence-thumb"
                      />
                    ) : (
                      <span className="superadmin-evidence-video-label">Video</span>
                    )}
                  </td>
                  <td>{ev.restaurant_name || ev.restaurant}</td>
                  <td>{ev.category_name || ev.category}</td>
                  <td>{formatDate(ev.upload_timestamp)}</td>
                  <td>
                    <span className={`superadmin-evidence-status superadmin-evidence-status-${(ev.status || '').toLowerCase()}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td>
                    {ev.is_cryptographically_verified ? (
                      <span className="superadmin-evidence-crypto-ok">Verified</span>
                    ) : (
                      <span className="superadmin-evidence-crypto-na">—</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/superadmin/evidence/${ev.id}`} className="superadmin-evidence-link">
                      View & verify
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
