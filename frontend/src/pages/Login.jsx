import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.email?.[0] || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const loginImageUrl = 'https://i.ibb.co/YxD4kdV/360-F-766411964-t5S6Ip9rzf5gVTgL18TLdDr72BIX4P85.webp';

  return (
    <div className="auth-page auth-page--register">
      <div className="auth-card auth-card--split">
        <div className="auth-card__form">
          <h1>Sign in</h1>
          <p className="auth-subtitle">Restaurant Owner Verification</p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form auth-form--register">
            <label>
              <span className="auth-form__label-text">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label>
              <span className="auth-form__label-text">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
            <div className="auth-form__actions auth-form__actions--register">
              <button type="submit" disabled={submitting} className="auth-btn auth-btn--primary">
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
              <Link to="/register" className="auth-btn auth-btn--secondary">
                Register
              </Link>
            </div>
          </form>
          <p className="auth-footer auth-footer--register">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
        <div className="auth-card__image">
          <img src={loginImageUrl} alt="" />
        </div>
      </div>
    </div>
  );
}
