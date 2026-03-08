import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ name, email, phone, password });
      navigate('/login', { state: { message: 'Registration successful. Please sign in.' } });
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.email?.[0] ||
        data?.detail ||
        (typeof data === 'object' ? JSON.stringify(data) : 'Registration failed.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const registerImageUrl = 'https://i.ibb.co/YxD4kdV/360-F-766411964-t5S6Ip9rzf5gVTgL18TLdDr72BIX4P85.webp';

  return (
    <div className="auth-page auth-page--register">
      <div className="auth-card auth-card--split">
        <div className="auth-card__form">
          <h1>Sign up</h1>
          <p className="auth-subtitle">Apply for owner access after signing up.</p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form auth-form--register">
            <label>
              <span className="auth-form__label-text">Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </label>
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
              <span className="auth-form__label-text">Phone (optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
              />
            </label>
            <label>
              <span className="auth-form__label-text">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min 8 characters"
              />
            </label>
            <div className="auth-form__actions auth-form__actions--register">
              <button type="submit" disabled={submitting} className="auth-btn auth-btn--primary">
                {submitting ? 'Creating account...' : 'Sign up'}
              </button>
              <Link to="/login" className="auth-btn auth-btn--secondary">
                Sign in
              </Link>
            </div>
          </form>
          <p className="auth-footer auth-footer--register">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
        <div className="auth-card__image">
          <img src={registerImageUrl} alt="" />
        </div>
      </div>
    </div>
  );
}
