import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { restaurants } from '../api';
import { useAuth } from '../context/AuthContext';
import Carousel from '../components/Carousel';
import 'leaflet/dist/leaflet.css';
import './RestaurantDetail.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function RestaurantDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  const photos = restaurant?.photos ?? [];
  const menuPhotos = useMemo(() => photos.filter((p) => (p.caption || '').toLowerCase() === 'menu'), [photos]);
  const galleryPhotos = useMemo(() => photos.filter((p) => (p.caption || '').toLowerCase() !== 'menu'), [photos]);

  useEffect(() => {
    restaurants
      .get(id)
      .then(({ data }) => setRestaurant(data))
      .catch(() => setError('Restaurant not found or inactive.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    restaurants
      .getScore(id)
      .then(({ data }) => setScoreData(data))
      .catch(() => setScoreData(null));
  }, [id]);

  if (loading) return <div className="restaurant-detail-loading">Loading...</div>;
  if (error || !restaurant) return <div className="restaurant-detail-error">{error || 'Not found'}</div>;

  const hasCoords = restaurant.latitude != null && restaurant.longitude != null;
  const center = hasCoords ? [Number(restaurant.latitude), Number(restaurant.longitude)] : [20.5937, 78.9629];

  const isOwnListing =
    user &&
    user.role === 'OWNER' &&
    user.restaurant_id != null &&
    Number(user.restaurant_id) === Number(id);

  const canSendPrivateFeedback = Boolean(user && !isOwnListing);

  const submitPrivateFeedback = (e) => {
    e.preventDefault();
    setFeedbackMessage('');
    setFeedbackError('');
    const text = feedbackText.trim();
    if (text.length < 5) {
      setFeedbackError('Please write at least a few words.');
      return;
    }
    setFeedbackSending(true);
    restaurants
      .submitPrivateFeedback(id, { message: text })
      .then(({ data }) => {
        setFeedbackMessage(data?.detail || 'Feedback sent.');
        setFeedbackText('');
        setFeedbackOpen(false);
      })
      .catch((err) => {
        setFeedbackError(err.response?.data?.detail || 'Could not send feedback.');
      })
      .finally(() => setFeedbackSending(false));
  };

  return (
    <div className="restaurant-detail">
      <p className="restaurant-detail-back">
        <Link to="/">← Back to restaurants</Link>
      </p>
      <header className="restaurant-detail-header">
        <h1>{restaurant.name}</h1>
        {restaurant.city && <p className="restaurant-detail-city">{restaurant.city}</p>}
      </header>

      {canSendPrivateFeedback && (
        <div className="restaurant-detail-feedback-prompt">
          <button
            type="button"
            className="restaurant-detail-feedback-btn"
            onClick={() => {
              setFeedbackOpen(true);
              setFeedbackError('');
              setFeedbackMessage('');
            }}
          >
            Send private feedback
          </button>
          <p className="restaurant-detail-feedback-hint">
            Only you and the restaurant owner can see this; it is not shown on the public page.
          </p>
        </div>
      )}

      {!user && (
        <p className="restaurant-detail-feedback-login-hint">
          <Link to="/login">Log in</Link> to send private feedback to this restaurant.
        </p>
      )}

      {isOwnListing && (
        <p className="restaurant-detail-feedback-owner-note">This is your listing—private feedback is hidden from visitors.</p>
      )}

      {feedbackMessage && (
        <div className="restaurant-detail-feedback-success" role="status">
          {feedbackMessage}
        </div>
      )}

      {feedbackOpen && (
        <div
          className="restaurant-detail-feedback-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restaurant-feedback-title"
          onClick={() => !feedbackSending && setFeedbackOpen(false)}
        >
          <div
            className="restaurant-detail-feedback-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="restaurant-feedback-title">Private feedback</h2>
            <p className="restaurant-detail-feedback-modal-intro">
              Your message is sent only to the restaurant owner. It will not appear on this public page.
            </p>
            <form onSubmit={submitPrivateFeedback}>
              <label className="restaurant-detail-feedback-label" htmlFor="restaurant-feedback-text">
                Message
              </label>
              <textarea
                id="restaurant-feedback-text"
                className="restaurant-detail-feedback-textarea"
                rows={5}
                maxLength={2000}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Write your message…"
                disabled={feedbackSending}
              />
              {feedbackError && <p className="restaurant-detail-feedback-form-error">{feedbackError}</p>}
              <div className="restaurant-detail-feedback-modal-actions">
                <button
                  type="button"
                  className="restaurant-detail-feedback-cancel"
                  onClick={() => setFeedbackOpen(false)}
                  disabled={feedbackSending}
                >
                  Cancel
                </button>
                <button type="submit" className="restaurant-detail-feedback-submit" disabled={feedbackSending}>
                  {feedbackSending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scoreData && (
        <section className="restaurant-detail-section restaurant-detail-score">
          <h2>Credibility score</h2>
          <div className="restaurant-detail-score-card">
            <div className="restaurant-detail-score-main">
              <span className="restaurant-detail-score-value">
                {scoreData.overall_score != null
                  ? `${Math.round(Number(scoreData.overall_score))}/100`
                  : '—'}
              </span>
              <span className={`restaurant-detail-score-badge ${(scoreData.badge || '').toLowerCase().replace('_', '-')}`}>
                {scoreData.badge === 'AUDITOR_VERIFIED' && 'Auditor verified'}
                {(scoreData.badge === 'PROVISIONAL' || scoreData.badge === 'ADMIN_VERIFIED') && 'Provisional'}
                {!['AUDITOR_VERIFIED', 'ADMIN_VERIFIED', 'PROVISIONAL'].includes(scoreData.badge) && (scoreData.badge || '—')}
              </span>
            </div>
            {scoreData.last_audit_at && (
              <p className="restaurant-detail-score-meta">
                Last reviewed: {new Date(scoreData.last_audit_at).toLocaleDateString()}
              </p>
            )}
          </div>
          {scoreData.categories && scoreData.categories.length > 0 && (
            <div className="restaurant-detail-score-breakdown">
              <h3>Category breakdown</h3>
              <ul>
                {scoreData.categories
                  .filter((c) => c.is_applicable && c.score != null)
                  .map((c) => (
                    <li key={c.name}>
                      <span className="restaurant-detail-cat-name">{c.name}</span>
                      <span className="restaurant-detail-cat-score">{Math.round(Number(c.score))}/100</span>
                    </li>
                  ))}
              </ul>
              {scoreData.categories.filter((c) => c.is_applicable && c.score != null).length === 0 && (
                <p className="restaurant-detail-score-no-cats">No category scores yet.</p>
              )}
            </div>
          )}
        </section>
      )}

      {photos.length > 0 && (
        <section className="restaurant-detail-hero">
          <Carousel images={photos} alt={restaurant.name} intervalMs={4500} className="restaurant-detail-carousel" />
        </section>
      )}

      <div className="restaurant-detail-grid">
        <section className="restaurant-detail-info">
          {restaurant.address && (
            <p className="restaurant-detail-address">
              <strong>Address</strong><br />
              {restaurant.address}{restaurant.city ? `, ${restaurant.city}` : ''}
            </p>
          )}
          {restaurant.phone && (
            <p className="restaurant-detail-phone">
              <strong>Phone</strong><br />
              <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>
            </p>
          )}
          {restaurant.operating_hours && (
            <p className="restaurant-detail-hours">
              <strong>Hours</strong><br />
              {restaurant.operating_hours}
            </p>
          )}
          {restaurant.google_maps_link && (
            <p>
              <a href={restaurant.google_maps_link} target="_blank" rel="noreferrer" className="restaurant-detail-map-link">
                Open in Google Maps →
              </a>
            </p>
          )}
        </section>

        {hasCoords && (
          <section className="restaurant-detail-map-section">
            <MapContainer
              center={center}
              zoom={15}
              className="restaurant-detail-map"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={center}>
                <Popup>
                  <strong>{restaurant.name}</strong>
                  <br />
                  {restaurant.address}, {restaurant.city}
                </Popup>
              </Marker>
            </MapContainer>
          </section>
        )}
      </div>

      {menuPhotos.length > 0 && (
        <section className="restaurant-detail-section restaurant-detail-menu">
          <h2>Menu</h2>
          <div className="restaurant-detail-photo-grid">
            {menuPhotos.map((p) => (
              <figure key={p.id} className="restaurant-detail-photo-fig">
                <img src={p.image_url} alt={p.caption || 'Menu'} />
                {p.caption && <figcaption>{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {galleryPhotos.length > 0 && (
        <section className="restaurant-detail-section restaurant-detail-gallery">
          <h2>Gallery</h2>
          <p className="restaurant-detail-gallery-intro">Kitchen, dining, storefront & more.</p>
          <div className="restaurant-detail-photo-grid">
            {galleryPhotos.map((p) => (
              <figure key={p.id} className="restaurant-detail-photo-fig">
                <img src={p.image_url} alt={p.caption || 'Restaurant'} />
                {p.caption && <figcaption>{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
