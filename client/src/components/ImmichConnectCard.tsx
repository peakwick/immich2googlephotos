import React, { useState, useEffect } from 'react';
import { Server, Key, CheckCircle2, AlertCircle, Loader2, HelpCircle, ArrowRight, X } from 'lucide-react';
import axios from 'axios';
import { ImmichServerInfo } from '../types';

interface ImmichConnectCardProps {
  onConnected: (info: ImmichServerInfo) => void;
  currentInfo: ImmichServerInfo | null;
  onNextStep?: () => void;
}

export const ImmichConnectCard: React.FC<ImmichConnectCardProps> = ({
  onConnected,
  currentInfo,
  onNextStep,
}) => {
  const [url, setUrl] = useState('http://localhost:2283');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
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
        setError('Unexpected response from Immich server');
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#06b6d4',
          }}>
            <Server size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>1. Connect Immich Server</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Enter your self-hosted Immich URL and API Key
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className="help-trigger-btn"
        >
          <HelpCircle size={15} />
          <span>API Key Guide</span>
        </button>
      </div>

      <form onSubmit={handleTestConnection}>
        <div className="form-group">
          <label className="form-label">Immich Server URL</label>
          <input
            type="text"
            className="form-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. http://192.168.1.21:2283"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Immich API Key</label>
          <input
            type="password"
            className="form-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your Immich API key here"
            required
          />
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
            marginBottom: '18px',
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {currentInfo && (
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
            marginBottom: '18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} />
              <span>Active: <strong>{currentInfo.user?.name || 'Authenticated User'}</strong> (Immich v{currentInfo.version})</span>
            </div>
            {onNextStep && (
              <button
                type="button"
                onClick={onNextStep}
                className="btn btn-success"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                <span>Step 2</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 1 }}
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

          {currentInfo && onNextStep && (
            <button
              type="button"
              onClick={onNextStep}
              className="btn btn-secondary"
              style={{ padding: '12px 20px' }}
            >
              <span>Continue →</span>
            </button>
          )}
        </div>
      </form>

      {/* API Key Guide Popover Modal */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HelpCircle size={20} color="#38bdf8" />
                <h3 style={{ fontSize: '1.1rem' }}>How to Generate an Immich API Key</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <li>In the Immich Web UI, click your user avatar and open <strong>Account Settings</strong>.</li>
                <li>Navigate to the <strong>API Keys</strong> section and click <strong>"New API Key"</strong>.</li>
                <li>
                  <strong>Minimum Required Permissions:</strong>
                  <ul style={{ paddingLeft: '16px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>Asset: Read</code> — To stream raw media files and EXIF metadata</li>
                    <li><code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>Album: Read</code> — To list albums for Google Photos replication</li>
                  </ul>
                </li>
                <li>Copy the generated API Key and paste it into the form.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
