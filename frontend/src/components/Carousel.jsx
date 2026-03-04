import { useState, useEffect } from 'react';
import './Carousel.css';

export default function Carousel({ images, alt = '', intervalMs = 0, className = '' }) {
  const [index, setIndex] = useState(0);
  const list = Array.isArray(images) && images.length > 0 ? images : [];

  useEffect(() => {
    if (list.length <= 1 || !intervalMs) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % list.length), intervalMs);
    return () => clearInterval(t);
  }, [list.length, intervalMs]);

  if (list.length === 0) {
    return (
      <div className={`carousel carousel-empty ${className}`.trim()}>
        <div className="carousel-placeholder">No image</div>
      </div>
    );
  }

  const current = typeof list[index] === 'object' && list[index]?.image_url
    ? list[index].image_url
    : list[index];

  const stopNav = (e) => e.stopPropagation();

  return (
    <div className={`carousel ${className}`.trim()} onClick={stopNav}>
      <div className="carousel-slide">
        <img src={current} alt={alt} />
      </div>
      {list.length > 1 && (
        <>
          <button type="button" className="carousel-prev" onClick={(e) => { stopNav(e); setIndex((i) => (i - 1 + list.length) % list.length); }} aria-label="Previous">‹</button>
          <button type="button" className="carousel-next" onClick={(e) => { stopNav(e); setIndex((i) => (i + 1) % list.length); }} aria-label="Next">›</button>
          <div className="carousel-dots">
            {list.map((_, i) => (
              <button key={i} type="button" className={`carousel-dot ${i === index ? 'active' : ''}`} onClick={(e) => { stopNav(e); setIndex(i); }} aria-label={`Slide ${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
