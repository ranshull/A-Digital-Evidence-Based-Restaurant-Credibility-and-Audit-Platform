import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { superadmin } from '../../api';
import './SuperAdminReport.css';

export default function SuperAdminReport() {
  const { restaurantId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    setError('');
    superadmin
      .report(Number(restaurantId))
      .then(({ data: res }) => setData(res))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="superadmin-report-loading">Loading report...</div>;
  if (error || !data) return <div className="superadmin-report-error">{error || 'Report not found.'}</div>;

  const categories = data.categories || [];
  const hasScores = categories.some((c) => c.is_applicable && c.score != null);

  return (
    <div className="superadmin-report-page">
      <div className="superadmin-report-no-print superadmin-report-toolbar">
        <Link to="/superadmin/logs" className="superadmin-report-back">← Back to Logs</Link>
        <button type="button" className="superadmin-report-print-btn" onClick={handlePrint}>
          <span className="superadmin-report-print-icon" aria-hidden>🖨</span>
          Print
        </button>
      </div>

      <div className="superadmin-report-document">
        <header className="superadmin-report-header">
          <h1>Scoring report</h1>
          <p className="superadmin-report-restaurant-name">{data.restaurant_name}</p>
          {data.last_audit_at && (
            <p className="superadmin-report-audit-date">
              Last audit: {new Date(data.last_audit_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
            </p>
          )}
        </header>

        <section className="superadmin-report-score-section">
          <h2>Overall score</h2>
          <p className="superadmin-report-overall">
            {data.overall_score != null ? (
              <span className="superadmin-report-score-value">{data.overall_score.toFixed(1)}</span>
            ) : (
              <span className="superadmin-report-score-na">—</span>
            )}
            {data.badge && (
              <span className={`superadmin-report-badge superadmin-report-badge-${(data.badge || '').toLowerCase().replace('_', '-')}`}>
                {data.badge}
              </span>
            )}
          </p>
        </section>

        {categories.length > 0 && (
          <section className="superadmin-report-categories">
            <h2>Category breakdown</h2>
            <table className="superadmin-report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Score</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, i) => (
                  <tr key={i}>
                    <td>{cat.name}</td>
                    <td>
                      {cat.is_applicable && cat.score != null ? (
                        <span>{Number(cat.score).toFixed(1)}</span>
                      ) : (
                        <span className="superadmin-report-na">N/A</span>
                      )}
                    </td>
                    <td>{cat.weight != null ? `${(Number(cat.weight) * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {!hasScores && (
          <p className="superadmin-report-no-scores">No scores have been submitted for this restaurant yet.</p>
        )}
      </div>
    </div>
  );
}
