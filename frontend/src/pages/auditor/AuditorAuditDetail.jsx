import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { auditor, rubric, owner } from '../../api';
import './AuditorAuditDetail.css';

export default function AuditorAuditDetail() {
  const { id } = useParams();
  const auditId = Number(id);
  const [audit, setAudit] = useState(null);
  const [categories, setCategories] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [scoreCategoryId, setScoreCategoryId] = useState('');
  const [savingScores, setSavingScores] = useState(false);

  useEffect(() => {
    if (!auditId) return;
    setLoading(true);
    Promise.all([
      auditor.getAudit(auditId),
      rubric.categories(),
      auditor.listEvidence(auditId),
    ])
      .then(([auditRes, rubricRes, evidenceRes]) => {
        setAudit(auditRes.data);
        setCategories(rubricRes.data || []);
        setEvidence(Array.isArray(evidenceRes.data) ? evidenceRes.data : []);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load audit'))
      .finally(() => setLoading(false));
  }, [auditId]);

  const handleStart = () => {
    setStarting(true);
    auditor.startAudit(auditId)
      .then(({ data }) => setAudit(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to start audit'))
      .finally(() => setStarting(false));
  };

  const handleSubmit = () => {
    setSubmitting(true);
    auditor.submitAudit(auditId)
      .then(({ data }) => setAudit(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to submit audit'))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <div className="auditor-loading">Loading audit...</div>;
  if (error && !audit) return <div className="auditor-error">{error}</div>;
  if (!audit) return null;

  const groupedEvidence = categories.reduce((map, c) => {
    map[c.id] = [];
    return map;
  }, {});
  evidence.forEach((e) => {
    if (!groupedEvidence[e.category]) groupedEvidence[e.category] = [];
    groupedEvidence[e.category].push(e);
  });

  const canStart = audit.status === 'ASSIGNED';
  const canSubmit = audit.status === 'IN_PROGRESS';
  const canEdit = audit.status === 'ASSIGNED' || audit.status === 'IN_PROGRESS';

  const currentScoreCategory = categories.find((c) => c.id === Number(scoreCategoryId));

  const handleFilesSelected = async (files) => {
    if (!files || files.length === 0 || !selectedCategoryId) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('category_id', Number(selectedCategoryId));
      formData.append('description', uploadDescription);
      for (let i = 0; i < files.length; i += 1) {
        formData.append('files', files[i]);
      }
      const evRes = await auditor.uploadEvidence(auditId, formData);
      const created = Array.isArray(evRes.data) ? evRes.data : [evRes.data];
      setEvidence((prev) => [...created, ...prev]);
      setUploadDescription('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  const handleScoreChange = (subId, value) => {
    setScores((prev) => ({ ...prev, [subId]: value === '' ? undefined : Number(value) }));
  };

  const handleNotesChange = (subId, value) => {
    setNotes((prev) => ({ ...prev, [subId]: value }));
  };

  const handleSaveScores = () => {
    if (!currentScoreCategory) {
      setError('Select a category to score.');
      return;
    }
    const subcategories = currentScoreCategory.subcategories.map((sub) => ({
      subcategory_id: sub.id,
      score: scores[sub.id] ?? 0,
      notes: notes[sub.id] || '',
    }));
    setError('');
    setSavingScores(true);
    auditor.submitScores({
      audit_id: auditId,
      category_id: currentScoreCategory.id,
      subcategories,
    })
      .then(() => {
        // keep scores in UI; backend overwrites per category
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to save scores'))
      .finally(() => setSavingScores(false));
  };

  return (
    <div className="auditor-audit-detail-page">
      <h1>Audit for {audit.restaurant_name}</h1>
      <p className="auditor-meta">
        Status: <strong>{audit.status}</strong>
        {audit.assigned_to_name && <> · Assigned to {audit.assigned_to_name}</>}
      </p>
      {error && <div className="auditor-error">{error}</div>}

      <div className="auditor-audit-actions">
        {canStart && (
          <button type="button" className="auditor-btn auditor-btn-primary" onClick={handleStart} disabled={starting}>
            {starting ? 'Starting…' : 'Start audit'}
          </button>
        )}
        {canSubmit && (
          <button type="button" className="auditor-btn auditor-btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit audit to Admin'}
          </button>
        )}
      </div>

      <section className="auditor-section">
        <h2>Categories & evidence</h2>
        <p className="auditor-subtext">
          For each area (e.g. kitchen, dining), capture clear photos and later use the scoring view to record scores.
        </p>
        {canEdit && (
          <div className="auditor-upload-card">
            <h3 className="auditor-upload-title">Upload evidence</h3>
            <div className="auditor-upload-fields">
              <div className="auditor-upload-field">
                <label>Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  disabled={uploading}
                  className="auditor-upload-select"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.weight != null ? ` (${(c.weight * 100).toFixed(0)}%)` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="auditor-upload-field">
                <label>Description (optional)</label>
                <input
                  type="text"
                  className="auditor-upload-notes"
                  placeholder="Short description for this evidence"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  disabled={uploading}
                />
              </div>
            </div>
            <div className="auditor-upload-field">
              <label>Photos / videos</label>
              <div
                className="auditor-dropzone"
                onClick={() => !uploading && selectedCategoryId && document.getElementById('auditor-evidence-files').click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && !uploading && selectedCategoryId && document.getElementById('auditor-evidence-files').click()}
                aria-disabled={uploading || !selectedCategoryId}
              >
                {uploading ? 'Uploading…' : !selectedCategoryId ? 'Select a category first' : 'Drag & drop or click to browse'}
              </div>
              <input
                id="auditor-evidence-files"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.mp4,image/*,video/mp4"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  handleFilesSelected(files);
                  e.target.value = '';
                }}
                disabled={uploading || !selectedCategoryId}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}
        <div className="auditor-category-grid">
          {categories.map((cat) => (
            <div key={cat.id} className="auditor-category-card">
              <h3>{cat.name}</h3>
              <p className="auditor-category-desc">{cat.description}</p>
              {groupedEvidence[cat.id] && groupedEvidence[cat.id].length > 0 ? (
                <div className="auditor-evidence-thumbs">
                  {groupedEvidence[cat.id].map((ev) => (
                    <div key={ev.id} className="auditor-evidence-thumb">
                      {ev.file_type === 'IMAGE' ? (
                        <img src={ev.file_url} alt={ev.description || ''} />
                      ) : (
                        <span className="auditor-evidence-label">Video</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="auditor-empty">No evidence yet for this category.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="auditor-section auditor-section-scoring">
        <h2>Scoring</h2>
        <p className="auditor-subtext">
          After you have captured evidence, record scores for each category based on the rubric.
        </p>
        <div className="auditor-scoring-controls">
          <label>
            Category
            <select
              value={scoreCategoryId}
              onChange={(e) => {
                setScoreCategoryId(e.target.value);
                setScores({});
                setNotes({});
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        {currentScoreCategory && (
          <div className="auditor-scoring-panel">
            <div className="auditor-scoring-subs">
              {currentScoreCategory.subcategories.map((sub) => (
                <div key={sub.id} className="auditor-scoring-sub">
                  <label>
                    {sub.name} (0–{sub.max_score || 5})
                  </label>
                  <select
                    value={scores[sub.id] ?? ''}
                    onChange={(e) => handleScoreChange(sub.id, e.target.value)}
                  >
                    {[0, 1, 2, 3, 4, 5].filter((n) => n <= (sub.max_score || 5)).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={notes[sub.id] || ''}
                    onChange={(e) => handleNotesChange(sub.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="auditor-btn auditor-btn-primary"
              onClick={handleSaveScores}
              disabled={savingScores || !canEdit}
            >
              {savingScores ? 'Saving scores…' : 'Save scores for this category'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

