import React, { useState, useEffect } from 'react';
import { Server, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { ImmichServerInfo } from '../types';

interface ImmichConnectCardProps {
  onConnected: (info: ImmichServerInfo) => void;
  currentInfo: ImmichServerInfo | null;
}

export const ImmichConnectCard: React.FC<ImmichConnectCardProps> = ({
  onConnected,
  currentInfo,
}) => {
  const [url, setUrl] = useState('http://localhost:2283');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load saved settings on mount
    axios.get('/api/settings').then((res) => {
      if (res.data?.settings?.immichUrl) {
        setUrl(res.data.settings.immichUrl);
      }
      if (res.data?.settings?.immichApiKey) {
        setApiKey(res.data.settings.immichApiKey);
      }
    }).catch(() => {});
  }, []);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await axios.post('/api/immich/test', {
        immichUrl: url.trim(),
        immichApiKey: apiKey.trim(),
      });

      if (response.data.success && response.data.serverInfo) {
        setSuccessMsg(`Connected to Immich v${response.data.serverInfo.version}`);
        onConnected(response.data.serverInfo);
      } else {
        setError('Unexpected response from server');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to connect to Immich';
      setError(msg);
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
          background: 'rgba(6, 182, 212, 0.15)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#06b6d4',
        }}>
          <Server size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.2rem' }}>1. Connect Immich Server</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Enter your self-hosted Immich URL and API Key
          </p>
        </div>
      </div>

      <form onSubmit={handleTestConnection}>
        <div className="form-group">
          <label className="form-label">Immich Server URL</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. http://localhost:2283"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Immich API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              className="form-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Immich API key here"
              required
            />
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Find your API key in Immich → Account Settings → API Keys
          </div>

          <div style={{
            padding: '12px 14px',
            background: 'rgba(6, 182, 212, 0.06)',
            borderRadius: '8px',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.45'
          }}>
            <strong style={{ color: '#22d3ee', display: 'block', marginBottom: '6px' }}>
              🔑 How to Generate an Immich API Key
            </strong>
            <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>In the Immich Web UI, click your avatar and open <strong>Account Settings</strong>.</li>
              <li>Navigate to the <strong>API Keys</strong> section and click <strong>"New API Key"</strong>.</li>
              <li>
                <strong>Minimum Required Permissions:</strong>
                <ul style={{ paddingLeft: '16px', marginTop: '3px', marginBottom: '3px', color: '#94a3b8' }}>
                  <li><code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '4px', color: '#38bdf8' }}>Asset: Read</code> — To stream original resolution media and EXIF metadata</li>
                  <li><code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '4px', color: '#38bdf8' }}>Album: Read</code> — To list albums for Google Photos structure replication</li>
                </ul>
              </li>
              <li>Copy the generated API key and paste it into the input field above.</li>
            </ol>
          </div>
        </div>

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
            marginBottom: '16px',
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {currentInfo && !successMsg && (
          <div style={{
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            color: '#22d3ee',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}>
            <CheckCircle2 size={18} />
            <span>Active: {currentInfo.user?.name} — Immich v{currentInfo.version}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Testing Connection...</span>
            </>
          ) : (
            <>
              <Key size={18} />
              <span>{currentInfo ? 'Re-test & Save Credentials' : 'Connect Immich'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
