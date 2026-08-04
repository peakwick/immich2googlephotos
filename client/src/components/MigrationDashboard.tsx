import React from 'react';
import {
  Play,
  Pause,
  Square,
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  Folder,
} from 'lucide-react';
import { MigrationProgress } from '../types';

interface MigrationDashboardProps {
  progress: MigrationProgress;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  disabled: boolean;
}

export const MigrationDashboard: React.FC<MigrationDashboardProps> = ({
  progress,
  onStart,
  onPause,
  onResume,
  onCancel,
  disabled,
}) => {
  const isRunning = progress.status === 'RUNNING';
  const isPaused = progress.status === 'PAUSED';
  const isIdle = progress.status === 'IDLE' || progress.status === 'COMPLETED' || progress.status === 'CANCELLED' || progress.status === 'ERROR';

  const totalProcessed = progress.completedAssets + progress.failedAssets + progress.skippedAssets;
  const percentage = progress.totalAssets > 0
    ? Math.min(100, Math.round((totalProcessed / progress.totalAssets) * 100))
    : 0;

  const speedMb = (progress.speedBytesPerSec / (1024 * 1024)).toFixed(2);

  const formatEta = (ms: number) => {
    if (!ms || ms <= 0) return '00s';
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    if (min > 0) {
      return `${min}m ${remainSec}s`;
    }
    return `${remainSec}s`;
  };

  return (
    <div className="glass-card" style={{ border: isRunning ? '1px solid rgba(6, 182, 212, 0.4)' : undefined }}>
      {/* Title & Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #06b6d4, #10b981)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
          }}>
            <Activity size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.3rem' }}>4. Migration Engine & Real-Time Stream</h3>
              {isRunning && <div className="pulse-indicator" title="Active stream" />}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              100% bit-for-bit transmission without re-encoding
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div style={{
          background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: isRunning ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
          padding: '8px 16px',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: '0.85rem',
          color: isRunning ? '#34d399' : '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>STATUS:</span>
          <span style={{ color: isRunning ? '#10b981' : isPaused ? '#f59e0b' : '#38bdf8' }}>
            {progress.status}
          </span>
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Progress: {totalProcessed} of {progress.totalAssets} items ({percentage}%)
          </span>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="#06b6d4" />
              <strong>{speedMb} MB/s</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} color="#a855f7" />
              <strong>ETA: {formatEta(progress.etaMs)}</strong>
            </span>
          </div>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '14px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {progress.completedAssets}
          </div>
        </div>

        <div style={{
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          padding: '14px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#22d3ee', fontWeight: 600, textTransform: 'uppercase' }}>Skipped (Existing)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {progress.skippedAssets}
          </div>
        </div>

        <div style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.2)',
          padding: '14px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>Failed</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {progress.failedAssets}
          </div>
        </div>

        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          padding: '14px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>Total Items</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {progress.totalAssets}
          </div>
        </div>
      </div>

      {/* Active Transfer Info Box */}
      {(isRunning || isPaused) && progress.currentAsset && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06b6d4',
            }}>
              <FileImage size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>
                {progress.currentAsset.filename}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                {progress.currentAlbum && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Folder size={12} /> {progress.currentAlbum}
                  </span>
                )}
                <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  {progress.currentAsset.type}
                </span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} />
            <span>EXIF & Original Metadata Intact</span>
          </div>
        </div>
      )}

      {/* Action Controls */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {isIdle && (
          <button
            onClick={onStart}
            className="btn btn-primary"
            style={{ flex: 1, padding: '14px' }}
            disabled={disabled}
          >
            <Play size={20} fill="#fff" />
            <span>Start Migration</span>
          </button>
        )}

        {isRunning && (
          <button
            onClick={onPause}
            className="btn btn-secondary"
            style={{ flex: 1, padding: '14px', border: '1px solid #f59e0b', color: '#fbbf24' }}
          >
            <Pause size={20} />
            <span>Pause Migration</span>
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResume}
            className="btn btn-success"
            style={{ flex: 1, padding: '14px' }}
          >
            <Play size={20} fill="#fff" />
            <span>Resume Migration</span>
          </button>
        )}

        {(isRunning || isPaused) && (
          <button
            onClick={onCancel}
            className="btn btn-danger"
            style={{ padding: '14px 24px' }}
          >
            <Square size={18} />
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};
