import { useState, useEffect } from 'react';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        <label>Caption (section)</label>
        <select value={caption} onChange={(e) => setCaption(e.target.value)}>
          {CAPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label>Image</label>
        <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button type="submit" disabled={uploading || !file}>{uploading ? 'Adding...' : 'Add photo'}</button>
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
