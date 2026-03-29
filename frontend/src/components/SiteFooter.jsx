import { Link } from 'react-router-dom';
import './SiteFooter.css';

function FooterBrandIcon() {
  return (
    <svg className="site-footer-brand-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5l-8-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Marketing footer — link targets must match routes in App.jsx only.
 */
export default function SiteFooter({ className = '' }) {
  return (
    <footer className={`site-footer ${className}`.trim()} role="contentinfo">
      <div className="site-footer-inner">
        <div className="site-footer-col site-footer-brand">
          <Link to="/" className="site-footer-logo">
            <FooterBrandIcon />
            <span className="site-footer-logo-text">FOODAS</span>
          </Link>
          <p className="site-footer-tagline">Evidence-based restaurant credibility</p>
        </div>
        <div className="site-footer-col">
          <h2 className="site-footer-heading">Platform</h2>
          <ul className="site-footer-links">
            <li>
              <Link to="/">Browse restaurants</Link>
            </li>
            <li>
              <Link to="/dashboard">Dashboard</Link>
            </li>
            <li>
              <Link to="/apply">Apply as owner</Link>
            </li>
          </ul>
        </div>
        <div className="site-footer-col">
          <h2 className="site-footer-heading">Account</h2>
          <ul className="site-footer-links">
            <li>
              <Link to="/login">Sign in</Link>
            </li>
            <li>
              <Link to="/register">Create account</Link>
            </li>
            <li>
              <Link to="/profile">Profile</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="site-footer-bar">
        <p className="site-footer-copy">
          © {new Date().getFullYear()} FOODAS. All rights reserved. Built with cryptographic trust infrastructure.
        </p>
        <p className="site-footer-made">Made in India 🇮🇳</p>
      </div>
    </footer>
  );
}
