import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { evidence, rubric } from '../api';
import './OwnerEvidenceUpload.css';

const MAX_FILES = 5;
const MAX_SIZE_MB = 50;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'video/mp4'];
const MIN_DESCRIPTION = 20;

export default function OwnerEvidenceUpload() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    rubric
      .categories()
      .then(({ data }) => setCategories(data))
      .catch(() => setError('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);

  const onFileChange = (e) => {
    const chosen = Array.from(e.target.files || []);
    const valid = [];
    const errs = [];
    for (const f of chosen) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        errs.push(`${f.name}: only JPEG, PNG, MP4 allowed`);
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        errs.push(`${f.name}: max ${MAX_SIZE_MB}MB`);
        continue;
      }
      valid.push(f);
    }
    if (errs.length) setError(errs.join('; '));
    const combined = [...files, ...valid].slice(0, MAX_FILES);
    setFiles(combined);
    const newPreviews = combined.map((f) =>
      f.type.startsWith('image/') ? URL.createObjectURL(f) : null
    );
    setPreviews((prev) => prev.forEach((u) => u && URL.revokeObjectURL(u)));
    setPreviews(newPreviews);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!categoryId) {
      setError('Select a category');
      return;
    }
    if (description.trim().length < MIN_DESCRIPTION) {
      setError(`Description must be at least ${MIN_DESCRIPTION} characters`);
      return;
    }
    if (files.length === 0) {
      setError('Select at least one file');
      return;
    }
    const formData = new FormData();
    formData.append('category_id', categoryId);
    formData.append('description', description.trim());
    files.forEach((f) => formData.append('files', f));
    setSubmitting(true);
    evidence
      .upload(formData)
      .then(() => navigate('/owner-dashboard/evidence'))
      .catch((err) =>
        setError(err.response?.data?.detail || err.response?.data?.category_id?.[0] || 'Upload failed')
      )
      .finally(() => setSubmitting(false));
  };

  if (loading) return <div className="owner-evidence-loading">Loading...</div>;

  return (
    <div className="owner-evidence-upload">
      <h1>Upload Evidence</h1>
      <Link to="/owner-dashboard/evidence" className="owner-evidence-back">← Back to evidence</Link>
      <form onSubmit={handleSubmit} className="owner-evidence-form">
        <div className="owner-evidence-field">
          <label>Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({(c.weight * 100).toFixed(0)}%)
              </option>
            ))}
          </select>
        </div>
        <div className="owner-evidence-field">
          <label>Description (min {MIN_DESCRIPTION} characters)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            minLength={MIN_DESCRIPTION}
            placeholder="Describe what this evidence shows..."
          />
          <span className="owner-evidence-char">{description.length} / {MIN_DESCRIPTION}+</span>
        </div>
        <div className="owner-evidence-field">
          <label>Files (max {MAX_FILES}: JPEG, PNG, MP4, max {MAX_SIZE_MB}MB each)</label>
          <div
            className="owner-evidence-dropzone"
            onClick={() => document.getElementById('evidence-files').click()}
          >
            Drag & drop or click to browse
          </div>
          <input
            id="evidence-files"
            type="file"
            accept=".jpg,.jpeg,.png,.mp4,image/jpeg,image/png,video/mp4"
            multiple
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </div>
        {previews.length > 0 && (
          <div className="owner-evidence-previews">
            {previews.map((url, i) => (
              <div key={i} className="owner-evidence-preview-item">
                {url ? (
                  <img src={url} alt="" />
                ) : (
                  <div className="owner-evidence-video-placeholder">Video</div>
                )}
                <button
                  type="button"
                  className="owner-evidence-remove-file"
                  onClick={() => removeFile(i)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <div className="owner-evidence-error">{error}</div>}
        <div className="owner-evidence-actions">
          <Link to="/owner-dashboard/evidence" className="owner-btn owner-btn-view">Cancel</Link>
          <button type="submit" className="owner-btn owner-btn-edit" disabled={submitting}>
            {submitting ? 'Uploading...' : 'Upload Evidence'}
          </button>
        </div>
      </form>
    </div>
  );
}
