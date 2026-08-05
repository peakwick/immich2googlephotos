import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from './components/Header';
import { ImmichConnectCard } from './components/ImmichConnectCard';
import { GoogleConnectCard } from './components/GoogleConnectCard';
import { AlbumSelectionCard } from './components/AlbumSelectionCard';
import { MigrationDashboard } from './components/MigrationDashboard';
import { MigrationSummaryModal } from './components/MigrationSummaryModal';
import { Check, Server, Cloud, Sliders, Play } from 'lucide-react';
import {
  ImmichServerInfo,
  GoogleProfile,
  MigrationOptions,
  MigrationProgress,
  MigrationMode,
  ImmichAlbum,
  ImmichAsset,
} from './types';

export const App: React.FC = () => {
  const [immichInfo, setImmichInfo] = useState<ImmichServerInfo | null>(null);
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Background fetched data for Step 3
  const [immichAlbums, setImmichAlbums] = useState<ImmichAlbum[]>([]);
  const [immichAssets, setImmichAssets] = useState<ImmichAsset[]>([]);
  const [libraryCount, setLibraryCount] = useState<number>(0);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [migrationOptions, setMigrationOptions] = useState<MigrationOptions>({
    mode: 'TEST_BATCH',
    selectedAlbumIds: [],
    selectedAssetIds: [],
    maxItemsLimit: 5,
    createAlbums: true,
    maxConcurrency: 5,
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
    activeWorkers: [],
  });

  useEffect(() => {
    // 1. Auto-connect logic on page reload
    const autoConnect = async () => {
      try {
        const settingsRes = await axios.get('/api/settings');
        const settings = settingsRes.data?.settings;
        let isImmichConnected = false;

        if (settings?.immichUrl && settings?.immichApiKey) {
          try {
            const immichRes = await axios.post('/api/immich/test', {
              immichUrl: settings.immichUrl,
              immichApiKey: settings.immichApiKey,
            });
            if (immichRes.data?.success && immichRes.data?.serverInfo) {
              setImmichInfo(immichRes.data.serverInfo);
              isImmichConnected = true;
            }
          } catch (e) {
            console.warn('Auto-connect Immich failed', e);
          }
        }

        if (isImmichConnected) {
          try {
            const googleRes = await axios.get('/api/auth/google/status');
            if (googleRes.data?.success && googleRes.data?.connected && googleRes.data?.profile) {
              setGoogleProfile(googleRes.data.profile);
              setActiveStep(3); // Both connected, skip to Step 3
            } else {
              setActiveStep(2); // Only Immich connected, go to Step 2
            }
          } catch (e) {
            setActiveStep(2);
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    };

    autoConnect();

    // 2. Setup Server-Sent Events (SSE) for live migration progress
    const eventSource = new EventSource('/api/migration/stream');

    eventSource.onmessage = (event) => {
      try {
        const data: MigrationProgress = JSON.parse(event.data);
        setProgress((prev) => {
          if (prev.status === 'RUNNING' && data.status === 'COMPLETED') {
            setIsSummaryOpen(true);
          }
          if (data.status === 'RUNNING' || data.status === 'PAUSED') {
            setActiveStep(4); // Jump to live dashboard when running
          }
          return data;
        });
      } catch (err) {
        console.error('SSE JSON parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const loadLibraryBackground = async () => {
    setIsLibraryLoading(true);
    setLibraryError(null);
    try {
      const [albumsRes, assetsRes] = await Promise.all([
        axios.get('/api/immich/albums'),
        axios.get('/api/immich/assets'),
      ]);
      if (albumsRes.data?.success) setImmichAlbums(albumsRes.data.albums);
      if (assetsRes.data?.success) {
        setLibraryCount(assetsRes.data.count || 0);
        setImmichAssets(assetsRes.data.assets || []);
      }
    } catch (err: any) {
      setLibraryError('Immich içerikleri yüklenirken hata oluştu.');
    } finally {
      setIsLibraryLoading(false);
    }
  };

  // Fetch library data in the background as soon as Immich is connected
  useEffect(() => {
    if (immichInfo && !isLibraryLoading && immichAlbums.length === 0 && immichAssets.length === 0) {
      loadLibraryBackground();
    }
  }, [immichInfo]);

  const handleImmichConnected = (info: ImmichServerInfo) => {
    setImmichInfo(info);
    if (activeStep === 1) {
      setActiveStep(2);
    }
  };

  const handleGoogleConnected = (profile: GoogleProfile) => {
    setGoogleProfile(profile);
    if (activeStep === 2) {
      setActiveStep(3);
    }
  };

  const handleStartMigration = async () => {
    try {
      setActiveStep(4);
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

  const isMigrateReady = Boolean(immichInfo && googleProfile);

  return (
    <div className="app-container">
      <Header
        immichInfo={immichInfo}
        googleProfile={googleProfile}
      />

      <main className="main-content">
        {/* Intro banner */}
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 28px' }}>
          <h2 style={{ fontSize: '2.2rem', marginBottom: '10px' }}>
            Migrate Your Memories with <span className="gradient-text">Zero Loss</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.5 }}>
            Seamlessly transfer high-resolution photos, videos, and albums from your self-hosted Immich instance to Google Photos without re-encoding, compression, or GCP friction.
          </p>
        </div>

        {/* Stepper Navigation Bar */}
        <div className="stepper-nav">
          <button
            type="button"
            className={`stepper-item ${activeStep === 1 ? 'active' : ''} ${immichInfo ? 'completed' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <div className="stepper-num">{immichInfo ? <Check size={14} /> : '1'}</div>
            <Server size={16} />
            <span>1. Immich</span>
          </button>

          <button
            type="button"
            className={`stepper-item ${activeStep === 2 ? 'active' : ''} ${googleProfile ? 'completed' : ''}`}
            onClick={() => setActiveStep(2)}
          >
            <div className="stepper-num">{googleProfile ? <Check size={14} /> : '2'}</div>
            <Cloud size={16} />
            <span>2. Google Photos</span>
          </button>

          <button
            type="button"
            className={`stepper-item ${activeStep === 3 ? 'active' : ''}`}
            onClick={() => setActiveStep(3)}
          >
            <div className="stepper-num">3</div>
            <Sliders size={16} />
            <span>3. Setup & Speed</span>
          </button>

          <button
            type="button"
            className={`stepper-item ${activeStep === 4 ? 'active' : ''}`}
            onClick={() => setActiveStep(4)}
          >
            <div className="stepper-num">4</div>
            <Play size={16} />
            <span>4. Migration Engine</span>
          </button>
        </div>

        {/* Step 1: Immich Connection */}
        {activeStep === 1 && (
          <ImmichConnectCard
            onConnected={handleImmichConnected}
            currentInfo={immichInfo}
            onNextStep={() => setActiveStep(2)}
          />
        )}

        {/* Step 2: Google Photos Authorization */}
        {activeStep === 2 && (
          <GoogleConnectCard
            onConnected={handleGoogleConnected}
            currentProfile={googleProfile}
            onNextStep={() => setActiveStep(3)}
          />
        )}

        {/* Step 3: Migration Mode & Speed Setup */}
        {activeStep === 3 && (
          <AlbumSelectionCard
            albums={immichAlbums}
            assets={immichAssets}
            libraryCount={libraryCount}
            loading={isLibraryLoading}
            error={libraryError}
            onRefresh={loadLibraryBackground}
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
            onNextStep={() => setActiveStep(4)}
          />
        )}

        {/* Step 4: Live Migration Engine */}
        {activeStep === 4 && (
          <MigrationDashboard
            progress={progress}
            onStart={handleStartMigration}
            onPause={handlePauseMigration}
            onResume={handleResumeMigration}
            onCancel={handleCancelMigration}
            disabled={!isMigrateReady}
            onBackStep={() => setActiveStep(3)}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        fontSize: '0.82rem',
      }}>
        Immich → Google Photos Migration Engine • Node.js, Express, React, Vite & TypeScript
      </footer>

      {/* Summary Celebration Modal */}
      <MigrationSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        progress={progress}
      />
    </div>
  );
};
