import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { superadmin, crypto } from '../../api';
import './SuperAdminEvidenceDetail.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function getCryptoSummary(result) {
  if (!result || result.error) return { text: result?.error || 'Request failed', status: 'error' };
  const d = result.data;
  if (result.name === 'Integrity check' && d) {
    if (d.tampered && !d.stored_hash) return { text: 'No hash stored — cannot verify', status: 'unknown' };
    if (d.is_intact) return { text: 'File intact', status: 'ok' };
    if (d.tampered) return { text: 'File may be tampered', status: 'fail' };
    return { text: 'Unable to verify', status: 'unknown' };
  }
  if (result.name === 'Timestamp' && d) {
    const ok = d.is_valid === true || d.signature_valid === true;
    return { text: ok ? 'Timestamp verified' : (d.detail || 'Timestamp invalid or missing'), status: ok ? 'ok' : 'fail' };
  }
  if (result.name === 'Merkle proof' && d) {
    const ok = d.proof && d.root_hash;
    return { text: ok ? 'Merkle proof available' : (d.detail || 'Proof missing'), status: ok ? 'ok' : 'fail' };
  }
  if (result.name === 'Hash chain' && d) {
    const ok = d.is_valid === true;
    return { text: ok ? 'Hash chain valid' : (d.detail || `Chain invalid${d.broken_at_index != null ? ` (broken at ${d.broken_at_index})` : ''}`), status: ok ? 'ok' : 'fail' };
  }
  return { text: 'See technical details', status: 'unknown' };
}

export default function SuperAdminEvidenceDetail() {
  const { id } = useParams();
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cryptoResult, setCryptoResult] = useState(null);
  const [cryptoLoading, setCryptoLoading] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    superadmin
      .getEvidence(id)
      .then(({ data }) => setEvidence(data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load evidence'))
      .finally(() => setLoading(false));
  }, [id]);

  const runCheck = (name, fn) => {
    if (!evidence) return;
    setCryptoLoading(name);
    setCryptoResult(null);
    fn()
      .then(({ data }) => setCryptoResult({ name, data, error: null }))
      .catch((err) => setCryptoResult({
        name,
        data: null,
        error: err.response?.data?.detail || err.message || 'Request failed',
      }))
      .finally(() => setCryptoLoading(null));
  };

  const handleVerifyIntegrity = () => runCheck('Integrity check', () => crypto.integrityCheck(evidence.id));
  const handleVerifyTimestamp = () => runCheck('Timestamp', () => crypto.verifyTimestamp(evidence.id));
  const handleMerkleProof = () => runCheck('Merkle proof', () => crypto.merkleProof(evidence.id));
  const handleVerifyChain = () => runCheck('Hash chain', () => crypto.verifyChain(evidence.restaurant));

  if (loading) return <div className="superadmin-evidence-detail-loading">Loading...</div>;
  if (error && !evidence) return <div className="superadmin-evidence-detail-error">{error}</div>;
  if (!evidence) return null;

  const statusLower = (evidence.status || '').toLowerCase();
  const cryptoSummary = cryptoResult ? getCryptoSummary(cryptoResult) : null;

  return (
    <div className="superadmin-evidence-detail-page">
      <p className="superadmin-evidence-detail-back">
        <Link to="/superadmin/evidence">← Back to Evidence list</Link>
      </p>

      <nav className="superadmin-evidence-detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/superadmin/evidence">Evidence</Link>
        <span className="superadmin-evidence-detail-breadcrumb-sep">›</span>
        <span>{evidence.restaurant_name}</span>
        <span className="superadmin-evidence-detail-breadcrumb-sep">›</span>
        <span>{evidence.original_filename || 'Detail'}</span>
      </nav>

      <h1 className="superadmin-evidence-detail-title">Evidence detail</h1>

      <div className="superadmin-evidence-detail-main">
        <section className="superadmin-evidence-detail-file">
          <h2>Evidence file</h2>
          {evidence.file_type === 'IMAGE' ? (
            <img
              src={evidence.file_url}
              alt={evidence.description?.slice(0, 80) || 'Evidence'}
              className="superadmin-evidence-detail-img"
            />
          ) : (
            <video
              src={evidence.file_url}
              controls
              className="superadmin-evidence-detail-video"
            />
          )}
          <p className="superadmin-evidence-detail-meta">
            {evidence.original_filename} · {evidence.file_size_bytes} bytes · {evidence.mime_type}
          </p>
          {evidence.description && (
            <div className="superadmin-evidence-detail-desc-wrap">
              <p className="superadmin-evidence-detail-desc">{evidence.description}</p>
            </div>
          )}
        </section>

        <div className="superadmin-evidence-detail-right">
          <section className="superadmin-evidence-detail-record">
            <h2>Record details</h2>
            <dl className="superadmin-evidence-detail-dl">
              <dt>Restaurant</dt>
              <dd>{evidence.restaurant_name}</dd>
              <dt>Category</dt>
              <dd>{evidence.category_name}</dd>
              <dt>Status</dt>
              <dd>
                <span className={`superadmin-evidence-detail-status superadmin-evidence-detail-status-${statusLower}`}>
                  {evidence.status}
                </span>
              </dd>
              <dt>Uploaded</dt>
              <dd>{formatDate(evidence.upload_timestamp)}</dd>
              <dt>Cryptographically verified</dt>
              <dd>
                <span className={evidence.is_cryptographically_verified ? 'superadmin-evidence-detail-yes' : 'superadmin-evidence-detail-no'}>
                  {evidence.is_cryptographically_verified ? '✓ Yes' : '✗ No'}
                </span>
              </dd>
              {evidence.hash_value != null && (
                <>
                  <dt>Hash (truncated)</dt>
                  <dd><code className="superadmin-evidence-detail-code">{String(evidence.hash_value).slice(0, 24)}…</code></dd>
                </>
              )}
              {evidence.chain_index != null && (
                <>
                  <dt>Chain index</dt>
                  <dd>{evidence.chain_index}</dd>
                </>
              )}
              {evidence.is_chain_valid != null && (
                <>
                  <dt>Chain valid</dt>
                  <dd>
                    <span className={evidence.is_chain_valid ? 'superadmin-evidence-detail-yes' : 'superadmin-evidence-detail-no'}>
                      {evidence.is_chain_valid ? '✓ Yes' : '✗ No'}
                    </span>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="superadmin-evidence-detail-crypto">
            <h2>Cryptographic checks</h2>
            <p className="superadmin-evidence-detail-crypto-hint">
              Run one or more checks below. The result of the last check appears under the buttons.
            </p>
            <div className="superadmin-evidence-detail-buttons">
              <button
                type="button"
                className="superadmin-evidence-detail-btn"
                onClick={handleVerifyIntegrity}
                disabled={cryptoLoading !== null}
                title="Check that the file content matches the hash stored at upload. Detects if the file was changed."
              >
                {cryptoLoading === 'Integrity check' ? '…' : 'Verify integrity'}
              </button>
              <button
                type="button"
                className="superadmin-evidence-detail-btn"
                onClick={handleVerifyTimestamp}
                disabled={cryptoLoading !== null}
                title="Verify the cryptographic timestamp proof for this evidence."
              >
                {cryptoLoading === 'Timestamp' ? '…' : 'Verify timestamp'}
              </button>
              <button
                type="button"
                className="superadmin-evidence-detail-btn"
                onClick={handleMerkleProof}
                disabled={cryptoLoading !== null}
                title="Verify this evidence is included in the restaurant's Merkle tree (leaf belongs to the root hash)."
              >
                {cryptoLoading === 'Merkle proof' ? '…' : 'Merkle proof'}
              </button>
              <button
                type="button"
                className="superadmin-evidence-detail-btn"
                onClick={handleVerifyChain}
                disabled={cryptoLoading !== null}
                title="Verify the hash chain for this restaurant: each evidence links to the previous; detects broken or reordered links."
              >
                {cryptoLoading === 'Hash chain' ? '…' : 'Verify chain (restaurant)'}
              </button>
            </div>

            {cryptoResult && (
              <div className="superadmin-evidence-detail-result">
                <h3>Result: {cryptoResult.name}</h3>
                {cryptoResult.error ? (
                  <p className="superadmin-evidence-detail-result-error">{cryptoResult.error}</p>
                ) : (
                  <>
                    <p className={`superadmin-evidence-detail-summary superadmin-evidence-detail-summary-${cryptoSummary?.status || 'unknown'}`}>
                      {cryptoSummary?.text}
                    </p>
                    <details className="superadmin-evidence-detail-technical">
                      <summary>Technical details</summary>
                      <pre className="superadmin-evidence-detail-pre">
                        {JSON.stringify(cryptoResult.data, null, 2)}
                      </pre>
                    </details>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
