import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api';
import './Profile.css';

const DEFAULT_AVATAR_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
  </svg>
);

const RESTRICTED_EDIT_ROLES = ['ADMIN', 'AUDITOR', 'SUPER_ADMIN'];

export default function Profile() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const canEditAll = user && !RESTRICTED_EDIT_ROLES.includes(user.role);
  const avatarUrl = user?.profile_picture_url || null;
  const displayAvatarUrl = avatarUrl || previewUrl || null;

  const startEdit = () => {
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    });
    setError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      if (canEditAll) {
        formData.append('name', form.name);
        formData.append('email', form.email);
      }
      formData.append('phone', form.phone);
      const file = fileInputRef.current?.files?.[0];
      if (file) formData.append('profile_picture', file);
      await auth.updateProfile(formData);
      const { data } = await auth.me();
      setUser(data);
      setEditing(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.name?.[0] || d?.email?.[0] || (Array.isArray(d?.detail) ? d.detail[0] : d?.detail) || d?.profile_picture?.[0] || 'Update failed.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-page">
        <p className="profile-message">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-hero">
          <div className="profile-avatar-wrap">
            {displayAvatarUrl ? (
              <img src={displayAvatarUrl} alt="" className="profile-avatar" />
            ) : (
              <div className="profile-avatar profile-avatar-default" aria-hidden="true">
                {DEFAULT_AVATAR_SVG}
              </div>
            )}
            {editing && (
              <div className="profile-avatar-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  id="profile-pic"
                  className="profile-file-input"
                  onChange={onFileSelect}
                />
                <label htmlFor="profile-pic" className="profile-upload-label">Upload photo</label>
              </div>
            )}
          </div>
          <div className="profile-hero-text">
            <h1 className="profile-name">{user.name}</h1>
            <p className="profile-role">{user.role.replace('_', ' ')}</p>
          </div>
        </div>

        {!editing ? (
          <div className="profile-info">
            <div className="profile-detail-row">
              <span className="profile-detail-label">Name</span>
              <span className="profile-detail-value">{user.name}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Email</span>
              <span className="profile-detail-value">{user.email}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Phone</span>
              <span className="profile-detail-value">{user.phone || '—'}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Role</span>
              <span className="profile-detail-value">{user.role.replace('_', ' ')}</span>
            </div>
            <button type="button" className="profile-edit-btn" onClick={startEdit}>
              Edit
            </button>
          </div>
        ) : (
          <form className="profile-form" onSubmit={handleSubmit}>
            {error && <p className="profile-error">{error}</p>}
            {canEditAll && (
              <>
                <label className="profile-form-label">Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="profile-form-input"
                  required
                />
                <label className="profile-form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="profile-form-input"
                  required
                />
              </>
            )}
            <label className="profile-form-label">Phone</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="profile-form-input"
            />
            {!canEditAll && (
              <p className="profile-form-hint">You can only update phone and profile picture.</p>
            )}
            <div className="profile-form-actions">
              <button type="button" className="profile-cancel-btn" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="profile-save-btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
