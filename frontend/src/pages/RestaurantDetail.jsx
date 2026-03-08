import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { restaurants } from '../api';
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
  const [restaurant, setRestaurant] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="restaurant-detail">
      <p className="restaurant-detail-back">
        <Link to="/">← Back to restaurants</Link>
      </p>
      <header className="restaurant-detail-header">
        <h1>{restaurant.name}</h1>
        {restaurant.city && <p className="restaurant-detail-city">{restaurant.city}</p>}
      </header>

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
                {scoreData.badge === 'ADMIN_VERIFIED' && 'Admin verified'}
                {scoreData.badge === 'PROVISIONAL' && 'Provisional'}
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
