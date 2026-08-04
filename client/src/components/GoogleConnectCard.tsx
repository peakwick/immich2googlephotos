import React, { useState, useEffect } from 'react';
import { Cloud, ExternalLink, Key, CheckCircle2, AlertCircle, RefreshCw, Sparkles, HelpCircle, ArrowRight, X } from 'lucide-react';
import axios from 'axios';
import { GoogleProfile } from '../types';

interface GoogleConnectCardProps {
  onConnected: (profile: GoogleProfile) => void;
  currentProfile: GoogleProfile | null;
  onNextStep?: () => void;
}

export const GoogleConnectCard: React.FC<GoogleConnectCardProps> = ({
  onConnected,
  currentProfile,
  onNextStep,
}) => {
  const [activeTab, setActiveTab] = useState<'token' | 'url'>('token');
  const [authCode, setAuthCode] = useState('');
  const [directToken, setDirectToken] = useState('');
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  const [copiedScope, setCopiedScope] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlaygroundModal, setShowPlaygroundModal] = useState(false);

  const handleCopyScope = () => {
    navigator.clipboard.writeText('https://www.googleapis.com/auth/photoslibrary.appendonly');
    setCopiedScope(true);
    setTimeout(() => setCopiedScope(false), 3000);
  };

  useEffect(() => {
    checkGoogleStatus();
  }, []);

  const checkGoogleStatus = async (): Promise<boolean> => {
    try {
      const response = await axios.get('/api/auth/google/status');
      if (response.data.success && response.data.connected && response.data.profile) {
        onConnected(response.data.profile);
        return true;
      } else if (response.data.error) {
        setError(response.data.error);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to verify Google connection');
    }
    return false;
  };

  const handleOpenOAuthUrl = async () => {
    setError(null);
    if (!customClientId && activeTab === 'url') {
      setError('Please enter your Google Client ID or use the RECOMMENDED Instant Token (Playground) tab!');
      return;
    }
    try {
      const response = await axios.get('/api/auth/google/url', {
        params: {
          ...(customClientId ? { clientId: customClientId } : {}),
          ...(customClientSecret ? { clientSecret: customClientSecret } : {}),
        },
      });
      if (response.data.success && response.data.url) {
        window.open(response.data.url, '_blank', 'width=600,height=700');
      } else {
        setError('Failed to generate OAuth authorization URL');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error generating Google login URL');
    }
  };

  const handleExchangeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/auth/google/callback', {
        code: authCode.trim(),
        ...(customClientId ? { clientId: customClientId } : {}),
        ...(customClientSecret ? { clientSecret: customClientSecret } : {}),
      });

      if (response.data.success) {
        await checkGoogleStatus();
        setAuthCode('');
      } else {
        setError('Failed to exchange authorization code');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Authorization failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDirectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directToken.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/auth/google/token', {
        token: directToken.trim(),
      });
      if (response.data.success) {
        const ok = await checkGoogleStatus();
        if (ok) {
          setDirectToken('');
        } else {
          setError('Token saved but verification failed. Ensure you selected the photoslibrary.appendonly scope in Google Playground.');
        }
      } else {
        setError('Failed to verify token');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
          }}>
            <Cloud size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>2. Authorize Google Photos</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Zero GCP setup friction via Instant Token or custom OAuth credentials
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPlaygroundModal(true)}
          className="help-trigger-btn"
        >
          <HelpCircle size={15} />
          <span>Playground Guide</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '10px',
        padding: '4px',
        marginBottom: '20px',
        border: '1px solid var(--border-subtle)',
      }}>
        <button
          type="button"
          onClick={() => { setActiveTab('token'); setError(null); }}
          style={{
            flex: 1.2,
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'token' ? '#10b981' : 'transparent',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={15} />
          <span>15s Instant Token (RECOMMENDED)</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('url'); setError(null); }}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'url' ? '#6366f1' : 'transparent',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Custom GCP Client ID
        </button>
      </div>

      {/* Tab 1: Instant Token (OAuth Playground) */}
      {activeTab === 'token' && (
        <form onSubmit={handleSaveDirectToken}>
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label">Google Access Token (starts with ya29...)</label>
              <button
                type="button"
                onClick={handleCopyScope}
                className="help-trigger-btn"
                style={{ padding: '2px 8px', fontSize: '0.74rem' }}
              >
                {copiedScope ? '✓ Scope Copied' : 'Copy Scope URL'}
              </button>
            </div>
            <input
              type="password"
              className="form-input"
              value={directToken}
              onChange={(e) => setDirectToken(e.target.value)}
              placeholder="Paste ya29.a0... token here"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-success"
            style={{ width: '100%', marginTop: '6px' }}
            disabled={loading || !directToken.trim()}
          >
            <Key size={18} />
            <span>Save & Validate Token</span>
          </button>
        </form>
      )}

      {/* Tab 2: Custom GCP Client ID */}
      {activeTab === 'url' && (
        <div>
          <div className="form-group">
            <label className="form-label">GCP Client ID</label>
            <input
              type="text"
              className="form-input"
              value={customClientId}
              onChange={(e) => setCustomClientId(e.target.value)}
              placeholder="xxxxxxx.apps.googleusercontent.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">GCP Client Secret</label>
            <input
              type="password"
              className="form-input"
              value={customClientSecret}
              onChange={(e) => setCustomClientSecret(e.target.value)}
              placeholder="GOCSPX-..."
            />
          </div>

          <button
            type="button"
            onClick={handleOpenOAuthUrl}
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '16px' }}
          >
            <ExternalLink size={18} />
            <span>Open Google OAuth Login</span>
          </button>

          <form onSubmit={handleExchangeCode}>
            <div className="form-group">
              <label className="form-label">Authorization Code (if provided in popup)</label>
              <input
                type="text"
                className="form-input"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="4/0A..."
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              disabled={loading || !authCode.trim()}
            >
              <CheckCircle2 size={18} />
              <span>Exchange Code & Authorize</span>
            </button>
          </form>
        </div>
      )}

      {/* Connection Messages & Next Step */}
      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '18px',
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {currentProfile && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>Linked: <strong>{currentProfile.email}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={checkGoogleStatus}
              style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', padding: '4px' }}
              title="Refresh status"
            >
              <RefreshCw size={16} />
            </button>
            {onNextStep && (
              <button
                type="button"
                onClick={onNextStep}
                className="btn btn-success"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                <span>Step 3</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Playground Guide Popover Modal */}
      {showPlaygroundModal && (
        <div className="modal-overlay" onClick={() => setShowPlaygroundModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.1rem' }}>15-Second OAuth Playground Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPlaygroundModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <li>
                  Open <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontWeight: 600 }}>Google OAuth Playground</a>.
                </li>
                <li>
                  At the bottom of the left sidebar, paste this scope URL into <strong>"Input your own scopes"</strong>:
                  <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '10px', borderRadius: '6px', margin: '6px 0', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <code style={{ fontSize: '0.8rem', color: '#38bdf8' }}>https://www.googleapis.com/auth/photoslibrary.appendonly</code>
                    <button type="button" onClick={handleCopyScope} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.74rem' }}>
                      {copiedScope ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </li>
                <li>Click the blue <strong>Authorize APIs</strong> button and sign in with your Google account.</li>
                <li>In Step 2, click <strong>Exchange authorization code for tokens</strong>.</li>
                <li>Copy the generated <strong>Access token</strong> (starts with <code>ya29...</code>) and paste it into the app field.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
