import React, { useEffect } from 'react';
import { CheckCircle2, Award, X, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { MigrationProgress } from '../types';

interface MigrationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: MigrationProgress;
}

export const MigrationSummaryModal: React.FC<MigrationSummaryModalProps> = ({
  isOpen,
  onClose,
  progress,
}) => {
  useEffect(() => {
    if (isOpen) {
      // Trigger festive confetti explosion
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalProcessed = progress.completedAssets + progress.failedAssets + progress.skippedAssets;

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    if (min > 0) {
      return `${min} min ${remainSec} sec`;
    }
    return `${remainSec} sec`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '560px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ justifyContent: 'flex-end', borderBottom: 'none' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '0 32px 36px' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)',
          }}>
            <Award size={36} color="#fff" />
          </div>

          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
            Migration Completed!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '28px' }}>
            Your photos, videos, and albums have been successfully migrated to Google Photos.
          </p>

          {/* Stats Box */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '28px',
          }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>TRANSFERRED</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {progress.completedAssets}
              </div>
            </div>

            <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
              <div style={{ fontSize: '0.78rem', color: '#22d3ee', fontWeight: 600 }}>SKIPPED</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {progress.skippedAssets}
              </div>
            </div>

            <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
              <div style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600 }}>FAILED</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {progress.failedAssets}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-input)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '28px',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}>
            <Sparkles size={18} color="#f59e0b" />
            <span>Total Time: <strong>{formatElapsed(progress.elapsedMs)}</strong> — 100% Original Metadata Preserved</span>
          </div>

          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px' }}
          >
            <CheckCircle2 size={18} />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
