export interface ImmichServerInfo {
  version: string;
  url: string;
  user?: ImmichUser;
}

export interface ImmichUser {
  id: string;
  email: string;
  name: string;
}

export interface ImmichExifInfo {
  make?: string;
  model?: string;
  exifImageWidth?: number;
  exifImageHeight?: number;
  fileSizeInByte?: number;
  orientation?: string;
  dateTimeOriginal?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
}

export interface ImmichAsset {
  id: string;
  originalFileName: string;
  originalPath: string;
  type: 'IMAGE' | 'VIDEO';
  fileCreatedAt: string;
  fileModifiedAt: string;
  exifInfo?: ImmichExifInfo;
  albumId?: string;
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description: string;
  assetCount: number;
  assets?: ImmichAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

export interface GoogleAlbum {
  id: string;
  title: string;
  productUrl: string;
  isWriteable: boolean;
  mediaItemsCount: string;
}

export interface GoogleMediaItem {
  id: string;
  description?: string;
  productUrl: string;
  mimeType: string;
  filename: string;
}

export interface GoogleUploadResult {
  uploadToken?: string;
  filename: string;
  assetId: string;
  error?: string;
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

export type MigrationItemState = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

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
  currentAsset?: {
    id: string;
    filename: string;
    type: 'IMAGE' | 'VIDEO';
    albumName?: string;
  };
  currentAlbum?: string;
  speedBytesPerSec: number;
  elapsedMs: number;
  etaMs: number;
  logs: MigrationLogEntry[];
}

export interface StoredSettings {
  immichUrl: string;
  immichApiKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleAccessToken: string;
  googleRefreshToken: string;
}

export interface MigrationRecord {
  assetId: string;
  googleMediaItemId?: string;
  albumId?: string;
  googleAlbumId?: string;
  migratedAt: string;
}
