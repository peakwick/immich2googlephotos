export interface ImmichServerInfo {
  version: string;
  url: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description: string;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImmichAsset {
  id: string;
  originalFileName: string;
  originalPath: string;
  type: 'IMAGE' | 'VIDEO';
  fileCreatedAt: string;
  fileModifiedAt: string;
  albumId?: string;
}

export interface GoogleProfile {
  name: string;
  email: string;
  picture?: string;
}

export interface MigrationLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  assetId?: string;
  albumName?: string;
}

export type MigrationJobState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ERROR';

export interface MigrationProgress {
  jobId: string;
  status: MigrationJobState;
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  skippedAssets: number;
  activeWorkers: ActiveWorkerState[];
  currentAlbum?: string;
  speedBytesPerSec: number;
  elapsedMs: number;
  etaMs: number;
  logs: MigrationLogEntry[];
}

export interface ActiveWorkerState {
  workerId: number;
  assetId: string;
  filename: string;
  type: 'IMAGE' | 'VIDEO';
  status: 'DOWNLOADING' | 'UPLOADING' | 'RETRYING' | 'SAVING';
  retries: number;
  albumName?: string;
}

export type MigrationMode = 'ALL_PHOTOS' | 'SELECTED_ALBUMS' | 'SELECTED_ASSETS' | 'TEST_BATCH' | 'BOTH';

export interface MigrationOptions {
  mode: MigrationMode;
  selectedAlbumIds: string[];
  selectedAssetIds?: string[];
  maxItemsLimit?: number;
  createAlbums: boolean;
  maxConcurrency: number;
}
