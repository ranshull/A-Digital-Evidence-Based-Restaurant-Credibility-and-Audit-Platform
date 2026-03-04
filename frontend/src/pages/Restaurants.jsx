import { useState, useEffect, useMemo } from 'react';
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
  const [view, setView] = useState('list'); // 'list' | 'map'

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
        <p className="restaurants-subtitle">Browse and find restaurants. Use search or the map view.</p>
        <div className="restaurants-toolbar">
          <div className="restaurants-search">
            <input
              type="text"
              placeholder="Search by name, address or city..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="restaurants-input"
            />
            <input
              type="text"
              placeholder="Filter by city"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              className="restaurants-input restaurants-input-city"
            />
          </div>
          <div className="restaurants-view-toggle">
            <button
              type="button"
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              type="button"
              className={view === 'map' ? 'active' : ''}
              onClick={() => setView('map')}
            >
              Map
            </button>
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
                      View on Google Maps →
                    </a>
                  )}
                </li>
              ))}
            </ul>
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
                    <strong><a href={`/restaurants/${r.id}`}>{r.name}</a></strong>
                    <br />
                    {r.address}, {r.city}
                    <br />
                    <a href={`/restaurants/${r.id}`}>View details</a>
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
    </div>
  );
}
