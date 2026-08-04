import React, { useState } from 'react';
import { X, Terminal, CheckCircle2, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { MigrationLogEntry } from '../types';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: MigrationLogEntry[];
  onClear: () => void;
}

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClear,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    if (filter === 'SUCCESS') return l.level === 'success';
    if (filter === 'ERROR') return l.level === 'error' || l.level === 'warn';
    return true;
  });

  const getIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 size={16} color="#34d399" />;
      case 'error':
        return <AlertTriangle size={16} color="#f87171" />;
      case 'warn':
        return <AlertTriangle size={16} color="#fbbf24" />;
      default:
        return <Info size={16} color="#38bdf8" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '760px', height: '80vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={22} color="#06b6d4" />
            <h3 style={{ fontSize: '1.25rem' }}>Live Migration Activity Logs</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClear}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              title="Clear log view"
            >
              <Trash2 size={14} /> Clear
            </button>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 28px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.5)',
        }}>
          <button
            onClick={() => setFilter('ALL')}
            className={`badge ${filter === 'ALL' ? 'badge-info' : ''}`}
            style={{ cursor: 'pointer', background: filter === 'ALL' ? undefined : 'transparent' }}
          >
            All Logs ({logs.length})
          </button>
          <button
            onClick={() => setFilter('SUCCESS')}
            className={`badge ${filter === 'SUCCESS' ? 'badge-success' : ''}`}
            style={{ cursor: 'pointer', background: filter === 'SUCCESS' ? undefined : 'transparent' }}
          >
            Success ({logs.filter((l) => l.level === 'success').length})
          </button>
          <button
            onClick={() => setFilter('ERROR')}
            className={`badge ${filter === 'ERROR' ? 'badge-warning' : ''}`}
            style={{ cursor: 'pointer', background: filter === 'ERROR' ? undefined : 'transparent', borderColor: '#f87171', color: '#f87171' }}
          >
            Errors & Warns ({logs.filter((l) => l.level === 'error' || l.level === 'warn').length})
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', background: '#090d16' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
              No log entries recorded yet.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  background:
                    log.level === 'error'
                      ? 'rgba(244, 63, 94, 0.08)'
                      : log.level === 'success'
                      ? 'rgba(16, 185, 129, 0.05)'
                      : 'transparent',
                }}
              >
                <div style={{ marginTop: '2px' }}>{getIcon(log.level)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      [{log.timestamp}]
                    </span>
                    {log.albumName && (
                      <span style={{ color: '#818cf8', fontSize: '0.75rem' }}>
                        Album: {log.albumName}
                      </span>
                    )}
                  </div>
                  <div style={{
                    color:
                      log.level === 'error'
                        ? '#f87171'
                        : log.level === 'success'
                        ? '#34d399'
                        : log.level === 'warn'
                        ? '#fbbf24'
                        : '#e2e8f0',
                  }}>
                    {log.message}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
