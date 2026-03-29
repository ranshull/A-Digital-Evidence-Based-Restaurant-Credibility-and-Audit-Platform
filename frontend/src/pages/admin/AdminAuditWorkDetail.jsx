import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { admin, rubric } from '../../api';
import { useAuth } from '../../context/AuthContext';
import './AdminAuditWorkDetail.css';

function emptyScoresForCategory(cat) {
  const scores = {};
  const notes = {};
  for (const sub of cat.subcategories || []) {
    scores[sub.id] = 0;
    notes[sub.id] = '';
  }
  return { scores, notes };
}

function hydrateFromWork(work, categories) {
  const scoresByCat = {};
  const notesByCat = {};
  for (const c of categories || []) {
    const { scores, notes } = emptyScoresForCategory(c);
    scoresByCat[c.id] = { ...scores };
    notesByCat[c.id] = { ...notes };
  }
  for (const row of work.staging_scores || []) {
    if (scoresByCat[row.category_id]) {
      scoresByCat[row.category_id][row.subcategory_id] = row.score;
    }
    if (notesByCat[row.category_id]) {
      notesByCat[row.category_id][row.subcategory_id] = row.notes || '';
    }
  }
  return { scoresByCat, notesByCat };
}

/** All subcategories have a staged row for this category (server). */
function hasCategoryStagedScores(cat, stagingScores) {
  const subs = cat.subcategories || [];
  if (subs.length === 0) return false;
  const rows = (stagingScores || []).filter((r) => r.category_id === cat.id);
  const have = new Set(rows.map((r) => r.subcategory_id));
  return subs.every((s) => have.has(s.id));
}

function photosForCategoryId(photos, categoryId) {
  return (photos || []).filter((p) => p.category_id === categoryId);
}

/** Full read-only report: evidence + scores (and N/A). */
function AuditVisitReport({ work, photos, categories }) {
  const naSet = new Set(work.category_marked_na || []);
  const staging = work.staging_scores || [];

  return (
    <div className="audit-work-detail-report">
      <div className="audit-work-detail-report-head">
        <p>
          <strong>Restaurant:</strong> {work.restaurant_name}
        </p>
        <p>
          <strong>Owner:</strong> {work.owner_name}
        </p>
        <p>
          <strong>Audited by:</strong> {work.assigned_to_name || '—'}
        </p>
        {work.submitted_to_admin_at && (
          <p>
            <strong>Submitted to admin:</strong>{' '}
            {new Date(work.submitted_to_admin_at).toLocaleString()}
          </p>
        )}
        {work.published_at && (
          <p>
            <strong>Published:</strong> {new Date(work.published_at).toLocaleString()}
          </p>
        )}
      </div>
      {categories.map((cat) => {
        const isNa = naSet.has(cat.id);
        const catPhotos = photosForCategoryId(photos, cat.id);
        const rows = staging.filter((r) => r.category_id === cat.id);

        return (
          <div key={cat.id} className="audit-work-detail-report-cat">
            <h3 className="audit-work-detail-report-cat-title">{cat.name}</h3>
            {isNa && <p className="audit-work-detail-report-na">Not applicable for this visit.</p>}
            {!isNa && catPhotos.length > 0 && (
              <div className="audit-work-detail-report-photos">
                {catPhotos.map((p) => (
                  <a
                    key={p.photo_id}
                    href={p.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="audit-work-detail-report-thumb"
                  >
                    <img src={p.image_url} alt="" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            {!isNa && rows.length > 0 && (
              <div className="audit-work-detail-report-table-wrap">
                <table className="audit-work-detail-report-table">
                  <thead>
                    <tr>
                      <th>Subcategory</th>
                      <th>Score</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.subcategory_id}>
                        <td>{r.subcategory_name}</td>
                        <td>{r.score}</td>
                        <td>{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!isNa && catPhotos.length === 0 && rows.length === 0 && (
              <p className="audit-work-detail-report-empty">No evidence or scores for this category.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAuditWorkDetail() {
  const { workId } = useParams();
  const { user } = useAuth();
  const [work, setWork] = useState(null);
  const [categories, setCategories] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [scoresByCat, setScoresByCat] = useState({});
  const [notesByCat, setNotesByCat] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingCat, setUploadingCat] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [savingEvidenceCat, setSavingEvidenceCat] = useState(null);
  const [savingScoresCat, setSavingScoresCat] = useState(null);
  const [savingNaCat, setSavingNaCat] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingScoreCatIds, setEditingScoreCatIds] = useState([]);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showSubmitReport, setShowSubmitReport] = useState(false);
  const [submitReportSnapshot, setSubmitReportSnapshot] = useState(null);

  const loadAll = useCallback(() => {
    setError('');
    return Promise.all([
      admin.getAuditWork(workId),
      admin.auditWorkPhotos(workId).catch(() => ({ data: [] })),
      rubric.categories(),
    ])
      .then(([workRes, photosRes, catRes]) => {
        const w = workRes.data;
        setWork(w);
        const p = photosRes.data;
        setPhotos(Array.isArray(p) ? p : []);
        const raw = catRes.data;
        const catList = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
        setCategories(catList);
        const { scoresByCat: sc, notesByCat: nc } = hydrateFromWork(w, catList);
        setScoresByCat(sc);
        setNotesByCat(nc);
        return w;
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'));
  }, [workId]);

  useEffect(() => {
    setLoading(true);
    setEditingScoreCatIds([]);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const isDraft = work?.submission_status === 'DRAFT';
  const canEdit =
    work &&
    isDraft &&
    work.status !== 'DONE' &&
    (user?.role === 'SUPER_ADMIN' || work.is_assigned_to_me);

  const photosSaved = new Set(work?.category_photos_saved || []);
  const naSet = new Set(work?.category_marked_na || []);

  const photosForCategory = (categoryId) => photos.filter((p) => p.category_id === categoryId);

  const handlePickFiles = (categoryId, e) => {
    const files = e.target.files;
    if (!files?.length || !canEdit) return;
    setUploadingCat(categoryId);
    const queue = Array.from(files);
    let chain = Promise.resolve();
    queue.forEach((file) => {
      chain = chain.then(() => admin.uploadAuditWorkPhoto(workId, file, categoryId));
    });
    chain
      .then(() => loadAll())
      .catch((err) => setError(err.response?.data?.detail || 'Upload failed'))
      .finally(() => {
        setUploadingCat(null);
        e.target.value = '';
      });
  };

  const handleDeletePhoto = (photoId) => {
    if (!canEdit) return;
    setDeletingId(photoId);
    admin
      .deleteAuditWorkPhoto(workId, photoId)
      .then(() => loadAll())
      .catch((err) => setError(err.response?.data?.detail || 'Delete failed'))
      .finally(() => setDeletingId(null));
  };

  const handleSaveEvidence = (categoryId) => {
    if (!canEdit) return;
    setSavingEvidenceCat(categoryId);
    admin
      .saveAuditCategoryPhotos(workId, categoryId)
      .then(() => loadAll())
      .catch((err) => setError(err.response?.data?.detail || 'Save failed'))
      .finally(() => setSavingEvidenceCat(null));
  };

  const handleMarkNA = (cat, mark) => {
    if (!canEdit) return;
    if (mark) {
      setSavingNaCat(cat.id);
      admin
        .submitAuditStagingScores(workId, {
          category_id: cat.id,
          is_category_applicable: false,
          subcategories: [],
        })
        .then(() => loadAll())
        .catch((err) => setError(err.response?.data?.detail || 'Could not mark N/A'))
        .finally(() => setSavingNaCat(null));
    }
  };

  const handleScoreChange = (catId, subId, value) => {
    setScoresByCat((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [subId]: value === '' ? undefined : Number(value) },
    }));
  };

  const handleNotesChange = (catId, subId, value) => {
    setNotesByCat((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [subId]: value },
    }));
  };

  const startEditScores = (catId) => {
    setEditingScoreCatIds((prev) => (prev.includes(catId) ? prev : [...prev, catId]));
  };

  const handleSaveScores = (cat) => {
    if (!canEdit) return;
    const subs = cat.subcategories || [];
    const sc = scoresByCat[cat.id] || {};
    const nt = notesByCat[cat.id] || {};
    const subcategories = subs.map((sub) => ({
      subcategory_id: sub.id,
      score: sc[sub.id] ?? 0,
      notes: nt[sub.id] || '',
    }));
    const needNotes = subcategories.some(
      (s) => (s.score === 0 || s.score === 1) && !(nt[s.subcategory_id] || '').trim(),
    );
    if (needNotes) {
      setError('Notes are required for scores 0 or 1.');
      return;
    }
    setSavingScoresCat(cat.id);
    admin
      .submitAuditStagingScores(workId, {
        category_id: cat.id,
        is_category_applicable: true,
        subcategories,
      })
      .then(() => loadAll())
      .then(() => {
        setEditingScoreCatIds((prev) => prev.filter((id) => id !== cat.id));
      })
      .catch((err) => setError(err.response?.data?.detail || 'Save failed'))
      .finally(() => setSavingScoresCat(null));
  };

  const openSubmitConfirm = () => {
    setError('');
    setShowSubmitConfirm(true);
  };

  const confirmSubmitToAdmin = () => {
    if (!canEdit) return;
    setSubmitting(true);
    setError('');
    admin
      .submitAuditToAdmin(workId)
      .then(() =>
        Promise.all([
          admin.getAuditWork(workId),
          admin.auditWorkPhotos(workId).catch(() => ({ data: [] })),
          rubric.categories(),
        ]),
      )
      .then(([wRes, pRes, catRes]) => {
        const w = wRes.data;
        const p = Array.isArray(pRes.data) ? pRes.data : [];
        const raw = catRes.data;
        const catList = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
        setWork(w);
        setPhotos(p);
        setCategories(catList);
        const { scoresByCat: sc, notesByCat: nc } = hydrateFromWork(w, catList);
        setScoresByCat(sc);
        setNotesByCat(nc);
        setSubmitReportSnapshot({ work: w, photos: p, categories: catList });
        setShowSubmitConfirm(false);
        setShowSubmitReport(true);
        setEditingScoreCatIds([]);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Submit failed'))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <div className="admin-loading">Loading visit…</div>;
  if (error && !work) return <div className="admin-error">{error}</div>;
  if (!work) return null;

  const submitted = work.submission_status && work.submission_status !== 'DRAFT';

  return (
    <div className="audit-work-detail">
      <div className="audit-work-detail-header">
        <h1>On-site audit visit</h1>
        <p className="audit-work-detail-meta">
          <strong>{work.restaurant_name}</strong>
          <span className="audit-work-detail-owner">Owner: {work.owner_name}</span>
          <span className={`audit-work-detail-status audit-work-detail-status-${(work.status || '').toLowerCase()}`}>
            {work.status}
          </span>
          <span className="audit-work-detail-submission">
            Review: {work.submission_status || 'DRAFT'}
          </span>
        </p>
        {error && <div className="admin-error-banner">{error}</div>}
      </div>

      {submitted && (
        <div className="audit-work-detail-status-banner" role="status">
          <strong>
            {work.submission_status === 'SUBMITTED_TO_ADMIN' && 'Sent to admin for review'}
            {work.submission_status === 'FLAGGED' && 'Flagged by admin'}
            {work.submission_status === 'PUBLISHED' && 'Published — owner can see updated scores'}
          </strong>
          {work.submitted_to_admin_at && (
            <span className="audit-work-detail-status-banner-time">
              Submitted {new Date(work.submitted_to_admin_at).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {!submitted && (
        <p className="audit-work-detail-intro">
          For each category, upload on-site photos and tap <strong>Save category evidence</strong>, then enter scores.
          After you save scores, you see a summary with <strong>Edit</strong> to change them. When everything is
          complete, submit to admin for approval. Owner credibility updates only after an admin publishes your visit.
        </p>
      )}

      {submitted && (
        <section className="audit-work-detail-submitted-report" aria-labelledby="submitted-report-title">
          <h2 id="submitted-report-title" className="audit-work-detail-submitted-report-title">
            Submission summary
          </h2>
          <div className="audit-work-detail-report-card">
            <AuditVisitReport work={work} photos={photos} categories={categories} />
          </div>
        </section>
      )}

      {!submitted && (
        <div className="audit-work-detail-categories">
          {categories.map((cat) => {
            const isNa = naSet.has(cat.id);
            const evidenceSaved = photosSaved.has(cat.id);
            const catPhotos = photosForCategory(cat.id);
            const canScoreThis = evidenceSaved && (cat.subcategories || []).length > 0;
            const staged = hasCategoryStagedScores(cat, work.staging_scores);
            const showScoreForm =
              canScoreThis && (!staged || editingScoreCatIds.includes(cat.id));
            const showScoreSummary = canScoreThis && staged && !editingScoreCatIds.includes(cat.id);

            return (
              <section key={cat.id} className="audit-work-detail-card">
                <div className="audit-work-detail-card-head">
                  <h2>{cat.name}</h2>
                  {cat.description && <p className="audit-work-detail-card-desc">{cat.description}</p>}
                </div>

                {canEdit && (
                  <label className="audit-work-detail-na">
                    <input
                      type="checkbox"
                      checked={isNa}
                      disabled={!!savingNaCat || isNa}
                      onChange={(e) => {
                        if (e.target.checked) handleMarkNA(cat, true);
                      }}
                    />
                    Not applicable for this visit
                    {isNa && (
                      <span className="audit-work-detail-na-hint">
                        {' '}
                        (Upload photos, save evidence, then save scores to score this category instead.)
                      </span>
                    )}
                  </label>
                )}

                <>
                  <div className="audit-work-detail-grid">
                    {catPhotos.map((p) => (
                      <figure key={p.photo_id} className="audit-work-detail-figure">
                        <img src={p.image_url} alt="" loading="lazy" />
                        {canEdit && (
                          <button
                            type="button"
                            className="audit-work-detail-remove"
                            onClick={() => handleDeletePhoto(p.photo_id)}
                            disabled={deletingId === p.photo_id}
                            aria-label="Remove photo"
                          >
                            {deletingId === p.photo_id ? '…' : '×'}
                          </button>
                        )}
                      </figure>
                    ))}
                  </div>
                  {canEdit && (
                    <>
                      <label className="audit-work-detail-upload">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingCat === cat.id}
                          onChange={(e) => handlePickFiles(cat.id, e)}
                        />
                        <span className="audit-work-detail-upload-label">
                          {uploadingCat === cat.id ? 'Uploading…' : 'Add photos'}
                        </span>
                      </label>
                      <div className="audit-work-detail-save-evidence">
                        <button
                          type="button"
                          className="audit-work-detail-save-btn"
                          disabled={catPhotos.length === 0 || savingEvidenceCat === cat.id}
                          onClick={() => handleSaveEvidence(cat.id)}
                        >
                          {savingEvidenceCat === cat.id ? 'Saving…' : 'Save category evidence'}
                        </button>
                        {evidenceSaved && (
                          <span className="audit-work-detail-saved">Evidence saved — you can score below.</span>
                        )}
                      </div>
                    </>
                  )}
                  {!canEdit && catPhotos.length === 0 && (
                    <p className="audit-work-detail-empty-cat">No photos.</p>
                  )}
                </>

                {showScoreSummary && (
                  <div className="audit-work-detail-scoring audit-work-detail-scoring-summary">
                    <div className="audit-work-detail-scoring-summary-head">
                      <h3 className="audit-work-detail-scoring-title">Saved scores</h3>
                      {canEdit && (
                        <button
                          type="button"
                          className="audit-work-detail-edit-scores"
                          onClick={() => startEditScores(cat.id)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <ul className="audit-work-detail-score-readonly">
                      {(cat.subcategories || []).map((sub) => {
                        const row = (work.staging_scores || []).find(
                          (r) => r.category_id === cat.id && r.subcategory_id === sub.id,
                        );
                        return (
                          <li key={sub.id}>
                            <span className="audit-work-detail-score-readonly-name">{sub.name}</span>
                            <span className="audit-work-detail-score-readonly-val">
                              Score: {row?.score ?? '—'}
                            </span>
                            {(row?.notes || '').trim() ? (
                              <span className="audit-work-detail-score-readonly-notes">{row.notes}</span>
                            ) : (
                              <span className="audit-work-detail-score-readonly-notes muted">No notes</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {showScoreForm && (
                  <div className="audit-work-detail-scoring">
                    <h3 className="audit-work-detail-scoring-title">
                      {staged ? 'Edit scores' : 'Enter scores'}
                    </h3>
                    <div className="audit-work-detail-subs">
                      {(cat.subcategories || []).map((sub) => (
                        <div key={sub.id} className="audit-work-detail-sub">
                          <label>
                            {sub.name} (0–{sub.max_score ?? 5})
                          </label>
                          <select
                            value={scoresByCat[cat.id]?.[sub.id] ?? ''}
                            onChange={(e) => handleScoreChange(cat.id, sub.id, e.target.value)}
                            disabled={!canEdit}
                          >
                            {[0, 1, 2, 3, 4, 5]
                              .filter((n) => n <= (sub.max_score ?? 5))
                              .map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Notes (required for 0 or 1)"
                            value={notesByCat[cat.id]?.[sub.id] || ''}
                            onChange={(e) => handleNotesChange(cat.id, sub.id, e.target.value)}
                            disabled={!canEdit}
                            className="audit-work-detail-notes-inp"
                          />
                        </div>
                      ))}
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        className="audit-work-detail-save-scores"
                        disabled={savingScoresCat === cat.id}
                        onClick={() => handleSaveScores(cat)}
                      >
                        {savingScoresCat === cat.id ? 'Saving scores…' : 'Save scores for this category'}
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {isDraft && (user?.role === 'SUPER_ADMIN' || work.is_assigned_to_me) && (
        <div className="audit-work-detail-actions">
          <button
            type="button"
            className="audit-work-detail-submit"
            onClick={openSubmitConfirm}
            disabled={submitting || !canEdit}
          >
            Submit visit to admin
          </button>
          <p className="audit-work-detail-actions-hint">
            You must complete every active category (photos + scores, or N/A) before submitting.
          </p>
        </div>
      )}

      {showSubmitConfirm && (
        <div
          className="audit-work-detail-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-submit-confirm-title"
        >
          <div className="audit-work-detail-modal">
            <h3 id="audit-submit-confirm-title">Submit this visit to admin?</h3>
            <p>This sends your photos and staging scores for review. You will not be able to edit them until an admin
              returns the visit (if ever).</p>
            <div className="audit-work-detail-modal-actions">
              <button
                type="button"
                className="audit-work-detail-modal-cancel"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="audit-work-detail-modal-confirm"
                onClick={confirmSubmitToAdmin}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Confirm submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubmitReport && submitReportSnapshot && (
        <div
          className="audit-work-detail-modal-overlay audit-work-detail-modal-report"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-submit-report-title"
        >
          <div className="audit-work-detail-modal audit-work-detail-modal-wide">
            <h3 id="audit-submit-report-title">Visit submitted</h3>
            <p className="audit-work-detail-modal-lead">
              Here is everything you sent. Admins will review it under <strong>Auditor evidence</strong>.
            </p>
            <div className="audit-work-detail-modal-report-body">
              <AuditVisitReport
                work={submitReportSnapshot.work}
                photos={submitReportSnapshot.photos}
                categories={submitReportSnapshot.categories}
              />
            </div>
            <div className="audit-work-detail-modal-actions">
              <button
                type="button"
                className="audit-work-detail-modal-confirm"
                onClick={() => setShowSubmitReport(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="audit-work-detail-back">
        <Link to="/admin/review">← Back to audit visit requests</Link>
      </p>
    </div>
  );
}
