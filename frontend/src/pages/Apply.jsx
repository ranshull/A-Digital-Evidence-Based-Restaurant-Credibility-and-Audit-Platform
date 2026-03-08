import { useState, useRef, useEffect } from 'react';
import { owner } from '../api';
import './Apply.css';
import './ApplicationStatus.css';

const SECTIONS = [
  { id: 'business', label: 'Business information', icon: '◆' },
  { id: 'contact', label: 'Operational contact', icon: '◇' },
  { id: 'proof', label: 'Proof of association', icon: '◈' },
  { id: 'photos', label: 'Restaurant photos', icon: '◎' },
  { id: 'declaration', label: 'Declaration', icon: '✓' },
];

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
  const [fileNames, setFileNames] = useState({});
  const [openSection, setOpenSection] = useState('business');
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef(null);
  const [statusData, setStatusData] = useState({ applications: [], latest: null });
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    owner
      .applicationStatus()
      .then(({ data: res }) => setStatusData(res))
      .catch((err) => setStatusError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setStatusLoading(false));
  }, []);

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
      setFileNames((prev) => ({ ...prev, [field]: file.name }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(null);
    }
  };

  const handleClearFile = (field) => {
    setForm((prev) => ({ ...prev, [field]: '' }));
    setFileNames((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const getFileDisplayName = (field) => {
    if (fileNames[field]) return fileNames[field];
    const url = form[field];
    if (!url) return '';
    try {
      const path = new URL(url).pathname;
      return path.split('/').pop() || 'File';
    } catch {
      return 'File';
    }
  };

  const REQUIRED_FIELDS = [
    { key: 'restaurant_name', label: 'Restaurant name' },
    { key: 'business_address', label: 'Business address' },
    { key: 'city', label: 'City' },
    { key: 'google_maps_link', label: 'Google Maps link' },
    { key: 'contact_person_name', label: 'Contact person name' },
    { key: 'contact_phone', label: 'Contact phone' },
    { key: 'proof_document_url', label: 'Proof document (at least one)' },
    { key: 'declaration_accepted', label: 'Declaration (accept terms)' },
  ];

  const getMissingRequired = () => {
    const missing = [];
    for (const { key, label } of REQUIRED_FIELDS) {
      if (key === 'declaration_accepted') {
        if (!form.declaration_accepted) missing.push(label);
      } else {
        const value = form[key];
        if (value == null || String(value).trim() === '') missing.push(label);
      }
    }
    return missing;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const missing = getMissingRequired();
    if (missing.length > 0) {
      const message =
        'Please fill in all required details before submitting.\n\nMissing:\n• ' +
        missing.join('\n• ');
      setError(message);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
      return;
    }
    setSubmitting(true);
    try {
      await owner.apply(form);
      const { data: res } = await owner.applicationStatus();
      setStatusData(res);
      setShowForm(false);
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

  const isPdfUrl = (url) => url && (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf'));

  const { latest, applications } = statusData;
  const formatVal = (v) => (v == null || String(v).trim() === '' ? '—' : String(v).trim());

  if (statusLoading) {
    return <div className="status-loading">Loading application status...</div>;
  }
  if (statusError && !latest) {
    return (
      <div className="apply-page">
        <div className="status-error">{statusError}</div>
        <button type="button" className="status-cta" onClick={() => { setStatusError(''); setStatusLoading(true); owner.applicationStatus().then(({ data: res }) => setStatusData(res)).catch((err) => setStatusError(err.response?.data?.detail || 'Failed to load')).finally(() => setStatusLoading(false)); }}>Try again</button>
      </div>
    );
  }
  if (latest && !showForm) {
    return (
      <div className="apply-page">
        <header className="apply-header">
          <h1>Apply for owner access</h1>
          <p className="apply-intro">Submit your restaurant details and at least one proof document. Admin will review and approve.</p>
        </header>
        <div className="status-page">
          <p className="status-intro">You have already filled the form. Below is your application status and a summary of what you submitted.</p>
          <div className={`status-card status-${latest.status.toLowerCase()}`}>
            <div className="status-header">
              <h2>{latest.restaurant_name}</h2>
              <span className="status-badge">{latest.status}</span>
            </div>
            <p className="status-meta">Submitted: {new Date(latest.submitted_at).toLocaleString()}</p>
            {latest.reviewed_at && (
              <p className="status-meta">Reviewed: {new Date(latest.reviewed_at).toLocaleString()}</p>
            )}
            {latest.review_notes && (
              <div className="status-notes">
                <strong>Review notes:</strong> {latest.review_notes}
              </div>
            )}
            {latest.status === 'PENDING' && (
              <p className="status-pending-msg">Your application is under review. You will be notified once processed.</p>
            )}
            {latest.status === 'APPROVED' && (
              <p className="status-approved-msg">Your application was approved. You now have owner dashboard access.</p>
            )}
            {latest.status === 'REJECTED' && (
              <p className="status-rejected-msg">Your application was rejected. You may submit a new application with updated details.</p>
            )}
          </div>
          <section className="status-summary">
            <h3 className="status-summary-title">Form summary</h3>
            <dl className="status-summary-list">
              <dt>Restaurant name</dt>
              <dd>{formatVal(latest.restaurant_name)}</dd>
              <dt>Business address</dt>
              <dd>{formatVal(latest.business_address)}</dd>
              <dt>City</dt>
              <dd>{formatVal(latest.city)}</dd>
              <dt>Google Maps link</dt>
              <dd>{latest.google_maps_link ? <a href={latest.google_maps_link} target="_blank" rel="noreferrer" className="status-summary-link">View on map</a> : '—'}</dd>
              <dt>Landmark</dt>
              <dd>{formatVal(latest.landmark)}</dd>
              <dt>Contact person</dt>
              <dd>{formatVal(latest.contact_person_name)}</dd>
              <dt>Contact phone</dt>
              <dd>{formatVal(latest.contact_phone)}</dd>
              <dt>Alternate phone</dt>
              <dd>{formatVal(latest.alternate_phone)}</dd>
              <dt>Operating hours</dt>
              <dd>{formatVal(latest.operating_hours)}</dd>
              <dt>Proof document</dt>
              <dd>{latest.proof_document_url ? <a href={latest.proof_document_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Business card</dt>
              <dd>{latest.business_card_url ? <a href={latest.business_card_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Owner photo</dt>
              <dd>{latest.owner_photo_url ? <a href={latest.owner_photo_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Utility bill</dt>
              <dd>{latest.utility_bill_url ? <a href={latest.utility_bill_url} target="_blank" rel="noreferrer" className="status-summary-link">View</a> : '—'}</dd>
              <dt>Storefront photo</dt>
              <dd>
                {latest.storefront_photo_url ? (
                  <span className="status-summary-photo">
                    <a href={latest.storefront_photo_url} target="_blank" rel="noreferrer" className="status-summary-photo-link">
                      <img src={latest.storefront_photo_url} alt="Storefront" className="status-summary-img" onError={(e) => { e.target.style.display = 'none'; }} />
                    </a>
                    <a href={latest.storefront_photo_url} target="_blank" rel="noreferrer" className="status-summary-link">View full size</a>
                  </span>
                ) : '—'}
              </dd>
              <dt>Dining area photo</dt>
              <dd>
                {latest.dining_photo_url ? (
                  <span className="status-summary-photo">
                    <a href={latest.dining_photo_url} target="_blank" rel="noreferrer" className="status-summary-photo-link">
                      <img src={latest.dining_photo_url} alt="Dining area" className="status-summary-img" onError={(e) => { e.target.style.display = 'none'; }} />
                    </a>
                    <a href={latest.dining_photo_url} target="_blank" rel="noreferrer" className="status-summary-link">View full size</a>
                  </span>
                ) : '—'}
              </dd>
              <dt>Declaration accepted</dt>
              <dd>{latest.declaration_accepted ? 'Yes' : '—'}</dd>
            </dl>
          </section>
          <div className="status-actions">
            <button
              type="button"
              className="status-cta"
              onClick={() => {
                if (latest) {
                  setForm({
                    restaurant_name: latest.restaurant_name ?? '',
                    business_address: latest.business_address ?? '',
                    city: latest.city ?? '',
                    google_maps_link: latest.google_maps_link ?? '',
                    landmark: latest.landmark ?? '',
                    contact_person_name: latest.contact_person_name ?? '',
                    contact_phone: latest.contact_phone ?? '',
                    alternate_phone: latest.alternate_phone ?? '',
                    operating_hours: latest.operating_hours ?? '',
                    proof_document_url: latest.proof_document_url ?? '',
                    business_card_url: latest.business_card_url ?? '',
                    owner_photo_url: latest.owner_photo_url ?? '',
                    utility_bill_url: latest.utility_bill_url ?? '',
                    storefront_photo_url: latest.storefront_photo_url ?? '',
                    dining_photo_url: latest.dining_photo_url ?? '',
                    declaration_accepted: Boolean(latest.declaration_accepted),
                  });
                  setFileNames({});
                }
                setShowForm(true);
              }}
            >
              Update application
            </button>
          </div>
        </div>
        {applications.length > 1 && (
          <div className="status-history">
            <h3>Previous applications</h3>
            <ul>
              {applications.slice(1).map((app) => (
                <li key={app.id}>
                  {app.restaurant_name} — {app.status} ({new Date(app.submitted_at).toLocaleDateString()})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const FilePreview = ({ url, label, fileName, onRemove }) => {
    if (!url) return null;
    if (isPdfUrl(url)) {
      return (
        <div className="apply-file-preview apply-file-preview-pdf">
          {fileName != null && (
            <div className="apply-file-name-row">
              <span className="apply-file-name">{fileName}</span>
              {onRemove && (
                <button type="button" onClick={onRemove} className="apply-file-preview-remove" aria-label="Remove file" title="Remove">
                  <span aria-hidden>×</span>
                </button>
              )}
            </div>
          )}
          <span className="apply-file-preview-badge">PDF</span>
          <a href={url} target="_blank" rel="noreferrer" className="apply-link">View document</a>
        </div>
      );
    }
    return (
      <div className="apply-file-preview">
        <div className="apply-file-name-row">
          <span className="apply-file-name">{fileName ?? ''}</span>
          {onRemove && (
            <button type="button" onClick={onRemove} className="apply-file-preview-remove" aria-label="Remove file" title="Remove">
              <span aria-hidden>×</span>
            </button>
          )}
        </div>
        <div className="apply-file-preview-content">
          <a href={url} target="_blank" rel="noreferrer" className="apply-file-preview-link">
            <img src={url} alt={label} className="apply-file-preview-img" />
          </a>
          <a href={url} target="_blank" rel="noreferrer" className="apply-link">View full size</a>
        </div>
      </div>
    );
  };

  return (
    <div className="apply-page">
      <header className="apply-header">
        <h1>Apply for owner access</h1>
        <p className="apply-intro">Submit your restaurant details and at least one proof document. Admin will review and approve.</p>
      </header>

      {error && <div ref={errorRef} className="apply-error" role="alert">{error}</div>}

      <nav className="apply-section-bar" aria-label="Form sections">
        {SECTIONS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`apply-section-tab ${openSection === id ? 'apply-section-tab-active' : ''}`}
            onClick={() => setOpenSection(id)}
            aria-expanded={openSection === id}
          >
            <span className="apply-section-tab-icon" aria-hidden="true">{icon}</span>
            <span className="apply-section-tab-label">{label}</span>
          </button>
        ))}
      </nav>

      <form onSubmit={handleSubmit} className="apply-form">
        <section className={`apply-section apply-section-panel ${openSection === 'business' ? 'apply-section-open' : ''}`} id="section-business" aria-hidden={openSection !== 'business'}>
          <h2 className="apply-section-title">Business information</h2>
          <div className="apply-fields">
            <label>Restaurant name *</label>
            <input type="text" name="restaurant_name" value={form.restaurant_name} onChange={handleChange} required placeholder="e.g. Café Night" />
            <label>Business address *</label>
            <textarea name="business_address" value={form.business_address} onChange={handleChange} required rows={2} placeholder="Full street address" />
            <label>City *</label>
            <input type="text" name="city" value={form.city} onChange={handleChange} required placeholder="City" />
            <label>Google Maps link *</label>
            <input name="google_maps_link" type="url" value={form.google_maps_link} onChange={handleChange} required placeholder="https://maps.google.com/..." />
            <label>Landmark (optional)</label>
            <input type="text" name="landmark" value={form.landmark} onChange={handleChange} placeholder="Nearby landmark" />
          </div>
        </section>

        <section className={`apply-section apply-section-panel ${openSection === 'contact' ? 'apply-section-open' : ''}`} id="section-contact" aria-hidden={openSection !== 'contact'}>
          <h2 className="apply-section-title">Operational contact</h2>
          <div className="apply-fields">
            <label>Contact person name *</label>
            <input type="text" name="contact_person_name" value={form.contact_person_name} onChange={handleChange} required placeholder="Full name" />
            <label>Contact phone *</label>
            <input name="contact_phone" type="tel" value={form.contact_phone} onChange={handleChange} required placeholder="Primary number" />
            <label>Alternate phone (optional)</label>
            <input name="alternate_phone" type="tel" value={form.alternate_phone} onChange={handleChange} placeholder="Backup number" />
            <label>Operating hours (optional)</label>
            <input name="operating_hours" value={form.operating_hours} onChange={handleChange} placeholder="e.g. 9 AM – 10 PM" />
          </div>
        </section>

        <section className={`apply-section apply-section-panel ${openSection === 'proof' ? 'apply-section-open' : ''}`} id="section-proof" aria-hidden={openSection !== 'proof'}>
          <h2 className="apply-section-title">Proof of association</h2>
          <p className="apply-section-hint">At least one document required. Upload license, GST, or similar.</p>
          <div className="apply-fields">
            {proofFields.map(({ key, label, required }) => (
              <div key={key} className="apply-file-row">
                <label className="apply-file-label">{label}{required ? ' *' : ''}</label>
                <div className="apply-file-wrap" key={`wrap-${key}-${form[key] ? 'set' : 'empty'}`}>
                  <label className="apply-file-zone">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={(e) => handleFile(e, key)} disabled={!!uploading} className="apply-file-input" />
                    <span className="apply-file-zone-text">{uploading === key ? '⋯ Uploading…' : form[key] ? '↻ Change file' : '↑ Choose file'}</span>
                  </label>
                </div>
                <FilePreview url={form[key]} label={label} fileName={form[key] ? getFileDisplayName(key) : null} onRemove={() => handleClearFile(key)} />
              </div>
            ))}
          </div>
        </section>

        <section className={`apply-section apply-section-panel ${openSection === 'photos' ? 'apply-section-open' : ''}`} id="section-photos" aria-hidden={openSection !== 'photos'}>
          <h2 className="apply-section-title">Restaurant photos</h2>
          <p className="apply-section-hint">Optional. Storefront and dining area help verification.</p>
          <div className="apply-fields">
            {photoFields.map(({ key, label }) => (
              <div key={key} className="apply-file-row">
                <label className="apply-file-label">{label}</label>
                <div className="apply-file-wrap" key={`wrap-${key}-${form[key] ? 'set' : 'empty'}`}>
                  <label className="apply-file-zone">
                    <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp" onChange={(e) => handleFile(e, key)} disabled={!!uploading} className="apply-file-input" />
                    <span className="apply-file-zone-text">{uploading === key ? '⋯ Uploading…' : form[key] ? '↻ Change photo' : '↑ Choose photo'}</span>
                  </label>
                </div>
                <FilePreview url={form[key]} label={label} fileName={form[key] ? getFileDisplayName(key) : null} onRemove={() => handleClearFile(key)} />
              </div>
            ))}
          </div>
        </section>

        <section className={`apply-section apply-section-panel ${openSection === 'declaration' ? 'apply-section-open' : ''}`} id="section-declaration" aria-hidden={openSection !== 'declaration'}>
          <h2 className="apply-section-title">Declaration</h2>
          <div className="apply-fields">
            <div className="apply-summary">
              <h3 className="apply-summary-title">Review your application</h3>
              <dl className="apply-summary-list">
                <dt>Restaurant name</dt>
                <dd>{form.restaurant_name || '—'}</dd>
                <dt>Address</dt>
                <dd>{form.business_address ? `${form.business_address}${form.city ? `, ${form.city}` : ''}` : '—'}</dd>
                {form.landmark && (
                  <>
                    <dt>Landmark</dt>
                    <dd>{form.landmark}</dd>
                  </>
                )}
                <dt>Google Maps</dt>
                <dd>{form.google_maps_link ? <a href={form.google_maps_link} target="_blank" rel="noreferrer" className="apply-link">Open map</a> : '—'}</dd>
                <dt>Contact person</dt>
                <dd>{form.contact_person_name || '—'}</dd>
                <dt>Phone</dt>
                <dd>{form.contact_phone || '—'}</dd>
                {form.alternate_phone && (
                  <>
                    <dt>Alternate phone</dt>
                    <dd>{form.alternate_phone}</dd>
                  </>
                )}
                {form.operating_hours && (
                  <>
                    <dt>Operating hours</dt>
                    <dd>{form.operating_hours}</dd>
                  </>
                )}
                <dt>Proof documents</dt>
                <dd>
                  {[proofFields, photoFields].flat().filter((f) => form[f.key]).length > 0
                    ? [...proofFields, ...photoFields].filter((f) => form[f.key]).map((f) => f.label).join(', ')
                    : '—'}
                </dd>
              </dl>
            </div>
            <label className="apply-checkbox">
              <input type="checkbox" name="declaration_accepted" checked={form.declaration_accepted} onChange={handleChange} required />
              <span>I declare that I am a legitimate representative of this restaurant and the information provided is correct. *</span>
            </label>
            <div className="apply-actions">
              <button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
