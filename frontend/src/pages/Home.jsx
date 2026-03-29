import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import SiteFooter from '../components/SiteFooter';
import './Home.css';

function IconXCircle() {
  return (
    <svg className="home-problem-card-icon-svg" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#dc2626" />
      <path
        d="M17 17l14 14M31 17L17 31"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg className="home-problem-card-icon-svg" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#f59e0b" />
      <text x="24" y="32" textAnchor="middle" fontSize="24" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
        $
      </text>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="home-problem-card-icon-svg" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <g fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16.5" cy="17.5" r="4" />
        <path d="M9 38c0-5.2 3.4-9 7.5-9s7.5 3.8 7.5 9" />
        <circle cx="31.5" cy="17.5" r="4" />
        <path d="M24 38c0-5.2 3.4-9 7.5-9s7.5 3.8 7.5 9" />
      </g>
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg className="home-problem-card-icon-svg" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <path
        d="M24 9L41 39H7L24 9z"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M24 18v11M24 33h.01" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLightbulb() {
  return (
    <svg className="home-problem-callout-icon-svg" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <g fill="none" stroke="#ca8a04" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 6a9 9 0 019 9c0 4.5-2 7-2 11h-14c0-4-2-6.5-2-11a9 9 0 019-9z" />
        <path d="M17 30h14M18 35h12" />
      </g>
    </svg>
  );
}

function ProcessIconCamera() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3.5" />
      </g>
    </svg>
  );
}

function ProcessIconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l2.5 2.5L16 9" />
      </g>
    </svg>
  );
}

function ProcessIconTarget() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

function ProcessIconPeopleThree() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="3.2" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        <circle cx="16" cy="5" r="2.8" />
        <circle cx="20" cy="9" r="2.6" />
      </g>
    </svg>
  );
}

function ScienceIconLink() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </g>
    </svg>
  );
}

function ScienceIconTree() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4.5" r="2.2" fill="#fff" stroke="none" />
        <path d="M12 6.7v4M6 18h12M6 18l-2.5 4.5M18 18l2.5 4.5" />
        <circle cx="3.5" cy="22.5" r="1.6" fill="#fff" stroke="none" />
        <circle cx="12" cy="22.5" r="1.6" fill="#fff" stroke="none" />
        <circle cx="20.5" cy="22.5" r="1.6" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

function TrustIconStopwatch() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="14" r="7.5" />
        <path d="M12 10.5v3.5l2 1.2M10 3h4M12 3v2" />
      </g>
    </svg>
  );
}

function TrustIconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16.5 16.5L20 20" />
      </g>
    </svg>
  );
}

const TRUST_TECH_CARDS = [
  {
    icon: TrustIconStopwatch,
    title: 'Cryptographic Timestamps',
    subtitle: 'Non-repudiation',
    desc: "Mathematical proof of when evidence was uploaded. Can't be backdated or forged.",
    stats: [
      { label: 'SIGNATURE', value: 'HMAC-SHA256' },
      { label: 'TOKENS', value: 'Forgery-resistant' },
      { label: 'ANCHORING', value: 'Blockchain optional' },
      { label: 'PRECISION', value: 'Millisecond' },
    ],
  },
  {
    icon: TrustIconSearch,
    title: 'Multi-Layer Tamper Detection',
    subtitle: '3-method verification',
    desc: 'Automated detection of file modification, metadata manipulation, and image editing.',
    stats: [
      { label: 'METHOD 1', value: 'Hash comparison' },
      { label: 'METHOD 2', value: 'EXIF analysis' },
      { label: 'METHOD 3', value: 'Error Level Analysis' },
      { label: 'RESPONSE', value: 'Auto-flagging' },
    ],
  },
];

const SCIENCE_FEATURES = [
  {
    icon: ScienceIconLink,
    iconVariant: 'teal',
    title: 'Hash Chain Technology',
    subtitle: 'Like blockchain for evidence',
    desc: 'Each evidence upload is cryptographically linked to the previous one, creating an unbreakable chain of proof.',
    stats: [
      { label: 'ALGORITHM', value: 'SHA-256' },
      { label: 'SECURITY', value: '256-bit (bank-level)' },
      { label: 'DETECTION', value: '100% accuracy' },
      { label: 'SPEED', value: 'Sub-second' },
    ],
  },
  {
    icon: ScienceIconTree,
    iconVariant: 'blue',
    title: 'Merkle Tree Verification',
    subtitle: 'O(log n) efficiency',
    desc: 'Verify any piece of evidence in milliseconds without checking thousands of files.',
    stats: [
      { label: '1M EVIDENCE', value: 'Only 20 checks' },
      { label: 'VERIFICATION', value: 'Sub-second' },
      { label: 'STORAGE', value: 'Space-efficient' },
      { label: 'USED BY', value: 'Git, Bitcoin' },
    ],
  },
];

const PROCESS_STEPS = [
  {
    step: 1,
    icon: ProcessIconCamera,
    title: 'Restaurant Uploads Evidence',
    desc: 'Kitchen photos, hygiene certificates, food safety documentation, and compliance records are uploaded with automatic timestamp and GPS verification.',
    badge: '🔐 Cryptographically signed to prevent tampering',
  },
  {
    step: 2,
    icon: ProcessIconCheckCircle,
    title: 'Admin Verifies Evidence',
    desc: 'Our trained administrators review uploaded evidence against a structured rubric covering hygiene, food safety, operational compliance, and customer safety.',
    badge: '🔍 Automatic tamper detection flags suspicious uploads',
  },
  {
    step: 3,
    icon: ProcessIconTarget,
    title: 'Score Calculated & Published',
    desc: 'Credibility score (0-100) is calculated based on verified evidence across weighted categories. Scores are permanently recorded in a tamper-proof chain.',
    badge: '⛓️ Blockchain-inspired hash chain ensures immutability',
  },
  {
    step: 4,
    icon: ProcessIconPeopleThree,
    title: 'Consumers Make Informed Choices',
    desc: 'Diners see transparent scores, verified evidence photos, and can scan QR codes in-restaurant to verify authenticity on the spot.',
    badge: '📱 Mobile-friendly verification interface',
  },
];

export default function Home() {
  const { user } = useAuth();
  const profilePic = user?.profile_picture_url || null;
  const nameInitial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <div className="home-page-bg-layer" aria-hidden="true" />
      <div className="home home-landing">
        <header className="home-nav" role="banner">
          <div className="home-nav-inner">
            <Link to="/" className="home-brand">
              FOODAS
            </Link>
            <nav className="home-nav-sections" aria-label="On this page">
              <a href="#home-section-hero">Home</a>
              <a href="#home-section-reviews">Reviews</a>
              <a href="#home-section-process">Process</a>
              <a href="#home-section-science">Science</a>
              <a href="#home-section-trust">Security</a>
            </nav>
            <div className="home-nav-actions">
              {user ? (
                <Link to="/profile" className="home-nav-user">
                  <span className="home-nav-user-avatar">
                    {profilePic ? (
                      <img src={profilePic} alt="" />
                    ) : (
                      <span className="home-nav-user-avatar-placeholder" aria-hidden="true">
                        {nameInitial}
                      </span>
                    )}
                  </span>
                  <span className="home-nav-user-name">{user.name}</span>
                </Link>
              ) : (
                <Link to="/register" className="home-nav-signup">
                  Sign up
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="home-main" aria-label="Home">
          <div className="home-main-hero-wrap" id="home-section-hero">
            <section className="home-hero" aria-labelledby="home-hero-heading">
              <h1 id="home-hero-heading" className="home-hero-title">
                FOODAS
              </h1>
              <p className="home-hero-subtitle">
                A Digital Evidence Based Restaurant Credibility and Audit Platform
              </p>
              <Link to="/" className="home-hero-cta">
                Browse
              </Link>
            </section>
          </div>

          <section className="home-problem" id="home-section-reviews" aria-labelledby="home-problem-heading">
            <div className="home-problem-inner">
              <h2 id="home-problem-heading" className="home-problem-heading">
                <span className="home-problem-heading-text">Why Traditional Reviews Are </span>
                <span className="home-problem-heading-accent">Broken</span>
              </h2>

              <div className="home-problem-grid">
                <article className="home-problem-card">
                  <div className="home-problem-card-icon-wrap" aria-hidden="true">
                    <IconXCircle />
                  </div>
                  <p className="home-problem-card-stat">35%</p>
                  <h3 className="home-problem-card-title">Fake Reviews</h3>
                  <p className="home-problem-card-desc">
                    Over a third of online reviews are estimated to be fake, paid for, or manipulated by competitors
                    and businesses.
                  </p>
                </article>

                <article className="home-problem-card">
                  <div className="home-problem-card-icon-wrap" aria-hidden="true">
                    <IconDollar />
                  </div>
                  <p className="home-problem-card-stat">₹152 Cr</p>
                  <h3 className="home-problem-card-title">Annual Fraud</h3>
                  <p className="home-problem-card-desc">
                    Businesses and consumers lose crores annually to review manipulation and fake credibility claims.
                  </p>
                </article>

                <article className="home-problem-card">
                  <div className="home-problem-card-icon-wrap" aria-hidden="true">
                    <IconUsers />
                  </div>
                  <p className="home-problem-card-stat">68%</p>
                  <h3 className="home-problem-card-title">Consumer Distrust</h3>
                  <p className="home-problem-card-desc">
                    Most consumers no longer trust online restaurant reviews or ratings from anonymous sources.
                  </p>
                </article>

                <article className="home-problem-card">
                  <div className="home-problem-card-icon-wrap" aria-hidden="true">
                    <IconAlertTriangle />
                  </div>
                  <p className="home-problem-card-stat">0%</p>
                  <h3 className="home-problem-card-title">No Verification</h3>
                  <p className="home-problem-card-desc">
                    No way to verify if food safety claims are real or just marketing. Anyone can claim to be clean.
                  </p>
                </article>
              </div>

              <div className="home-problem-callout-wrap">
                <div className="home-problem-callout" role="note">
                  <div className="home-problem-callout-icon-wrap" aria-hidden="true">
                    <IconLightbulb />
                  </div>
                  <p className="home-problem-callout-text">
                    <strong className="home-problem-callout-lead">The Question:</strong>{' '}
                    <span className="home-problem-callout-muted">
                      How do you know if a restaurant&apos;s hygiene claims are real when anyone can post a 5-star
                      review?
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="home-process" id="home-section-process" aria-labelledby="home-process-heading">
            <div className="home-process-inner">
              <p className="home-process-eyebrow">Evidence-based credibility, not opinions</p>
              <h2 id="home-process-heading" className="home-process-title">
                <span className="home-process-title-dark">How Our Verification </span>
                <span className="home-process-title-gradient">Process Works</span>
              </h2>

              <div className="home-process-grid">
                {PROCESS_STEPS.map(({ step, icon: Icon, title, desc, badge }) => (
                  <article key={step} className="home-process-card">
                    <div className="home-process-card-top">
                      <div className="home-process-card-icon" aria-hidden="true">
                        <Icon />
                      </div>
                      <span className="home-process-card-step">Step {step}</span>
                    </div>
                    <h3 className="home-process-card-title">{title}</h3>
                    <p className="home-process-card-desc">{desc}</p>
                    <div className="home-process-card-badge">{badge}</div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="home-science" id="home-section-science" aria-labelledby="home-science-heading">
            <div className="home-science-inner">
              <p className="home-science-eyebrow">Built on cryptographic trust infrastructure</p>
              <h2 id="home-science-heading" className="home-science-title">
                <span className="home-science-title-dark">The Science Behind </span>
                <span className="home-science-title-gradient">FOODAS</span>
              </h2>

              <div className="home-science-grid">
                {SCIENCE_FEATURES.map(({ icon: Icon, iconVariant, title, subtitle, desc, stats }) => (
                  <article key={title} className="home-science-card">
                    <div className={`home-science-card-icon home-science-card-icon--${iconVariant}`} aria-hidden="true">
                      <Icon />
                    </div>
                    <h3 className="home-science-card-title">{title}</h3>
                    <p className="home-science-card-subtitle">{subtitle}</p>
                    <p className="home-science-card-desc">{desc}</p>
                    <div className="home-science-stats">
                      {stats.map(({ label, value }) => (
                        <div key={label} className="home-science-stat">
                          <span className="home-science-stat-label">{label}</span>
                          <span className="home-science-stat-value">{value}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="home-trust-tech" id="home-section-trust" aria-label="Security and trust">
            <div className="home-trust-tech-inner">
              <div className="home-trust-tech-grid">
                {TRUST_TECH_CARDS.map(({ icon: Icon, title, subtitle, desc, stats }) => (
                  <article key={title} className="home-trust-tech-card">
                    <div className="home-trust-tech-card-icon" aria-hidden="true">
                      <Icon />
                    </div>
                    <h3 className="home-trust-tech-card-title">{title}</h3>
                    <p className="home-trust-tech-card-subtitle">{subtitle}</p>
                    <p className="home-trust-tech-card-desc">{desc}</p>
                    <div className="home-trust-tech-stats">
                      {stats.map(({ label, value }) => (
                        <div key={label} className="home-trust-tech-stat">
                          <span className="home-trust-tech-stat-label">{label}</span>
                          <span className="home-trust-tech-stat-value">{value}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <SiteFooter className="home-site-footer" />
        </main>
      </div>
    </>
  );
}
