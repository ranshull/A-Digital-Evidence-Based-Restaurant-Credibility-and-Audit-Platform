import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { admin, rubric } from '../../api';
import './AdminAuditorEvidence.css';

function buildScoreState(detail, categories) {
  const scoresByCat = {};
  const notesByCat = {};
  for (const c of categories) {
    scoresByCat[c.id] = {};
    notesByCat[c.id] = {};
    for (const sub of c.subcategories || []) {
      scoresByCat[c.id][sub.id] = 0;
      notesByCat[c.id][sub.id] = '';
    }
  }
  for (const row of detail.staging_scores || []) {
    if (scoresByCat[row.category_id]) {
      scoresByCat[row.category_id][row.subcategory_id] = row.score;
    }
    if (notesByCat[row.category_id]) {
      notesByCat[row.category_id][row.subcategory_id] = row.notes || '';
    }
  }
  return { scoresByCat, notesByCat };
}

function photosForCategory(photos, categoryId) {
  return (photos || []).filter((p) => p.category_id === categoryId);
}

/** Read-only report: header, per-category photos + scores / N/A. */
function AdminAuditVisitReport({ detail, categories }) {
  const naSet = new Set(detail.category_marked_na || []);
  const staging = detail.staging_scores || [];

  return (
    <article className="admin-audit-report">
      <header className="admin-audit-report-header">
        <h2 className="admin-audit-report-title">Auditor field visit report</h2>
        <dl className="admin-audit-report-meta">
          <div>
            <dt>Restaurant</dt>
            <dd>{detail.restaurant_name}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{detail.owner_name}</dd>
          </div>
          <div>
            <dt>Field auditor</dt>
            <dd>{detail.assigned_to_name || '—'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{detail.submission_status}</dd>
          </div>
          {detail.submitted_to_admin_at && (
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(detail.submitted_to_admin_at).toLocaleString()}</dd>
            </div>
          )}
          {detail.flagged_at && (
            <div>
              <dt>Flagged</dt>
              <dd>{new Date(detail.flagged_at).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </header>

      <div className="admin-audit-report-body">
        {categories.map((cat) => {
          const isNa = naSet.has(cat.id);
          const catPhotos = photosForCategory(detail.photos, cat.id);
          const rows = staging.filter((r) => r.category_id === cat.id);

          return (
            <section key={cat.id} className="admin-audit-report-section">
              <h3 className="admin-audit-report-section-title">{cat.name}</h3>
              {cat.description && (
                <p className="admin-audit-report-section-desc">{cat.description}</p>
              )}

              {isNa && (
                <p className="admin-audit-report-na">Marked as not applicable for this visit.</p>
              )}

              {!isNa && catPhotos.length > 0 && (
                <div className="admin-audit-report-photos">
                  <h4 className="admin-audit-report-subhead">Evidence photos</h4>
                  <div className="admin-audit-report-photo-grid">
                    {catPhotos.map((p) => (
                      <a
                        key={p.photo_id}
                        href={p.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-audit-report-photo"
                      >
                        <img src={p.image_url} alt="" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {!isNa && rows.length > 0 && (
                <div className="admin-audit-report-scores">
                  <h4 className="admin-audit-report-subhead">Scores & notes</h4>
                  <div className="admin-audit-report-table-wrap">
                    <table className="admin-audit-report-table">
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
                            <td>{(r.notes || '').trim() ? r.notes : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!isNa && catPhotos.length === 0 && rows.length === 0 && (
                <p className="admin-audit-report-empty">No photos or scores for this category.</p>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}

export default function AdminAuditorEvidenceDetail() {
  const { workId } = useParams();
  const [detail, setDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [scoresByCat, setScoresByCat] = useState({});
  const [notesByCat, setNotesByCat] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCat, setSavingCat] = useState(null);
  const [approving, setApproving] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [editingScores, setEditingScores] = useState(false);
  const [editReason, setEditReason] = useState('');

  const loadAll = useCallback(() => {
    setError('');
    return Promise.all([admin.auditorEvidenceDetail(workId), rubric.categories()])
      .then(([dRes, catRes]) => {
        const d = dRes.data;
        setDetail(d);
        const raw = catRes.data;
        const catList = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
        setCategories(catList);
        const { scoresByCat: sc, notesByCat: nc } = buildScoreState(d, catList);
        setScoresByCat(sc);
        setNotesByCat(nc);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'));
  }, [workId]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const canEditStaging =
    detail &&
    ['SUBMITTED_TO_ADMIN', 'FLAGGED'].includes(detail.submission_status);
  const canApprove =
    detail && ['SUBMITTED_TO_ADMIN', 'FLAGGED'].includes(detail.submission_status);

  const naSet = new Set(detail?.category_marked_na || []);

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

  const saveCategory = (cat) => {
    if (!canEditStaging || !editingScores) return;
    const reason = editReason.trim();
    if (reason.length < 3) {
      setError('Enter a reason for this edit (at least 3 characters) before saving.');
      return;
    }
    if (naSet.has(cat.id)) {
      setSavingCat(cat.id);
      admin
        .auditorEvidenceStagingScores(workId, {
          category_id: cat.id,
          is_category_applicable: false,
          subcategories: [],
          edit_reason: reason,
        })
        .then(() => loadAll())
        .catch((err) => setError(err.response?.data?.detail || 'Save failed'))
        .finally(() => setSavingCat(null));
      return;
    }
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
    setSavingCat(cat.id);
    admin
      .auditorEvidenceStagingScores(workId, {
        category_id: cat.id,
        is_category_applicable: true,
        subcategories,
        edit_reason: reason,
      })
      .then(() => loadAll())
      .catch((err) => setError(err.response?.data?.detail || 'Save failed'))
      .finally(() => setSavingCat(null));
  };

  const handleApprove = () => {
    setApproving(true);
    admin
      .auditorEvidenceApprove(workId)
      .then(() => loadAll())
      .catch((err) => setError(err.response?.data?.detail || 'Approve failed'))
      .finally(() => {
        setApproving(false);
        setShowApproveModal(false);
      });
  };

  if (loading) return <div className="admin-loading">Loading…</div>;
  if (error && !detail) return <div className="admin-error">{error}</div>;
  if (!detail) return null;

  const editLog = detail.staging_edit_log || [];

  return (
    <div className="admin-auditor-evidence-page admin-auditor-evidence-detail">
      <p className="admin-auditor-evidence-back">
        <Link to="/admin/auditor-evidence">← Auditor evidence queue</Link>
      </p>

      {error && <div className="admin-auditor-evidence-error">{error}</div>}

      <div className="admin-audit-report-page">
        <AdminAuditVisitReport detail={detail} categories={categories} />

        {editLog.length > 0 && (
          <section className="admin-audit-report-edit-log" aria-labelledby="edit-log-title">
            <h3 id="edit-log-title" className="admin-audit-report-edit-log-title">
              Admin staging edits (audit trail)
            </h3>
            <ol className="admin-audit-report-edit-log-list">
              {editLog.map((entry, idx) => (
                <li key={`${entry.at}-${idx}`}>
                  <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                  <span className="admin-audit-report-edit-log-who">{entry.admin_name || 'Admin'}</span>
                  {entry.category_id != null && (
                    <span className="admin-audit-report-edit-log-cat">
                      {categories.find((c) => c.id === entry.category_id)?.name || `Category ${entry.category_id}`}
                    </span>
                  )}
                  <blockquote className="admin-audit-report-edit-log-reason">{entry.reason}</blockquote>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {canEditStaging && !editingScores && (
        <div className="admin-auditor-evidence-edit-cta">
          <button
            type="button"
            className="admin-auditor-evidence-edit-open"
            onClick={() => {
              setError('');
              setEditingScores(true);
            }}
          >
            Edit staging scores
          </button>
          <p className="admin-auditor-evidence-edit-cta-hint">
            Opens the scoring form below. Each save requires a short reason (stored for audit).
          </p>
        </div>
      )}

      {canEditStaging && editingScores && (
        <section className="admin-auditor-evidence-edit-panel" aria-labelledby="edit-panel-title">
          <div className="admin-auditor-evidence-edit-panel-head">
            <h2 id="edit-panel-title">Edit staging scores</h2>
            <button
              type="button"
              className="admin-auditor-evidence-edit-cancel"
              onClick={() => {
                setEditingScores(false);
                setEditReason('');
                setError('');
                if (detail) {
                  const { scoresByCat: sc, notesByCat: nc } = buildScoreState(detail, categories);
                  setScoresByCat(sc);
                  setNotesByCat(nc);
                }
              }}
            >
              Close editor
            </button>
          </div>
          <label className="admin-auditor-evidence-reason-label">
            Reason for edit
            <textarea
              className="admin-auditor-evidence-reason-input"
              rows={3}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Explain why you are changing scores (required for each save; min. 3 characters)."
            />
          </label>

          <div className="admin-auditor-evidence-section admin-auditor-evidence-edit-cats">
            {categories.map((cat) => {
              const isNa = naSet.has(cat.id);
              return (
                <div key={cat.id} className="admin-auditor-evidence-cat">
                  <h3>
                    {cat.name}
                    {isNa && <span className="admin-auditor-evidence-na-tag"> N/A</span>}
                  </h3>
                  {!isNa && (cat.subcategories || []).length > 0 && (
                    <div className="admin-auditor-evidence-subs">
                      {(cat.subcategories || []).map((sub) => (
                        <div key={sub.id} className="admin-auditor-evidence-sub">
                          <label>
                            {sub.name} (0–{sub.max_score ?? 5})
                          </label>
                          <select
                            value={scoresByCat[cat.id]?.[sub.id] ?? ''}
                            onChange={(e) => handleScoreChange(cat.id, sub.id, e.target.value)}
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
                            placeholder="Notes"
                            value={notesByCat[cat.id]?.[sub.id] || ''}
                            onChange={(e) => handleNotesChange(cat.id, sub.id, e.target.value)}
                            className="admin-auditor-evidence-notes"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="admin-auditor-evidence-save-cat"
                    disabled={savingCat === cat.id}
                    onClick={() => saveCategory(cat)}
                  >
                    {savingCat === cat.id ? 'Saving…' : `Save ${cat.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="admin-auditor-evidence-actions">
        {canApprove && (
          <button
            type="button"
            className="admin-auditor-evidence-approve"
            disabled={approving}
            onClick={() => setShowApproveModal(true)}
          >
            Approve & publish
          </button>
        )}
        {detail.submission_status === 'PUBLISHED' && (
          <p className="admin-auditor-evidence-published">Published. Owner scores are updated.</p>
        )}
      </div>

      {showApproveModal && (
        <div
          className="admin-auditor-evidence-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-modal-title"
        >
          <div className="admin-auditor-evidence-modal">
            <h3 id="approve-modal-title">Publish scores to owner?</h3>
            <p>
              This will update the restaurant&apos;s published credibility scores and recompute the overall score.
              Confirm only if the evidence and staging scores look correct.
            </p>
            <div className="admin-auditor-evidence-modal-actions">
              <button type="button" className="admin-auditor-evidence-modal-cancel" onClick={() => setShowApproveModal(false)}>
                Cancel
              </button>
              <button type="button" className="admin-auditor-evidence-modal-confirm" disabled={approving} onClick={handleApprove}>
                {approving ? 'Publishing…' : 'Confirm publish'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
