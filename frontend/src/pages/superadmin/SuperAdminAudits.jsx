import { useState, useEffect } from 'react';
import { superadmin, superadminAudits } from '../../api';
import './SuperAdminAudits.css';

const STATUS_OPTIONS = [
  { value: 'REQUESTED', label: 'Requested (unassigned)' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: '', label: 'All' },
];

export default function SuperAdminAudits() {
  const [audits, setAudits] = useState([]);
  const [auditors, setAuditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('REQUESTED');

  const loadAudits = (status) => {
    setLoading(true);
    setError('');
    const params = {};
    if (status) params.status = status;
    superadminAudits
      .list(params)
      .then(({ data }) => setAudits(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load audits'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAudits(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    // Load all auditors to populate the assign dropdown
    superadmin
      .listUsers({ role: 'AUDITOR' })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setAuditors(list.filter((u) => u.role === 'AUDITOR'));
      })
      .catch(() => setAuditors([]));
  }, []);

  const handleAssign = (auditId, auditorId) => {
    if (!auditorId) return;
    setAssigningId(auditId);
    superadminAudits
      .assign(auditId, auditorId)
      .then(() => {
        loadAudits('REQUESTED');
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to assign audit'))
      .finally(() => setAssigningId(null));
  };

  return (
    <div className="superadmin-audits-page">
      <div className="superadmin-audits-header">
        <h1>Audit requests</h1>
        <p className="superadmin-audits-sub">
          Owner and system-initiated audit requests. Assign each audit to an auditor.
        </p>
        <div className="superadmin-audits-filters">
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter audits by status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && <div className="superadmin-audits-error">{error}</div>}
      {loading && audits.length === 0 ? (
        <p className="superadmin-audits-loading">Loading audits...</p>
      ) : audits.length === 0 ? (
        <p className="superadmin-audits-empty">No audit requests waiting for assignment.</p>
      ) : (
        <div className="superadmin-audits-table-wrap">
          <table className="superadmin-audits-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Requested by</th>
                <th>Requested at</th>
                <th>Assigned to</th>
                <th>Assign</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id}>
                  <td>{a.restaurant_name}</td>
                  <td>{a.requested_by_name || '—'}</td>
                  <td>
                    {a.requested_at
                      ? new Date(a.requested_at).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td>{a.assigned_to_name || 'Unassigned'}</td>
                  <td>
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        if (id) handleAssign(a.id, id);
                      }}
                      disabled={assigningId === a.id || auditors.length === 0}
                    >
                      <option value="">Assign to…</option>
                      {auditors.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                    {assigningId === a.id && (
                      <span className="superadmin-audits-assigning">Assigning…</span>
                    )}
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

