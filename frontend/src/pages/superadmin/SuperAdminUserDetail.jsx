import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { superadmin } from '../../api';
import './SuperAdminUserDetail.css';

const ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function SuperAdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'USER', is_active: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    superadmin
      .getUser(id)
      .then(({ data }) => {
        setUser(data);
        setForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          role: data.role || 'USER',
          is_active: data.is_active !== false,
        });
      })
      .catch(() => setError('User not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      await superadmin.updateUser(id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || '',
        role: form.role,
        is_active: form.is_active,
      });
      setSuccess(true);
      setUser((prev) => prev && { ...prev, ...form });
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === 'object' ? (d.detail || d.role?.[0] || JSON.stringify(d)) : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="superadmin-detail-loading">Loading...</div>;
  if (error && !user) return <div className="superadmin-detail-error">{error}</div>;

  return (
    <div className="superadmin-detail-page">
      <p className="superadmin-detail-back">
        <Link to="/superadmin/users">← Back to users</Link>
      </p>
      <h1>Edit user</h1>
      {success && <div className="superadmin-detail-success">Saved.</div>}
      {error && <div className="superadmin-detail-error">{error}</div>}
      <form onSubmit={handleSubmit} className="superadmin-detail-form">
        <label>Name</label>
        <input name="name" value={form.name} onChange={handleChange} required />
        <label>Email</label>
        <input name="email" type="email" value={form.email} onChange={handleChange} required />
        <label>Phone</label>
        <input name="phone" value={form.phone} onChange={handleChange} />
        <label>Role</label>
        {user?.role === 'SUPER_ADMIN' ? (
          <p className="superadmin-detail-role-readonly">Super Admin (cannot be changed here)</p>
        ) : (
          <select name="role" value={form.role} onChange={handleChange}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        )}
        <label className="superadmin-detail-checkbox">
          <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
          Active
        </label>
        <div className="superadmin-detail-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <Link to="/superadmin/users" className="superadmin-detail-cancel">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
