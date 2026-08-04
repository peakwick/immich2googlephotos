import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from './components/Header';
import { ImmichConnectCard } from './components/ImmichConnectCard';
import { GoogleConnectCard } from './components/GoogleConnectCard';
import { AlbumSelectionCard } from './components/AlbumSelectionCard';
import { MigrationDashboard } from './components/MigrationDashboard';
import { ActivityLogModal } from './components/ActivityLogModal';
import { MigrationSummaryModal } from './components/MigrationSummaryModal';
import {
  ImmichServerInfo,
  GoogleProfile,
  MigrationOptions,
  MigrationProgress,
  MigrationMode,
} from './types';

export const App: React.FC = () => {
  const [immichInfo, setImmichInfo] = useState<ImmichServerInfo | null>(null);
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const [migrationOptions, setMigrationOptions] = useState<MigrationOptions>({
    mode: 'TEST_BATCH',
    selectedAlbumIds: [],
    selectedAssetIds: [],
    maxItemsLimit: 5,
    createAlbums: true,
    maxConcurrency: 3,
  });

  const [progress, setProgress] = useState<MigrationProgress>({
    jobId: '',
    status: 'IDLE',
    totalAssets: 0,
    completedAssets: 0,
    failedAssets: 0,
    skippedAssets: 0,
    speedBytesPerSec: 0,
    elapsedMs: 0,
    etaMs: 0,
    logs: [],
  });

  useEffect(() => {
    // Connect to SSE event stream for real-time migration progress
    const eventSource = new EventSource('/api/migration/stream');

    eventSource.onmessage = (event) => {
      try {
        const data: MigrationProgress = JSON.parse(event.data);
        setProgress((prev) => {
          // Open celebration modal if job just completed
          if (prev.status === 'RUNNING' && data.status === 'COMPLETED') {
            setIsSummaryOpen(true);
          }
          return data;
        });
      } catch (err) {
        console.error('SSE JSON parse error:', err);
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically retries connection
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleStartMigration = async () => {
    try {
      await axios.post('/api/migration/start', migrationOptions);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start migration job.');
    }
  };

  const handlePauseMigration = async () => {
    try {
      await axios.post('/api/migration/pause');
    } catch (err) {
      console.error('Pause error:', err);
    }
  };

  const handleResumeMigration = async () => {
    try {
      await axios.post('/api/migration/resume');
    } catch (err) {
      console.error('Resume error:', err);
    }
  };

  const handleCancelMigration = async () => {
    if (window.confirm('Are you sure you want to cancel the active migration job?')) {
      try {
        await axios.post('/api/migration/cancel');
      } catch (err) {
        console.error('Cancel error:', err);
      }
    }
  };

  const handleClearLogs = () => {
    setProgress((prev) => ({ ...prev, logs: [] }));
  };

  const isMigrateReady = Boolean(immichInfo && googleProfile);

  return (
    <div className="app-container">
      <Header
        immichInfo={immichInfo}
        googleProfile={googleProfile}
        onOpenLogs={() => setIsLogsOpen(true)}
        logsCount={progress.logs.length}
      />

      <main className="main-content">
        {/* Intro banner */}
        <div style={{
          textAlign: 'center',
          maxWidth: '820px',
          margin: '0 auto 36px',
        }}>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '12px' }}>
            Migrate Your Memories with <span className="gradient-text">Zero Loss</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Seamlessly transfer high-resolution photos, videos, and albums from your self-hosted Immich instance to Google Photos without re-encoding, compression, or complex GCP setup.
          </p>
        </div>

        {/* Step 1 & Step 2 Grid */}
        <div className="step-grid">
          <ImmichConnectCard
            onConnected={(info) => setImmichInfo(info)}
            currentInfo={immichInfo}
          />

          <GoogleConnectCard
            onConnected={(profile) => setGoogleProfile(profile)}
            currentProfile={googleProfile}
          />
        </div>

        {/* Step 3: Album Selection */}
        <div style={{ marginBottom: '32px' }}>
          <AlbumSelectionCard
            disabled={!immichInfo}
            onSelectionChange={(
              mode: MigrationMode,
              selectedIds: string[],
              createAlbums: boolean,
              selectedAssetIds?: string[],
              maxItemsLimit?: number,
              maxConcurrency?: number
            ) => {
              setMigrationOptions((prev) => ({
                ...prev,
                mode,
                selectedAlbumIds: selectedIds,
                createAlbums,
                selectedAssetIds,
                maxItemsLimit,
                maxConcurrency: maxConcurrency ?? prev.maxConcurrency ?? 5,
              }));
            }}
          />
        </div>

        {/* Step 4: Migration Dashboard & Stream */}
        <MigrationDashboard
          progress={progress}
          onStart={handleStartMigration}
          onPause={handlePauseMigration}
          onResume={handleResumeMigration}
          onCancel={handleCancelMigration}
          disabled={!isMigrateReady}
        />
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        fontSize: '0.82rem',
      }}>
        Immich → Google Photos Full-Stack Migration App • Built with Node.js, Express, React, Vite & TypeScript
      </footer>

      {/* Activity Logs Modal */}
      <ActivityLogModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        logs={progress.logs}
        onClear={handleClearLogs}
      />

      {/* Summary Celebration Modal */}
      <MigrationSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        progress={progress}
      />
    </div>
  );
};
