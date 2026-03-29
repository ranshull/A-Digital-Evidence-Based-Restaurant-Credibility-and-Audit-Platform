import { useState, useEffect, useCallback } from 'react';
import { superadmin } from '../../api';
import './SuperAdminAssignments.css';

const SORT_OPTIONS = [
  { value: 'accepted_work_desc', label: 'Accepted work (high → low)' },
  { value: 'accepted_work_asc', label: 'Accepted work (low → high)' },
  { value: 'name_asc', label: 'Name (A → Z)' },
  { value: 'name_desc', label: 'Name (Z → A)' },
];

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'AUDITOR', label: 'Auditor' },
];

const MONTHS = [
  { value: '', label: 'All' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' }) })),
];

const currentYear = new Date().getFullYear();
const YEARS = [
  { value: '', label: 'Total' },
  ...Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) })),
];

const DAYS = [
  { value: '', label: 'All' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
];

export default function SuperAdminAssignments() {
  const [staff, setStaff] = useState([]);
  const [staffForAssign, setStaffForAssign] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unassignedLoading, setUnassignedLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(null);

  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('accepted_work_desc');

  const fetchStaff = useCallback(() => {
    setLoading(true);
    const params = { sort };
    if (year) params.year = year;
    if (month) params.month = month;
    if (day) params.day = day;
    if (role) params.role = role;
    if (search) params.search = search;
    superadmin.staffWorkload(params)
      .then(({ data }) => setStaff(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load staff'))
      .finally(() => setLoading(false));
  }, [sort, year, month, day, role, search]);

  const fetchUnassigned = useCallback(() => {
    setUnassignedLoading(true);
    superadmin.unassignedWork()
      .then(({ data }) => setUnassigned(Array.isArray(data) ? data : []))
      .catch(() => setUnassigned([]))
      .finally(() => setUnassignedLoading(false));
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchUnassigned();
  }, [fetchUnassigned]);

  useEffect(() => {
    superadmin.staffWorkload({})
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        // For admin work (evidence review / scoring), only allow assigning to Admins
        setStaffForAssign(list.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'));
      })
      .catch(() => setStaffForAssign([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleAssign = (restaurantId, restaurantName, userId) => {
    if (!userId) return;
    setAssigning(restaurantId);
    superadmin.assignWork(restaurantId, userId)
      .then(() => {
        fetchUnassigned();
        fetchStaff();
      })
      .catch((err) => setError(err.response?.data?.detail || 'Assign failed'))
      .finally(() => setAssigning(null));
  };

  return (
    <div className="superadmin-assignments-page">
      <div className="superadmin-assignments-header">
        <h1>Work assignment</h1>
        <p className="superadmin-assignments-sub">
          View staff workload (accepted work count) with date filters and assign unassigned work to anyone.
        </p>
      </div>
      {error && <div className="superadmin-assignments-error">{error}</div>}

      <section className="superadmin-assignments-section">
        <h2>Staff workload</h2>
        <div className="superadmin-assignments-filters">
          <div className="superadmin-assignments-filter-row">
            <label>
              <span>Date</span>
              <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
                {YEARS.map((o) => <option key={o.value || 'total'} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              <span>Month</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={!year} aria-label="Month">
                {MONTHS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              <span>Day</span>
              <select value={day} onChange={(e) => setDay(e.target.value)} disabled={!month} aria-label="Day">
                {DAYS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              <span>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
                {ROLE_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>
              <span>Search</span>
              <input
                type="text"
                placeholder="Name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="superadmin-assignments-search"
                aria-label="Search by name or email"
              />
            </label>
            <label>
              <span>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        {loading ? (
          <p className="superadmin-assignments-loading">Loading staff...</p>
        ) : (
          <div className="superadmin-assignments-table-wrap">
            <table className="superadmin-assignments-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Accepted work</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="superadmin-assignments-empty">No staff match the filters.</td>
                  </tr>
                ) : (
                  staff.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className={`superadmin-assignments-role superadmin-assignments-role-${(u.role || '').toLowerCase()}`}>{u.role}</span></td>
                      <td>{u.accepted_work_count ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="superadmin-assignments-section">
        <h2>Unassigned work</h2>
        <p className="superadmin-assignments-hint">Restaurants with pending evidence that no one has accepted. Assign to an admin or auditor.</p>
        {unassignedLoading ? (
          <p className="superadmin-assignments-loading">Loading...</p>
        ) : unassigned.length === 0 ? (
          <p className="superadmin-assignments-empty">No unassigned work.</p>
        ) : (
          <ul className="superadmin-assignments-unassigned-list">
            {unassigned.map((r) => (
              <li key={r.restaurant_id} className="superadmin-assignments-unassigned-item">
                <span className="superadmin-assignments-unassigned-name">{r.restaurant_name}</span>
                <span className="superadmin-assignments-unassigned-count">{r.pending_evidence_count} pending</span>
                <select
                  className="superadmin-assignments-assign-select"
                  value=""
                  onChange={(e) => {
                    const uid = e.target.value ? Number(e.target.value) : null;
                    if (uid) handleAssign(r.restaurant_id, r.restaurant_name, uid);
                    e.target.value = '';
                  }}
                  disabled={!!assigning}
                  aria-label={`Assign ${r.restaurant_name} to`}
                >
                  <option value="">Assign to…</option>
                  {staffForAssign.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                {assigning === r.restaurant_id && <span className="superadmin-assignments-assigning">Assigning…</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
