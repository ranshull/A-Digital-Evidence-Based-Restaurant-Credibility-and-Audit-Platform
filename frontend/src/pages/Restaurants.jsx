import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { restaurants } from '../api';
import Carousel from '../components/Carousel';
import 'leaflet/dist/leaflet.css';
import './Restaurants.css';

const DEBOUNCE_MS = 400;

// Fix default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_CENTER = [20.5937, 78.9629]; // India
const DEFAULT_ZOOM = 5;

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const IconLocation = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconMap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconCards = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {/* Stacked cards: isometric staggered stack with spacing */}
    <path d="M2 17 L22 17 L20 21 L0 21 Z" />
    <path d="M4 10 L22 10 L20 14 L2 14 Z" />
    <path d="M6 3 L22 3 L20 7 L4 7 Z" />
  </svg>
);
const SWIPE_THRESHOLD = 60;

function SwipeCardContent({ r }) {
  if (!r) return null;
  return (
    <>
      <div className="restaurant-card-carousel-wrap">
        <Carousel images={r.photos || []} alt={r.name} intervalMs={4000} className="restaurant-card-carousel" />
        {r.credibility_score != null && (
          <div className="restaurant-card-score">
            <span className="restaurant-card-score-value">{Number(r.credibility_score).toFixed(0)}</span>
            <span className="restaurant-card-score-label">/ 100</span>
          </div>
        )}
      </div>
      <Link to={`/restaurants/${r.id}`} className="restaurant-card-link" onClick={(e) => e.stopPropagation()}>
        <div className="restaurant-card-body">
          <h3>{r.name}</h3>
          <p className="restaurant-address">{r.address}</p>
          <p className="restaurant-city">{r.city}</p>
          {r.operating_hours && <p className="restaurant-hours">{r.operating_hours}</p>}
        </div>
      </Link>
      {r.google_maps_link && (
        <a href={r.google_maps_link} target="_blank" rel="noreferrer" className="restaurant-map-link" onClick={(e) => e.stopPropagation()}>
          <IconLocation /> View on Google Maps →
        </a>
      )}
    </>
  );
}

function MapFitBounds({ locations }) {
  const map = useMap();
  const hasPoints = locations.length > 0;
  useEffect(() => {
    if (!hasPoints) return;
    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 14);
    } else {
      const bounds = L.latLngBounds(locations.map((r) => [Number(r.latitude), Number(r.longitude)]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }, [map, hasPoints, locations]);
  return null;
}

export default function Restaurants() {
  const [list, setList] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'cards' | 'map'
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const swipeStartX = useRef(0);
  const swipeCurrentOffset = useRef(0);

  // Keep swipe index in bounds when list changes or view switches
  useEffect(() => {
    if (list.length === 0) setSwipeIndex(0);
    else setSwipeIndex((i) => Math.min(i, list.length - 1));
  }, [list.length, view]);

  const goPrev = useCallback(() => {
    setSwipeIndex((i) => (i > 0 ? i - 1 : i));
    setSwipeOffset(0);
  }, []);
  const goNext = useCallback(() => {
    setSwipeIndex((i) => (i < list.length - 1 ? i + 1 : i));
    setSwipeOffset(0);
  }, [list.length]);

  const handleSwipeStart = useCallback((e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    swipeStartX.current = x;
    swipeCurrentOffset.current = 0;
    setSwipeOffset(0);
    setIsSwipeDragging(true);
  }, []);

  const handleSwipeMove = useCallback((e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = x - swipeStartX.current;
    swipeCurrentOffset.current = delta;
    setSwipeOffset(delta);
    if (e.cancelable) e.preventDefault();
  }, []);

  const handleSwipeEnd = useCallback(() => {
    const delta = swipeCurrentOffset.current;
    setSwipeOffset(0);
    setIsSwipeDragging(false);
    if (delta > SWIPE_THRESHOLD) goNext();
    else if (delta < -SWIPE_THRESHOLD) goPrev();
  }, [goPrev, goNext]);

  const handleMouseDown = useCallback(
    (e) => {
      handleSwipeStart(e);
      const onMove = (ev) => handleSwipeMove(ev);
      const onUp = () => {
        handleSwipeEnd();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [handleSwipeStart, handleSwipeMove, handleSwipeEnd]
  );

  // Debounce search and city before calling API
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setCityFilter(cityInput.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, cityInput]);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (cityFilter) params.city = cityFilter;
    setLoading(true);
    restaurants
      .list(params)
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [search, cityFilter]);

  const withCoords = useMemo(() => list.filter((r) => r.latitude != null && r.longitude != null), [list]);

  return (
    <div className="restaurants-page">
      <header className="restaurants-header">
        <h1>Restaurants in your area</h1>
        <p className="restaurants-subtitle">Discover the finest dining experiences near you.</p>
        <div className="restaurants-toolbar">
          <div className="restaurants-search">
            <span className="restaurants-search-icon" aria-hidden><IconSearch /></span>
            <input
              type="text"
              placeholder="Search by name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="restaurants-input"
            />
            <span className="restaurants-search-divider" aria-hidden />
            <span className="restaurants-search-icon" aria-hidden><IconLocation /></span>
            <input
              type="text"
              placeholder="Filter by city"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              className="restaurants-input restaurants-input-city"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="restaurants-loading">Loading restaurants...</div>
      ) : view === 'list' ? (
        <div className="restaurants-list">
          {list.length === 0 ? (
            <p className="restaurants-empty">No restaurants found. Try a different search or city.</p>
          ) : (
            <ul className="restaurants-cards">
              {list.map((r) => (
                <li key={r.id} className="restaurant-card">
                  <div className="restaurant-card-carousel-wrap">
                    <Carousel images={r.photos || []} alt={r.name} intervalMs={4000} className="restaurant-card-carousel" />
                    {r.credibility_score != null && (
                      <div className="restaurant-card-score">
                        <span className="restaurant-card-score-value">{Number(r.credibility_score).toFixed(0)}</span>
                        <span className="restaurant-card-score-label">/ 100</span>
                      </div>
                    )}
                  </div>
                  <Link to={`/restaurants/${r.id}`} className="restaurant-card-link">
                    <div className="restaurant-card-body">
                      <h3>{r.name}</h3>
                      <p className="restaurant-address">{r.address}</p>
                      <p className="restaurant-city">{r.city}</p>
                      {r.operating_hours && <p className="restaurant-hours">{r.operating_hours}</p>}
                    </div>
                  </Link>
                  {r.google_maps_link && (
                    <a href={r.google_maps_link} target="_blank" rel="noreferrer" className="restaurant-map-link">
                      <IconLocation /> View on Google Maps →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : view === 'cards' ? (
        <div className="restaurants-swipe-wrap">
          {list.length === 0 ? (
            <p className="restaurants-empty">No restaurants found. Try a different search or city.</p>
          ) : (
            <>
              <div className="restaurants-swipe-viewport">
                <div
                  className={`restaurants-swipe-track ${isSwipeDragging ? 'restaurants-swipe-track-dragging' : ''}`}
                  style={{ transform: `translateX(${swipeOffset}px)` }}
                  onTouchStart={handleSwipeStart}
                  onTouchMove={handleSwipeMove}
                  onTouchEnd={handleSwipeEnd}
                  onMouseDown={handleMouseDown}
                >
                  <div
                    className={`restaurants-swipe-card-slot restaurants-swipe-card-prev ${swipeIndex === 0 ? 'restaurants-swipe-card-empty' : ''}`}
                    onClick={swipeIndex > 0 ? goPrev : undefined}
                    role={swipeIndex > 0 ? 'button' : undefined}
                    tabIndex={swipeIndex > 0 ? 0 : undefined}
                    onKeyDown={swipeIndex > 0 ? (e) => e.key === 'Enter' && goPrev() : undefined}
                    aria-label={swipeIndex > 0 ? 'Previous restaurant' : undefined}
                  >
                    <div className="restaurants-swipe-card-inner">
                      {list[swipeIndex - 1] && <SwipeCardContent r={list[swipeIndex - 1]} />}
                    </div>
                  </div>
                  <div className="restaurants-swipe-card-slot restaurants-swipe-card-center">
                    <div className="restaurants-swipe-card-inner" onMouseDown={(e) => e.stopPropagation()}>
                      {list[swipeIndex] && <SwipeCardContent r={list[swipeIndex]} />}
                    </div>
                  </div>
                  <div
                    className={`restaurants-swipe-card-slot restaurants-swipe-card-next ${swipeIndex >= list.length - 1 ? 'restaurants-swipe-card-empty' : ''}`}
                    onClick={swipeIndex < list.length - 1 ? goNext : undefined}
                    role={swipeIndex < list.length - 1 ? 'button' : undefined}
                    tabIndex={swipeIndex < list.length - 1 ? 0 : undefined}
                    onKeyDown={swipeIndex < list.length - 1 ? (e) => e.key === 'Enter' && goNext() : undefined}
                    aria-label={swipeIndex < list.length - 1 ? 'Next restaurant' : undefined}
                  >
                    <div className="restaurants-swipe-card-inner">
                      {list[swipeIndex + 1] && <SwipeCardContent r={list[swipeIndex + 1]} />}
                    </div>
                  </div>
                </div>
              </div>
              <p className="restaurants-swipe-hint">
                <span className="restaurants-swipe-hint-arrow restaurants-swipe-hint-left" aria-hidden>‹</span>
                <span className="restaurants-swipe-hint-text">Swipe</span>
                <span className="restaurants-swipe-hint-arrow restaurants-swipe-hint-right" aria-hidden>›</span>
              </p>
              <div className="restaurants-swipe-nav">
                <button type="button" className="restaurants-swipe-nav-btn" onClick={goPrev} disabled={swipeIndex === 0} aria-label="Previous">
                  ‹
                </button>
                <span className="restaurants-swipe-nav-counter" aria-live="polite">{swipeIndex + 1}/{list.length}</span>
                <button type="button" className="restaurants-swipe-nav-btn" onClick={goNext} disabled={swipeIndex >= list.length - 1} aria-label="Next">
                  ›
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="restaurants-map-wrap">
          {withCoords.length === 0 ? (
            <p className="restaurants-map-empty">
              No restaurants with location data to show on the map. Add coordinates to restaurants to see them here.
            </p>
          ) : (
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              className="restaurants-map"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFitBounds locations={withCoords} />
              {withCoords.map((r) => (
                <Marker key={r.id} position={[Number(r.latitude), Number(r.longitude)]}>
                  <Popup>
                    <strong>
                      <Link to={`/restaurants/${r.id}`}>{r.name}</Link>
                    </strong>
                    <br />
                    {r.address}, {r.city}
                    {r.credibility_score != null && (
                      <>
                        <br />
                        <span className="restaurant-popup-score">Score: {Number(r.credibility_score).toFixed(0)}/100</span>
                      </>
                    )}
                    <br />
                    <Link to={`/restaurants/${r.id}`}>View details</Link>
                    {r.google_maps_link && (
                      <>
                        {' · '}
                        <a href={r.google_maps_link} target="_blank" rel="noreferrer">Open in Maps</a>
                      </>
                    )}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      )}

      <div className="restaurants-view-float">
        <div className="restaurants-view-toggle" role="group" aria-label="View toggle">
          <span
            className={`restaurants-view-slider ${view === 'list' ? 'slider-list' : view === 'cards' ? 'slider-cards' : 'slider-map'}`}
            aria-hidden
          />
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            <IconList /> List
          </button>
          <button
            type="button"
            className={view === 'cards' ? 'active' : ''}
            onClick={() => setView('cards')}
          >
            <IconCards /> Cards
          </button>
          <button
            type="button"
            className={view === 'map' ? 'active' : ''}
            onClick={() => setView('map')}
          >
            <IconMap /> Map
          </button>
        </div>
      </div>
    </div>
  );
}
