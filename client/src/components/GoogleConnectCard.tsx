import React, { useState, useEffect } from 'react';
import { Cloud, ExternalLink, Key, CheckCircle2, AlertCircle, RefreshCw, Lock, Sparkles, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { GoogleProfile } from '../types';

interface GoogleConnectCardProps {
  onConnected: (profile: GoogleProfile) => void;
  currentProfile: GoogleProfile | null;
}

export const GoogleConnectCard: React.FC<GoogleConnectCardProps> = ({
  onConnected,
  currentProfile,
}) => {
  // Make 'token' (OAuth Playground) the default since it has zero GCP setup friction!
  const [activeTab, setActiveTab] = useState<'token' | 'url' | 'custom'>('token');
  const [authCode, setAuthCode] = useState('');
  const [directToken, setDirectToken] = useState('');
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  const [copiedScope, setCopiedScope] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        setSuccessMsg(`Linked to ${response.data.profile.email}`);
        onConnected(response.data.profile);
        return true;
      } else if (response.data.error) {
        setError(response.data.error);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to verify connection');
    }
    return false;
  };

  const handleOpenOAuthUrl = async () => {
    setError(null);
    if (!customClientId && activeTab === 'url') {
      setError('Lütfen Google Cloud Console üzerinden aldığınız Client ID bilginizi girin veya ÖNERİLEN "15 Saniyede Token (Playground)" sekmesini kullanın!');
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
        setError('Failed to generate OAuth URL');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error generating login URL');
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
          setError('Token kaydedildi ancak Google Photos API ile doğrulama başarısız oldu. Lütfen Playground üzerinden geçerli scope aldığınızdan emin olun.');
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#818cf8',
        }}>
          <Cloud size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.2rem' }}>2. Connect Google Photos</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Google Cloud Console kurulumu gerektirmeyen hızlı bağlantı
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'rgba(15, 23, 42, 0.7)',
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
            padding: '8px 10px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'token' ? '#10b981' : 'transparent',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={14} />
          <span>15 Saniyede Hızlı Token (ÖNERİLEN)</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('url'); setError(null); }}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'url' ? '#6366f1' : 'transparent',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Kendi GCP Client ID'n
        </button>
      </div>

      {/* Tab 1: Instant Token (OAuth Playground) - RECOMMENDATION */}
      {activeTab === 'token' && (
        <form onSubmit={handleSaveDirectToken}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '16px',
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}>
            <div style={{ color: '#34d399', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Google OAuth Playground'da Hangi Seçeneği Seçeceğim?
            </div>
            
            <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>
              <a
                href="https://developers.google.com/oauthplayground/"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline' }}
              >
                Google OAuth Playground'ı açtığınızda
              </a> sol tarafta hangi API'yi seçeceğiniz için en hızlı ve kolay yöntem:
            </p>

            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--border-subtle)',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '0.78rem', color: '#a855f7', fontWeight: 700, marginBottom: '6px' }}>
                ⭐ EN HIZLI YÖNTEM ("Input your own scopes" Kutusuna Yapıştırın):
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <code style={{ fontSize: '0.8rem', color: '#38bdf8', wordBreak: 'break-all' }}>
                  https://www.googleapis.com/auth/photoslibrary.appendonly
                </code>
                <button
                  type="button"
                  onClick={handleCopyScope}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  {copiedScope ? '✓ Kopyalandı' : 'Kopyala'}
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Sol menünün en altındaki <strong>"Input your own scopes"</strong> kutusuna bu adresi yapıştırıp enter yapmanız yeterlidir!
              </div>
            </div>

            <ol style={{ paddingLeft: '18px', color: 'var(--text-primary)' }}>
              <li style={{ marginBottom: '6px' }}>
                <strong>Veya listeden bulmak isterseniz:</strong> Sol listeden <strong>"Photos Library API v1"</strong> başlığına tıklayıp <strong><code>https://www.googleapis.com/auth/photoslibrary.appendonly</code></strong> seçeneğini işaretleyin.
              </li>
              <li style={{ marginBottom: '6px' }}>
                Mavi <strong>Authorize APIs</strong> butonuna tıklayın ve Google hesabınızla giriş yapın.
              </li>
              <li>
                Açılan 2. adım ekranda mavi <strong>Exchange authorization code for tokens</strong> butonuna basın ve oluşan <strong>Access token</strong> (<code>ya29...</code> ile başlayan kod) değerini kopyalayıp aşağıya yapıştırın!
              </li>
            </ol>
          </div>

          <div className="form-group">
            <label className="form-label">Google Access Token (ya29. ile başlar)</label>
            <input
              type="password"
              className="form-input"
              value={directToken}
              onChange={(e) => setDirectToken(e.target.value)}
              placeholder="ya29.a0..."
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-success"
            style={{ width: '100%' }}
            disabled={loading || !directToken.trim()}
          >
            <Key size={18} />
            <span>Token'ı Kaydet ve Doğrula</span>
          </button>
        </form>
      )}

      {/* Tab 2: Custom GCP Client ID / URL */}
      {activeTab === 'url' && (
        <div>
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '0.83rem',
            color: 'var(--text-secondary)',
          }}>
            Google, harici uygulamalar için Google Cloud Console (APIs & Services → Credentials) üzerinden kendi oluşturduğunuz bir <strong>OAuth Client ID</strong> gerektirir.
          </div>

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
            <span>Google Giriş Penceresini Aç</span>
          </button>

          <form onSubmit={handleExchangeCode}>
            <div className="form-group">
              <label className="form-label">Açılan penceredeki Authorization Code (kod verilirse)</label>
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
              <span>Kodu Doğrulayıp Bağlan</span>
            </button>
          </form>
        </div>
      )}

      {/* Messages */}
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
          marginTop: '16px',
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
          borderRadius: '8px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>Bağlanıldı: <strong>{currentProfile.email}</strong></span>
          </div>
          <button
            type="button"
            onClick={checkGoogleStatus}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#34d399',
              cursor: 'pointer',
            }}
            title="Refresh status"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
