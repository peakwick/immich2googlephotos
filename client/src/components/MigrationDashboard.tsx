import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  Folder,
  RotateCcw,
  ArrowLeft,
  TerminalSquare,
  RefreshCw,
  UploadCloud,
  FileImage,
  Video,
} from 'lucide-react';
import axios from 'axios';
import { MigrationProgress, ActiveWorkerState } from '../types';

interface MigrationDashboardProps {
  progress: MigrationProgress;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  disabled: boolean;
  onBackStep?: () => void;
}

export const MigrationDashboard: React.FC<MigrationDashboardProps> = ({
  progress,
  onStart,
  onPause,
  onResume,
  onCancel,
  disabled,
  onBackStep,
}) => {
  const isRunning = progress.status === 'RUNNING';
  const isPaused = progress.status === 'PAUSED';
  const isIdle =
    progress.status === 'IDLE' ||
    progress.status === 'COMPLETED' ||
    progress.status === 'CANCELLED' ||
    progress.status === 'ERROR';

  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom when logs change
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [progress.logs]);

  const handleResetHistory = async () => {
    if (
      window.confirm(
        'Are you sure you want to reset the migration database? This will clear local upload history so all assets can be re-migrated.'
      )
    ) {
      try {
        await axios.delete('/api/history');
        alert('Migration database cleared successfully! All photos are ready for re-migration.');
      } catch (err: any) {
        alert('Failed to reset migration history: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const totalProcessed = progress.completedAssets + progress.failedAssets + progress.skippedAssets;
  const percentage =
    progress.totalAssets > 0
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

  // Helper for status colors
  const getWorkerColor = (status: string) => {
    switch (status) {
      case 'DOWNLOADING':
        return '#38bdf8'; // Blue
      case 'UPLOADING':
        return '#a855f7'; // Purple
      case 'SAVING':
        return '#10b981'; // Green
      case 'RETRYING':
        return '#fbbf24'; // Yellow
      default:
        return '#94a3b8'; // Slate
    }
  };

  return (
    <div className="glass-card" style={{ border: isRunning ? '1px solid rgba(6, 182, 212, 0.4)' : undefined, padding: '24px' }}>
      {/* Title & Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #06b6d4, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
            }}
          >
            <Activity size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.3rem' }}>4. Migration Engine</h3>
              {isRunning && <div className="pulse-indicator" title="Active stream" />}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Concurrent, lossless bit-for-bit transmission
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div
          style={{
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
          }}
        >
          <span>STATUS:</span>
          <span style={{ color: isRunning ? '#10b981' : isPaused ? '#f59e0b' : '#38bdf8' }}>
            {progress.status}
          </span>
        </div>
      </div>

      {/* SECTION 1: GLOBAL PROGRESS */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Global Progress: {totalProcessed} of {progress.totalAssets} items ({percentage}%)
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

        <div className="progress-track" style={{ height: '10px' }}>
          <div className="progress-fill" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: '32px',
        }}
      >
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{progress.completedAssets}</div>
        </div>
        <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#22d3ee', fontWeight: 600, textTransform: 'uppercase' }}>Skipped (Existing)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{progress.skippedAssets}</div>
        </div>
        <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>Failed</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{progress.failedAssets}</div>
        </div>
        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>Total Items</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{progress.totalAssets}</div>
        </div>
      </div>

      {/* SECTION 2: CONCURRENCY MONITOR */}
      {(isRunning || isPaused || (progress.activeWorkers && progress.activeWorkers.length > 0)) && (
        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ fontSize: '0.95rem', color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#38bdf8" />
            Parallel Thread Monitor
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {progress.activeWorkers?.map((worker) => (
              <div
                key={worker.workerId}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${getWorkerColor(worker.status)}50`, // 50 is hex alpha (approx 30%)
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Status Indicator Bar */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: getWorkerColor(worker.status),
                  }}
                />

                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: `${getWorkerColor(worker.status)}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: getWorkerColor(worker.status),
                  }}
                >
                  {worker.status === 'DOWNLOADING' && <RefreshCw size={18} className="animate-spin" />}
                  {worker.status === 'UPLOADING' && <UploadCloud size={18} className="animate-pulse" />}
                  {worker.status === 'SAVING' && <CheckCircle2 size={18} />}
                  {worker.status === 'RETRYING' && <RotateCcw size={18} className="animate-spin" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={worker.filename}
                  >
                    {worker.filename}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: getWorkerColor(worker.status),
                        letterSpacing: '0.5px',
                      }}
                    >
                      {worker.status} {worker.retries > 0 ? `(Retry ${worker.retries})` : ''}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>|</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {worker.type === 'VIDEO' ? <Video size={10} /> : <FileImage size={10} />}
                      {worker.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {progress.activeWorkers?.length === 0 && (
               <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', gridColumn: '1 / -1' }}>
                 No active threads. Waiting for tasks...
               </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: LIVE TERMINAL LOGS */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '0.95rem', color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalSquare size={16} color="#a855f7" />
          Live Activity Stream
        </h4>
        <div
          ref={terminalRef}
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '16px',
            height: '220px',
            overflowY: 'auto',
            fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
            fontSize: '0.78rem',
            lineHeight: 1.5,
            boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          {progress.logs && progress.logs.length > 0 ? (
            // Reverse so oldest is top, newest is bottom
            [...progress.logs].reverse().map((log) => {
              let color = '#94a3b8'; // Default info
              if (log.level === 'success') color = '#4ade80';
              if (log.level === 'warn') color = '#facc15';
              if (log.level === 'error') color = '#f87171';

              return (
                <div key={log.id} style={{ marginBottom: '4px', display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>[{log.timestamp}]</span>
                  <span style={{ color, wordBreak: 'break-word' }}>
                    {log.albumName ? <span style={{ color: '#38bdf8' }}>[{log.albumName}] </span> : null}
                    {log.message}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#475569', fontStyle: 'italic' }}>Waiting for migration events...</div>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {isIdle && (
          <>
            {onBackStep && (
              <button onClick={onBackStep} className="btn btn-secondary" style={{ flex: 1, padding: '14px' }}>
                <ArrowLeft size={18} />
                <span>Back to Setup</span>
              </button>
            )}

            <button onClick={onStart} className="btn btn-primary" style={{ flex: 2, padding: '14px' }} disabled={disabled}>
              <Play size={20} fill="#fff" />
              <span>Start Migration</span>
            </button>

            <button
              onClick={handleResetHistory}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '14px',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                color: '#f87171',
                background: 'rgba(244, 63, 94, 0.08)',
              }}
              disabled={disabled}
              title="Clears local migration history records"
            >
              <RotateCcw size={18} />
              <span>Reset DB</span>
            </button>
          </>
        )}

        {isRunning && (
          <button onClick={onPause} className="btn btn-secondary" style={{ flex: 1, padding: '14px', border: '1px solid #f59e0b', color: '#fbbf24' }}>
            <Pause size={20} />
            <span>Pause Migration</span>
          </button>
        )}

        {isPaused && (
          <button onClick={onResume} className="btn btn-success" style={{ flex: 1, padding: '14px' }}>
            <Play size={20} fill="#fff" />
            <span>Resume Migration</span>
          </button>
        )}

        {(isRunning || isPaused) && (
          <button onClick={onCancel} className="btn btn-danger" style={{ padding: '14px 24px' }}>
            <Square size={18} />
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};
