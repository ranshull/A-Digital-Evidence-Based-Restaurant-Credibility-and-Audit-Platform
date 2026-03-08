import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { restaurants, owner } from '../api';
import './OwnerRestaurantPhotos.css';

const CAPTIONS = [
  { value: 'Storefront', label: 'Storefront' },
  { value: 'Dining', label: 'Dining' },
  { value: 'Kitchen', label: 'Kitchen' },
  { value: 'Menu', label: 'Menu' },
  { value: 'Other', label: 'Other' },
];

export default function OwnerRestaurantPhotos() {
  const [restaurant, setRestaurant] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('Storefront');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const load = () => {
    restaurants
      .me()
      .then(({ data }) => {
        setRestaurant(data);
        setPhotos(data.photos || []);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  useEffect(() => {
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose an image first.');
      return;
    }
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      const { data: uploadData } = await owner.upload(file);
      await restaurants.addPhoto({
        image_url: uploadData.url,
        caption: caption || 'Other',
        order: photos.length,
      });
      setSuccess('Photo added.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.image_url?.[0] || 'Failed to add photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await restaurants.deletePhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete.');
    }
  };

  if (loading) return <div className="owner-photos-loading">Loading...</div>;
  if (error && !restaurant) return <div className="owner-photos-error">{error}</div>;

  return (
    <div className="owner-photos-page">
      <p className="owner-photos-back">
        <Link to="/owner-dashboard">← Back to dashboard</Link>
      </p>
      <h1>Restaurant photos</h1>
      <p className="owner-photos-intro">Add photos for the carousel, menu section, and gallery (Kitchen, Dining, Storefront, Menu).</p>
      {error && <div className="owner-photos-error">{error}</div>}
      {success && <div className="owner-photos-success">{success}</div>}

      <form onSubmit={handleAdd} className="owner-photos-form">
        <div className="owner-photos-field">
          <label>Caption (section)</label>
          <select
            className="owner-photos-select"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            aria-label="Photo section"
          >
            {CAPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="owner-photos-field">
          <label>Image</label>
          <div className="owner-photos-file-wrap">
            <label className="owner-photos-zone">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp"
                onChange={handleFileChange}
                disabled={uploading}
                className="owner-photos-file-input"
              />
              <span className="owner-photos-zone-text">
                {uploading ? '⋯ Adding…' : file ? '↻ Change photo' : '↑ Choose photo'}
              </span>
            </label>
          </div>
          {file && previewUrl && (
            <div className="owner-photos-preview">
              <div className="owner-photos-preview-name-row">
                <span className="owner-photos-preview-name">{file.name}</span>
                <button type="button" onClick={clearFile} className="owner-photos-preview-remove" aria-label="Remove">×</button>
              </div>
              <div className="owner-photos-preview-content">
                <a href={previewUrl} target="_blank" rel="noreferrer" className="owner-photos-preview-link">
                  <img src={previewUrl} alt={file.name} className="owner-photos-preview-img" />
                </a>
                <a href={previewUrl} target="_blank" rel="noreferrer" className="owner-photos-preview-view">View full size</a>
              </div>
            </div>
          )}
        </div>
        <div className="owner-photos-actions">
          <button type="submit" disabled={uploading || !file} className="owner-photos-submit">
            {uploading ? 'Adding...' : 'Add photo'}
          </button>
        </div>
      </form>

      <section className="owner-photos-list">
        <h2>Current photos ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className="owner-photos-empty">No photos yet. Add one above.</p>
        ) : (
          <div className="owner-photos-grid">
            {photos.map((p) => (
              <div key={p.id} className="owner-photos-item">
                <img src={p.image_url} alt={p.caption || 'Photo'} />
                <span className="owner-photos-caption">{p.caption || '—'}</span>
                <button type="button" className="owner-photos-remove" onClick={() => handleDelete(p.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
