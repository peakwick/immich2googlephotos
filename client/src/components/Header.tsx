import React from 'react';
import { RefreshCcw, HardDrive, Cloud, Terminal } from 'lucide-react';
import { ImmichServerInfo, GoogleProfile } from '../types';

interface HeaderProps {
  immichInfo: ImmichServerInfo | null;
  googleProfile: GoogleProfile | null;
  onOpenLogs: () => void;
  logsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  immichInfo,
  googleProfile,
  onOpenLogs,
  logsCount,
}) => {
  return (
    <header style={{
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '16px 32px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
          }}>
            <RefreshCcw size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', lineHeight: 1.2 }}>
              Immich <span className="gradient-text">→ Google Photos</span>
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              100% Original Bit-for-Bit Migration Engine
            </p>
          </div>
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Immich Pill */}
          <div className={`badge ${immichInfo ? 'badge-success' : 'badge-warning'}`}>
            <HardDrive size={14} />
            <span>Immich: {immichInfo ? `${immichInfo.user?.name} (v${immichInfo.version})` : 'Not Connected'}</span>
          </div>

          {/* Google Photos Pill */}
          <div className={`badge ${googleProfile ? 'badge-success' : 'badge-warning'}`}>
            <Cloud size={14} />
            <span>Google: {googleProfile ? googleProfile.email : 'Not Connected'}</span>
          </div>

          {/* Activity Logs Terminal Button */}
          <button
            onClick={onOpenLogs}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Terminal size={16} />
            <span>Live Logs</span>
            {logsCount > 0 && (
              <span style={{
                background: '#06b6d4',
                color: '#000',
                borderRadius: '999px',
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {logsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
