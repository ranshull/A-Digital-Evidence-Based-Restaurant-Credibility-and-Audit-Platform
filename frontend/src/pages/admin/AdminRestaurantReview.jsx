import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { admin } from '../../api';
import './AdminRestaurantReview.css';

export default function AdminRestaurantReview() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [evidenceList, setEvidenceList] = useState([]);
  const [restaurantName, setRestaurantName] = useState('');
  const [rubric, setRubric] = useState([]);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actioning, setActioning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [isApplicable, setIsApplicable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittedSummaryByCategory, setSubmittedSummaryByCategory] = useState({});
  const [showFormByCategory, setShowFormByCategory] = useState({});

  const [readiness, setReadiness] = useState(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  const refreshReadiness = useCallback(() => {
    if (!restaurantId) return;
    admin
      .reviewReadiness(restaurantId)
      .then(({ data }) => setReadiness(data))
      .catch(() => setReadiness({ ready: false, detail: 'Could not check readiness.' }));
  }, [restaurantId]);

  const loadEvidence = useCallback(() => {
    if (!restaurantId) return;
    setLoading(true);
    admin.evidence
      .byRestaurant(restaurantId)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setEvidenceList(list);
        if (list.length > 0 && list[0].restaurant_name) setRestaurantName(list[0].restaurant_name);
        refreshReadiness();
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [restaurantId, refreshReadiness]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  useEffect(() => {
    admin.scores.rubric().then(({ data }) => setRubric(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const category = selectedEvidence
    ? rubric.find((c) => c.id === Number(selectedEvidence.category) || c.id === selectedEvidence.category_id)
    : null;

  useEffect(() => {
    setScores({});
    setNotes({});
    setIsApplicable(true);
  }, [category?.id]);

  const handleApprove = () => {
    if (!selectedEvidence) return;
    setActioning('approve');
    admin.evidence
      .approve(selectedEvidence.id, { review_notes: reviewNotes })
      .then(() => {
        setReviewNotes('');
        setSelectedEvidence((prev) => (prev ? { ...prev, status: 'APPROVED' } : null));
        loadEvidence();
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed'))
      .finally(() => setActioning(null));
  };

  const handleReject = () => {
    if (!selectedEvidence || !reviewNotes.trim()) return;
    setActioning('reject');
    admin.evidence
      .reject(selectedEvidence.id, { review_notes: reviewNotes })
      .then(() => {
        setReviewNotes('');
        setSelectedEvidence(null);
        loadEvidence();
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed'))
      .finally(() => setActioning(null));
  };

  const handleFlag = () => {
    if (!selectedEvidence || !reviewNotes.trim()) return;
    setActioning('flag');
    admin.evidence
      .flag(selectedEvidence.id, { review_notes: reviewNotes })
      .then(() => {
        setReviewNotes('');
        setSelectedEvidence(null);
        loadEvidence();
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed'))
      .finally(() => setActioning(null));
  };

  const handleScoreChange = (subId, value) => {
    setScores((prev) => ({ ...prev, [subId]: value === '' ? undefined : Number(value) }));
  };
  const handleNotesChange = (subId, value) => {
    setNotes((prev) => ({ ...prev, [subId]: value }));
  };

  const handleSubmitScores = () => {
    if (!restaurantId || !category) return;
    const subcategories = category.subcategories.map((sub) => ({
      subcategory_id: sub.id,
      score: scores[sub.id] ?? 0,
      notes: notes[sub.id] || '',
    }));
    const needNotes = subcategories.some((s) => (s.score === 0 || s.score === 1) && !(notes[s.subcategory_id] || '').trim());
    if (isApplicable && needNotes) {
      setError('Notes required for scores 0 or 1.');
      return;
    }
    setError('');
    setSaving(true);
    const payload = {
      restaurant_id: Number(restaurantId),
      category_id: category.id,
      is_category_applicable: isApplicable,
      subcategories: isApplicable ? subcategories : [],
    };
    admin.scores
      .submit(payload)
      .then(() => {
        const total = category.subcategories.reduce((sum, sub) => sum + (sub.max_score || 5), 0);
        const got = category.subcategories.reduce((sum, sub) => sum + (scores[sub.id] ?? 0), 0);
        const categoryScore = total ? Math.round((got / total) * 100) : 0;
        setSubmittedSummaryByCategory((prev) => ({
          ...prev,
          [category.id]: {
            isApplicable,
            categoryScore,
            subcategories: category.subcategories.map((sub) => ({
              id: sub.id,
              name: sub.name,
              score: scores[sub.id] ?? 0,
              notes: notes[sub.id] || '',
            })),
          },
        }));
        setShowFormByCategory((prev) => ({ ...prev, [category.id]: false }));
        refreshReadiness();
      })
      .catch((err) => setError(err.response?.data?.detail || 'Save failed'))
      .finally(() => setSaving(false));
  };

  const handleCompleteReview = () => {
    if (!restaurantId) return;
    setCompleting(true);
    admin
      .completeReview(restaurantId)
      .then(() => {
        setCompleteModalOpen(false);
        navigate('/admin/evidence?tab=completed');
      })
      .catch((err) => setError(err.response?.data?.detail || 'Could not complete review'))
      .finally(() => setCompleting(false));
  };

  const showScoringForm =
    category &&
    selectedEvidence?.status === 'APPROVED' &&
    (!submittedSummaryByCategory[category.id] || showFormByCategory[category.id] === true);

  const showSummaryBlock =
    category && selectedEvidence?.status === 'APPROVED' && submittedSummaryByCategory[category.id] && !showScoringForm;

  if (loading) return <div className="admin-loading">Loading...</div>;
  if (error && !evidenceList.length) return <div className="admin-error">{error}</div>;

  const categoryScore =
    category && isApplicable
      ? (() => {
          const total = category.subcategories.reduce((sum, sub) => sum + (sub.max_score || 5), 0);
          const got = category.subcategories.reduce((sum, sub) => sum + (scores[sub.id] ?? 0), 0);
          return total ? Math.round((got / total) * 100) : 0;
        })()
      : null;

  return (
    <div className="admin-restaurant-review">
      <p className="admin-review-back">
        <Link to="/admin/evidence">← Evidence queue</Link>
      </p>
      <h1>{restaurantName || `Restaurant ${restaurantId}`}</h1>
      {error && <div className="admin-review-error">{error}</div>}

      <section className="admin-review-evidence-list">
        <h2>Evidence</h2>
        <p className="admin-review-hint">Select an item to approve, reject, or flag. After approval, submit scores for that category.</p>
        {evidenceList.length === 0 ? (
          <p className="admin-empty">No evidence for this restaurant.</p>
        ) : (
          <div className="admin-review-evidence-grid">
            {evidenceList.map((e) => (
              <button
                type="button"
                key={e.id}
                className={`admin-review-evidence-card ${selectedEvidence?.id === e.id ? 'selected' : ''} ${e.status.toLowerCase()}`}
                onClick={() => {
                  setSelectedEvidence(e);
                  setReviewNotes('');
                  setError('');
                }}
              >
                {e.file_type === 'IMAGE' ? (
                  <img src={e.file_url} alt="" />
                ) : (
                  <div className="admin-review-evidence-video">Video</div>
                )}
                <span className="admin-review-evidence-meta">{e.category_name}</span>
                <span className={`admin-review-evidence-status ${e.status.toLowerCase()}`}>{e.status}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedEvidence && (
        <section className="admin-review-detail">
          <h2>View evidence</h2>
          <div className="admin-review-big-media">
            {selectedEvidence.file_type === 'IMAGE' ? (
              <img src={selectedEvidence.file_url} alt="" />
            ) : (
              <video src={selectedEvidence.file_url} controls />
            )}
          </div>
          <p className="admin-review-file-meta">
            {selectedEvidence.original_filename} · {(selectedEvidence.file_size_bytes / 1024).toFixed(1)} KB
          </p>
          <p className="admin-review-description">{selectedEvidence.description}</p>

          {selectedEvidence.status === 'PENDING' && (
            <div className="admin-review-actions">
              <textarea
                placeholder="Notes (required for Reject / Flag)"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
              />
              <div className="admin-review-buttons">
                <button type="button" className="btn-approve" onClick={handleApprove} disabled={!!actioning}>
                  {actioning === 'approve' ? '...' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="btn-reject"
                  onClick={handleReject}
                  disabled={!!actioning || !reviewNotes.trim()}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-flag"
                  onClick={handleFlag}
                  disabled={!!actioning || !reviewNotes.trim()}
                >
                  Flag
                </button>
              </div>
            </div>
          )}

          {selectedEvidence.status === 'APPROVED' && category && (
            <div className="admin-review-scoring">
              <h3>Scoring: {category.name}</h3>

              {showSummaryBlock && submittedSummaryByCategory[category.id] && (
                <div className="admin-review-summary-block">
                  <p className="admin-review-summary-title">Saved scores</p>
                  {submittedSummaryByCategory[category.id].isApplicable ? (
                    <>
                      <p>
                        <strong>Category score:</strong> {submittedSummaryByCategory[category.id].categoryScore}/100
                      </p>
                      <ul>
                        {submittedSummaryByCategory[category.id].subcategories.map((s, i) => (
                          <li key={i}>
                            {s.name}: {s.score} {s.notes ? `— ${s.notes}` : ''}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>Marked as Not Applicable</p>
                  )}
                  <button
                    type="button"
                    className="admin-review-btn-edit"
                    onClick={() => {
                      const summary = submittedSummaryByCategory[category.id];
                      if (summary?.subcategories) {
                        const s = {};
                        const n = {};
                        summary.subcategories.forEach((sub) => {
                          if (sub.id != null) {
                            s[sub.id] = sub.score;
                            n[sub.id] = sub.notes || '';
                          }
                        });
                        setScores(s);
                        setNotes(n);
                        setIsApplicable(summary.isApplicable);
                      }
                      setShowFormByCategory((prev) => ({ ...prev, [category.id]: true }));
                    }}
                  >
                    Edit scores
                  </button>
                </div>
              )}

              {showScoringForm && (
                <div className="admin-review-form">
                  <label className="admin-review-na">
                    <input
                      type="checkbox"
                      checked={!isApplicable}
                      onChange={(e) => setIsApplicable(!e.target.checked)}
                    />
                    Mark category as Not Applicable
                  </label>
                  {isApplicable && (
                    <>
                      {category.subcategories.map((sub) => (
                        <div key={sub.id} className="admin-review-sub">
                          <label>
                            {sub.name} (0–{sub.max_score || 5})
                          </label>
                          <select
                            value={scores[sub.id] ?? ''}
                            onChange={(e) => handleScoreChange(sub.id, e.target.value)}
                          >
                            {[0, 1, 2, 3, 4, 5]
                              .filter((n) => n <= (sub.max_score || 5))
                              .map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Notes (0 or 1)"
                            value={notes[sub.id] || ''}
                            onChange={(e) => handleNotesChange(sub.id, e.target.value)}
                          />
                        </div>
                      ))}
                      {categoryScore != null && <p className="admin-review-cat-score">Category score: {categoryScore}/100</p>}
                    </>
                  )}
                  <button type="button" className="admin-review-btn-submit" onClick={handleSubmitScores} disabled={saving}>
                    {saving ? 'Saving...' : 'Submit scores'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="admin-review-finish" aria-labelledby="finish-heading">
        <h2 id="finish-heading">Complete restaurant review</h2>
        <p className="admin-review-readiness">
          {readiness?.ready ? (
            <span className="admin-review-ready">All requirements met. You can finalize this review.</span>
          ) : (
            <span>{readiness?.detail || 'Resolve all pending evidence and finish scoring for categories with approved evidence.'}</span>
          )}
        </p>
        <button
          type="button"
          className="admin-review-btn-complete"
          disabled={!readiness?.ready}
          onClick={() => setCompleteModalOpen(true)}
        >
          Complete restaurant review
        </button>
      </section>

      {completeModalOpen && (
        <div className="admin-review-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="complete-modal-title">
          <div className="admin-review-modal">
            <h2 id="complete-modal-title">Finalize review?</h2>
            <p>
              This marks the evidence review complete, clears your assignment on this restaurant, and records completion. You can
              still find a summary under Evidence queue → Completed.
            </p>
            <div className="admin-review-modal-actions">
              <button type="button" className="admin-review-btn-cancel" onClick={() => setCompleteModalOpen(false)} disabled={completing}>
                Cancel
              </button>
              <button type="button" className="admin-review-btn-confirm" onClick={handleCompleteReview} disabled={completing}>
                {completing ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
