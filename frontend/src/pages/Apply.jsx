import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { owner } from '../api';
import './Apply.css';

const initial = {
  restaurant_name: '',
  business_address: '',
  city: '',
  google_maps_link: '',
  landmark: '',
  contact_person_name: '',
  contact_phone: '',
  alternate_phone: '',
  operating_hours: '',
  proof_document_url: '',
  business_card_url: '',
  owner_photo_url: '',
  utility_bill_url: '',
  storefront_photo_url: '',
  dining_photo_url: '',
  declaration_accepted: false,
};

export default function Apply() {
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFile = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    setError('');
    try {
      const { data } = await owner.upload(file);
      setForm((prev) => ({ ...prev, [field]: data.url }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await owner.apply(form);
      navigate('/application-status');
    } catch (err) {
      const d = err.response?.data;
      if (typeof d === 'string') {
        setError(d);
      } else if (d && typeof d === 'object') {
        const first = d.detail || (typeof d.declaration_accepted !== 'undefined' && d.declaration_accepted?.[0])
          || d.google_maps_link?.[0] || Object.values(d).flat().find(Boolean);
        setError(first || 'Submission failed. Please check required fields and try again.');
      } else {
        setError('Submission failed. Please check required fields and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const proofFields = [
    { key: 'proof_document_url', label: 'Proof document (license/GST)', required: true },
    { key: 'business_card_url', label: 'Business card' },
    { key: 'owner_photo_url', label: 'Owner photo' },
    { key: 'utility_bill_url', label: 'Utility bill' },
  ];
  const photoFields = [
    { key: 'storefront_photo_url', label: 'Storefront photo' },
    { key: 'dining_photo_url', label: 'Dining area photo' },
  ];

  return (
    <div className="apply-page">
      <h1>Apply for owner access</h1>
      <p className="apply-intro">Submit your restaurant details and at least one proof document. Admin will review and approve.</p>
      {error && <div className="apply-error">{error}</div>}
      <form onSubmit={handleSubmit} className="apply-form">
        <section className="apply-section">
          <h2>Business information</h2>
          <label>Restaurant name *</label>
          <input name="restaurant_name" value={form.restaurant_name} onChange={handleChange} required />
          <label>Business address *</label>
          <textarea name="business_address" value={form.business_address} onChange={handleChange} required rows={2} />
          <label>City *</label>
          <input name="city" value={form.city} onChange={handleChange} required />
          <label>Google Maps link *</label>
          <input name="google_maps_link" type="url" value={form.google_maps_link} onChange={handleChange} required placeholder="https://maps.google.com/..." />
          <label>Landmark (optional)</label>
          <input name="landmark" value={form.landmark} onChange={handleChange} />
        </section>

        <section className="apply-section">
          <h2>Operational contact</h2>
          <label>Contact person name *</label>
          <input name="contact_person_name" value={form.contact_person_name} onChange={handleChange} required />
          <label>Contact phone *</label>
          <input name="contact_phone" type="tel" value={form.contact_phone} onChange={handleChange} required />
          <label>Alternate phone (optional)</label>
          <input name="alternate_phone" type="tel" value={form.alternate_phone} onChange={handleChange} />
          <label>Operating hours (optional)</label>
          <input name="operating_hours" value={form.operating_hours} onChange={handleChange} placeholder="e.g. 9 AM - 10 PM" />
        </section>

        <section className="apply-section">
          <h2>Proof of association (at least one required)</h2>
          {proofFields.map(({ key, label, required }) => (
            <div key={key} className="apply-file-row">
              <label>{label}{required ? ' *' : ''}</label>
              <div className="apply-file-wrap">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={(e) => handleFile(e, key)} disabled={!!uploading} />
                {form[key] && <a href={form[key]} target="_blank" rel="noreferrer" className="apply-link">View</a>}
                {uploading === key && <span className="apply-uploading">Uploading...</span>}
              </div>
            </div>
          ))}
        </section>

        <section className="apply-section">
          <h2>Restaurant photos (optional)</h2>
          {photoFields.map(({ key, label }) => (
            <div key={key} className="apply-file-row">
              <label>{label}</label>
              <div className="apply-file-wrap">
                <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp" onChange={(e) => handleFile(e, key)} disabled={!!uploading} />
                {form[key] && <a href={form[key]} target="_blank" rel="noreferrer" className="apply-link">View</a>}
                {uploading === key && <span className="apply-uploading">Uploading...</span>}
              </div>
            </div>
          ))}
        </section>

        <section className="apply-section">
          <label className="apply-checkbox">
            <input type="checkbox" name="declaration_accepted" checked={form.declaration_accepted} onChange={handleChange} required />
            I declare that I am a legitimate representative of this restaurant and the information provided is correct. *
          </label>
        </section>

        <div className="apply-actions">
          <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit application'}</button>
        </div>
      </form>
    </div>
  );
}
