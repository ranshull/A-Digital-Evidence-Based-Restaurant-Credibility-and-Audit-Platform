import { useEffect, useState } from 'react';
import { crypto, restaurants, admin } from '../../api';
import './SuperAdminCryptoStatus.css';

export default function SuperAdminCryptoStatus() {
  const [restaurantFilter, setRestaurantFilter] = useState('');
  const [restaurantsList, setRestaurantsList] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [selectedRestaurantName, setSelectedRestaurantName] = useState('');

  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState('');
  const [chainResult, setChainResult] = useState(null);

  const [evidenceList, setEvidenceList] = useState([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceCryptoById, setEvidenceCryptoById] = useState({});

  useEffect(() => {
    restaurants
      .list()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setRestaurantsList(list);
      })
      .catch(() => {
        setRestaurantsList([]);
      });
  }, []);

  const filteredRestaurants = restaurantsList.filter((r) => {
    const name = (r.name || '').toLowerCase();
    const city = (r.city || '').toLowerCase();
    const q = restaurantFilter.toLowerCase();
    return !q || name.includes(q) || city.includes(q);
  });

  const handleSelectRestaurant = (e) => {
    const value = e.target.value;
    setSelectedRestaurantId(value);
    setEvidenceList([]);
    setEvidenceCryptoById({});
    setChainResult(null);
    setChainError('');
    setEvidenceError('');
    if (!value) {
      setSelectedRestaurantName('');
      return;
    }
    const r = restaurantsList.find((x) => String(x.id) === value);
    setSelectedRestaurantName(r ? r.name : `Restaurant ${value}`);
    const idNum = Number(value);
    if (!idNum || Number.isNaN(idNum)) return;
    handleCheckChain(idNum);
    loadEvidenceForRestaurant(idNum);
  };

  const loadEvidenceForRestaurant = (id) => {
    setEvidenceLoading(true);
    setEvidenceError('');
    admin.evidence
      .byRestaurant(id)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setEvidenceList(list);
      })
      .catch((err) => {
        setEvidenceError(err.response?.data?.detail || 'Failed to load evidence.');
        setEvidenceList([]);
      })
      .finally(() => {
        setEvidenceLoading(false);
      });
  };

  const handleCheckChain = async (idOverride) => {
    const id = typeof idOverride === 'number' ? idOverride : Number(selectedRestaurantId);
    if (!id || Number.isNaN(id)) return;
    setChainLoading(true);
    setChainError('');
    setChainResult(null);
    try {
      const { data } = await crypto.verifyChain(id);
      setChainResult(data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to verify chain.';
      setChainError(msg);
    } finally {
      setChainLoading(false);
    }
  };

  const handleCheckEvidence = async (evidenceId) => {
    const id = Number(evidenceId);
    if (!id || Number.isNaN(id)) return;
    setEvidenceLoading(true);
    setEvidenceError('');
    try {
      const [integrityRes, tsRes] = await Promise.all([
        crypto.integrityCheck(id),
        crypto.verifyTimestamp(id),
      ]);
      setEvidenceCryptoById((prev) => ({
        ...prev,
        [id]: {
          integrity: integrityRes.data,
          timestamp: tsRes.data,
        },
      }));
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to verify evidence.';
      setEvidenceError(msg);
    } finally {
      setEvidenceLoading(false);
    }
  };

  const renderChainBadge = () => {
    if (!chainResult) return null;
    const isValid = chainResult.is_valid ?? chainResult.valid ?? true;
    return (
      <span className={`crypto-badge ${isValid ? 'ok' : 'bad'}`}>
        Chain: {isValid ? 'OK' : 'BROKEN'}
      </span>
    );
  };

  const renderEvidenceBadges = (evidenceId) => {
    const cryptoForId = evidenceCryptoById[evidenceId];
    if (!cryptoForId) return null;
    const { integrity, timestamp } = cryptoForId;
    const isIntact = integrity?.is_intact ?? true;
    const tsValid = timestamp?.signature_valid ?? timestamp?.is_valid ?? true;
    const backdatingSuspicious = timestamp?.backdating?.suspicious ?? false;
    return (
      <div className="crypto-badges-row">
        <span className={`crypto-badge ${isIntact ? 'ok' : 'bad'}`}>
          Integrity: {isIntact ? 'OK' : 'FAIL'}
        </span>
        <span className={`crypto-badge ${tsValid ? 'ok' : 'bad'}`}>
          Timestamp: {tsValid ? 'OK' : 'FAIL'}
        </span>
        {backdatingSuspicious && (
          <span className="crypto-badge warn">
            Backdating: suspicious
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="superadmin-crypto-page">
      <h1>Crypto status</h1>
      <p className="superadmin-crypto-intro">
        Internal SuperAdmin view for checking hash-chain and evidence cryptographic status.
        This is a thin wrapper over the existing crypto verification APIs.
      </p>

      <section className="superadmin-crypto-card">
        <h2>Restaurant hash chain</h2>
        <p className="superadmin-crypto-help">
          Pick a restaurant by name and verify its hash chain.
        </p>
        <div className="superadmin-crypto-row">
          <label htmlFor="restaurant-filter-input">Filter</label>
          <input
            id="restaurant-filter-input"
            type="text"
            value={restaurantFilter}
            onChange={(e) => setRestaurantFilter(e.target.value)}
            placeholder="Search by name or city"
          />
          <select
            value={selectedRestaurantId}
            onChange={handleSelectRestaurant}
          >
            <option value="">Select restaurant…</option>
            {filteredRestaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.city ? `(${r.city})` : ''}
              </option>
            ))}
          </select>
        </div>
        {chainError && <div className="superadmin-crypto-error">{chainError}</div>}
        {selectedRestaurantId && (
          <p className="superadmin-crypto-selected">
            Selected: {selectedRestaurantName} (ID {selectedRestaurantId})
          </p>
        )}
        {renderChainBadge()}
        {chainResult && (
          <details className="superadmin-crypto-details">
            <summary>Raw response</summary>
            <pre>{JSON.stringify(chainResult, null, 2)}</pre>
          </details>
        )}
      </section>

      <section className="superadmin-crypto-card">
        <h2>Evidence crypto checks</h2>
        <p className="superadmin-crypto-help">
          After selecting a restaurant, click an evidence row to run integrity and timestamp verification.
        </p>
        {evidenceError && <div className="superadmin-crypto-error">{evidenceError}</div>}
        {evidenceLoading && <div className="superadmin-crypto-help">Loading evidence…</div>}
        {!evidenceLoading && selectedRestaurantId && evidenceList.length === 0 && (
          <p className="superadmin-crypto-help">No evidence found for this restaurant.</p>
        )}
        {!evidenceLoading && evidenceList.length > 0 && (
          <div className="superadmin-crypto-evidence-table-wrapper">
            <table className="superadmin-crypto-evidence-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Filename</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((e) => (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td>{e.category_name}</td>
                    <td>{e.status}</td>
                    <td className="superadmin-crypto-filename">{e.original_filename}</td>
                    <td>
                      <button
                        type="button"
                        className="superadmin-crypto-check-btn"
                        onClick={() => handleCheckEvidence(e.id)}
                        disabled={evidenceLoading}
                      >
                        Check crypto
                      </button>
                      {renderEvidenceBadges(e.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

