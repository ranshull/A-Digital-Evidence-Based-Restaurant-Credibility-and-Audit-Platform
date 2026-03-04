import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { restaurants } from '../api';
import './OwnerRestaurantEdit.css';

export default function OwnerRestaurantEdit() {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    google_maps_link: '',
    latitude: '',
    longitude: '',
    operating_hours: '',
    phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    restaurants
      .me()
      .then(({ data }) => {
        setRestaurant(data);
        setForm({
          name: data.name || '',
          address: data.address || '',
          city: data.city || '',
          google_maps_link: data.google_maps_link || '',
          latitude: data.latitude != null ? String(data.latitude) : '',
          longitude: data.longitude != null ? String(data.longitude) : '',
          operating_hours: data.operating_hours || '',
          phone: data.phone || '',
        });
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    const googleLink = form.google_maps_link.trim() || (restaurant && restaurant.google_maps_link) || '';
    if (!googleLink) {
      setError('Google Maps link is required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      google_maps_link: googleLink,
      operating_hours: form.operating_hours.trim() || '',
      phone: form.phone.trim() || '',
    };
    const lat = form.latitude.trim();
    const lng = form.longitude.trim();
    if (lat && !isNaN(parseFloat(lat))) payload.latitude = lat;
    if (lng && !isNaN(parseFloat(lng))) payload.longitude = lng;
    try {
      await restaurants.updateMe(payload);
      setSuccess(true);
      setRestaurant((prev) => prev && { ...prev, ...payload });
    } catch (err) {
      const d = err.response?.data;
      if (typeof d === 'object' && d !== null) {
        const msg = d.detail;
        const fieldErrors = Object.entries(d)
          .filter(([k, v]) => k !== 'detail' && Array.isArray(v))
          .map(([k, v]) => `${k}: ${(v || []).join(' ')}`);
        const all = [msg, ...fieldErrors].filter(Boolean);
        setError(all.length ? all.join(' ') : JSON.stringify(d));
      } else {
        setError(d || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="owner-edit-loading">Loading...</div>;
  if (error && !restaurant) return <div className="owner-edit-error">{error}</div>;

  return (
    <div className="owner-edit-page">
      <p className="owner-edit-back">
        <Link to="/owner-dashboard">← Back to dashboard</Link>
      </p>
      <h1>Edit restaurant</h1>
      {success && <div className="owner-edit-success">Changes saved successfully.</div>}
      {error && <div className="owner-edit-error">{error}</div>}
      <form onSubmit={handleSubmit} className="owner-edit-form">
        <label>Restaurant name *</label>
        <input name="name" value={form.name} onChange={handleChange} required />
        <label>Address *</label>
        <textarea name="address" value={form.address} onChange={handleChange} required rows={2} />
        <label>City *</label>
        <input name="city" value={form.city} onChange={handleChange} required />
        <label>Google Maps link</label>
        <input name="google_maps_link" type="url" value={form.google_maps_link} onChange={handleChange} placeholder="https://maps.google.com/..." />
        <label>Latitude (for map)</label>
        <input name="latitude" type="text" value={form.latitude} onChange={handleChange} placeholder="e.g. 28.6139" />
        <label>Longitude (for map)</label>
        <input name="longitude" type="text" value={form.longitude} onChange={handleChange} placeholder="e.g. 77.2090" />
        <label>Operating hours</label>
        <input name="operating_hours" value={form.operating_hours} onChange={handleChange} placeholder="e.g. 9 AM - 10 PM" />
        <label>Phone</label>
        <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+91 9876543210" />
        <div className="owner-edit-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
          <Link to="/owner-dashboard" className="owner-edit-cancel">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
