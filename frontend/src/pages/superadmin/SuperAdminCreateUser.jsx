import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { superadmin } from '../../api';
import './SuperAdminCreateUser.css';

const ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function SuperAdminCreateUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'ADMIN',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSubmitting(true);
    try {
      await superadmin.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || '',
        password: form.password,
        role: form.role,
      });
      setSuccess(true);
      setTimeout(() => navigate('/superadmin/users'), 1500);
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === 'object' ? (d.detail || d.email?.[0] || d.role?.[0] || JSON.stringify(d)) : 'Create failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="superadmin-create-page">
      <Link to="/superadmin/users" className="superadmin-create-back">← Back to users</Link>
      <header className="superadmin-create-header">
        <h1>Create user</h1>
        <p className="superadmin-create-sub">Create new Admin, Auditor, or other roles.</p>
      </header>
      {success && <div className="superadmin-create-success" role="alert">User created. Redirecting...</div>}
      {error && <div className="superadmin-create-error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit} className="superadmin-create-form">
        <div className="superadmin-create-field">
          <label htmlFor="create-name">Name *</label>
          <input id="create-name" name="name" value={form.name} onChange={handleChange} required placeholder="Full name" />
        </div>
        <div className="superadmin-create-field">
          <label htmlFor="create-email">Email *</label>
          <input id="create-email" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="user@example.com" />
        </div>
        <div className="superadmin-create-field">
          <label htmlFor="create-phone">Phone</label>
          <input id="create-phone" name="phone" value={form.phone} onChange={handleChange} placeholder="Optional" />
        </div>
        <div className="superadmin-create-field">
          <label htmlFor="create-password">Password *</label>
          <input id="create-password" name="password" type="password" value={form.password} onChange={handleChange} required minLength={8} placeholder="Min 8 characters" />
        </div>
        <div className="superadmin-create-field">
          <label htmlFor="create-role">Role *</label>
          <select id="create-role" name="role" value={form.role} onChange={handleChange}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="superadmin-create-actions">
          <button type="submit" disabled={submitting} className="superadmin-create-submit">
            {submitting ? 'Creating...' : 'Create user'}
          </button>
          <Link to="/superadmin/users" className="superadmin-create-cancel">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
