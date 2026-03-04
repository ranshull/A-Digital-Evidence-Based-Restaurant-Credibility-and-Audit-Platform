import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { admin, restaurants } from '../../api';
import './AdminScoring.css';

export default function AdminScoring() {
  const [searchParams] = useSearchParams();
  const restaurantParam = searchParams.get('restaurant');
  const [restaurantList, setRestaurantList] = useState([]);
  const [restaurantId, setRestaurantId] = useState(restaurantParam ? Number(restaurantParam) : '');
  const [rubric, setRubric] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [isApplicable, setIsApplicable] = useState(true);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [evidenceByCategory, setEvidenceByCategory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    restaurants.list().then(({ data }) => setRestaurantList(data.results || data || [])).catch(() => {});
    admin.scores.rubric().then(({ data }) => setRubric(data)).catch(() => setRubric([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (restaurantParam) setRestaurantId(Number(restaurantParam));
  }, [restaurantParam]);

  useEffect(() => {
    if (!restaurantId) {
      setEvidenceByCategory([]);
      return;
    }
    admin.evidence
      .byRestaurant(restaurantId, { status: 'APPROVED' })
      .then(({ data }) => setEvidenceByCategory(Array.isArray(data) ? data : data.results || []))
      .catch(() => setEvidenceByCategory([]));
  }, [restaurantId]);

  const category = rubric.find((c) => c.id === Number(categoryId));
  const evidenceForCategory = category
    ? evidenceByCategory.filter((e) => Number(e.category) === category.id || Number(e.category_id) === category.id)
    : [];

  const handleScoreChange = (subId, value) => {
    setScores((prev) => ({ ...prev, [subId]: value === '' ? undefined : Number(value) }));
  };

  const handleNotesChange = (subId, value) => {
    setNotes((prev) => ({ ...prev, [subId]: value }));
  };

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!restaurantId || !categoryId) {
      setError('Select a restaurant and category.');
      return;
    }
    if (isApplicable && category) {
      const subcategories = category.subcategories.map((sub) => ({
        subcategory_id: sub.id,
        score: scores[sub.id] ?? 0,
        notes: notes[sub.id] || '',
      }));
      const needNotes = subcategories.some((s) => (s.score === 0 || s.score === 1) && !(notes[s.subcategory_id] || '').trim());
      if (needNotes) {
        setError('Notes are required for scores 0 or 1.');
        return;
      }
    }
    setSaving(true);
    const payload = {
      restaurant_id: Number(restaurantId),
      category_id: Number(categoryId),
      is_category_applicable: isApplicable,
      subcategories: isApplicable && category
        ? category.subcategories.map((sub) => ({
            subcategory_id: sub.id,
            score: scores[sub.id] ?? 0,
            notes: notes[sub.id] || '',
          }))
        : [],
    };
    admin.scores
      .submit(payload)
      .then(() => {
        setSuccess('Scores saved.');
        setScores({});
        setNotes({});
      })
      .catch((err) => setError(err.response?.data?.detail || err.response?.data?.subcategories?.[0] || 'Save failed'))
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="admin-loading">Loading...</div>;

  const categoryScore =
    category && isApplicable
      ? (() => {
          const total = category.subcategories.reduce((sum, sub) => sum + (sub.max_score || 5), 0);
          const got = category.subcategories.reduce((sum, sub) => sum + (scores[sub.id] ?? 0), 0);
          return total ? Math.round((got / total) * 100) : 0;
        })()
      : null;

  return (
    <div className="admin-scoring-page">
      <h1>Score restaurant</h1>
      <p className="admin-scoring-back">
        <Link to="/admin/evidence">← Evidence queue</Link>
      </p>
      <div className="admin-scoring-filters">
        <label>
          Restaurant
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select restaurant</option>
            {restaurantList.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select category</option>
            {rubric.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({(c.weight * 100).toFixed(0)}%)</option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="admin-scoring-error">{error}</div>}
      {success && <div className="admin-scoring-success">{success}</div>}
      {restaurantId && category && (
        <>
          <div className="admin-scoring-na">
            <label>
              <input
                type="checkbox"
                checked={!isApplicable}
                onChange={(e) => setIsApplicable(!e.target.checked)}
              />
              Mark category as Not Applicable
            </label>
          </div>
          {isApplicable && (
            <>
              {evidenceForCategory.length > 0 && (
                <div className="admin-scoring-evidence">
                  <strong>Approved evidence for this category</strong>
                  <div className="admin-scoring-evidence-thumbs">
                    {evidenceForCategory.slice(0, 8).map((e) =>
                      e.file_type === 'IMAGE' ? (
                        <a key={e.id} href={e.file_url} target="_blank" rel="noreferrer">
                          <img src={e.file_url} alt="" />
                        </a>
                      ) : (
                        <a key={e.id} href={e.file_url} target="_blank" rel="noreferrer" className="admin-scoring-video">Video</a>
                      )
                    )}
                  </div>
                </div>
              )}
              <div className="admin-scoring-subcategories">
                {category.subcategories.map((sub) => (
                  <div key={sub.id} className="admin-scoring-sub">
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
                      placeholder="Notes (required for 0 or 1)"
                      value={notes[sub.id] || ''}
                      onChange={(e) => handleNotesChange(sub.id, e.target.value)}
                      className="admin-scoring-notes-inp"
                    />
                  </div>
                ))}
              </div>
              {categoryScore != null && (
                <p className="admin-scoring-cat-score">Category score: {categoryScore}/100</p>
              )}
            </>
          )}
          <button type="button" className="admin-scoring-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save scores'}
          </button>
        </>
      )}
    </div>
  );
}
