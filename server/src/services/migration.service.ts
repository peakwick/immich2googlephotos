import { Response } from 'express';
import {
  MigrationOptions,
  MigrationProgress,
  MigrationLogEntry,
  ImmichAsset,
  ImmichAlbum,
  MigrationJobState,
} from '../types';
import { immichService } from './immich.service';
import { googlePhotosService } from './googlePhotos.service';
import { storageService } from './storage.service';

export class MigrationService {
  private progress: MigrationProgress;
  private sseClients: Set<Response> = new Set();
  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private startTime: number = 0;
  private totalBytesTransferred: number = 0;

  constructor() {
    this.progress = this.getInitialProgress();
  }

  private getInitialProgress(): MigrationProgress {
    return {
      jobId: 'job-' + Date.now(),
      status: 'IDLE',
      totalAssets: 0,
      completedAssets: 0,
      failedAssets: 0,
      skippedAssets: 0,
      speedBytesPerSec: 0,
      elapsedMs: 0,
      etaMs: 0,
      logs: [],
    };
  }

  public getProgress(): MigrationProgress {
    if (this.progress.status === 'RUNNING' || this.progress.status === 'PAUSED') {
      this.progress.elapsedMs = Date.now() - this.startTime;
      if (this.progress.completedAssets > 0 && this.totalBytesTransferred > 0) {
        const seconds = Math.max(0.1, this.progress.elapsedMs / 1000);
        this.progress.speedBytesPerSec = Math.round(this.totalBytesTransferred / seconds);
        const remainingAssets =
          this.progress.totalAssets -
          this.progress.completedAssets -
          this.progress.failedAssets -
          this.progress.skippedAssets;
        const avgMsPerAsset = this.progress.elapsedMs / (this.progress.completedAssets + 1);
        this.progress.etaMs = Math.round(remainingAssets * avgMsPerAsset);
      }
    }
    return this.progress;
  }

  public addSSEClient(res: Response): void {
    this.sseClients.add(res);
    this.emitProgress();

    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  private emitProgress(): void {
    const data = JSON.stringify(this.getProgress());
    for (const client of this.sseClients) {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (error) {
        this.sseClients.delete(client);
      }
    }
  }

  public log(level: MigrationLogEntry['level'], message: string, assetId?: string, albumName?: string): void {
    const entry: MigrationLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      assetId,
      albumName,
    };

    // Keep last 300 logs in memory
    this.progress.logs = [entry, ...this.progress.logs].slice(0, 300);
    console.log(`[Migration ${level.toUpperCase()}] ${message}`);
    this.emitProgress();
  }

  public async startMigration(options: MigrationOptions): Promise<void> {
    if (this.progress.status === 'RUNNING') {
      throw new Error('Migration is already running.');
    }

    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.totalBytesTransferred = 0;
    this.progress = this.getInitialProgress();
    this.progress.status = 'RUNNING';

    this.log('info', `Starting migration job (Mode: ${options.mode})`);
    this.emitProgress();

    // Run async migration in background
    this.executeMigration(options).catch((err) => {
      this.progress.status = 'ERROR';
      this.log('error', `Migration job terminated with error: ${err.message}`);
      this.emitProgress();
    });
  }

  public pauseMigration(): void {
    if (this.progress.status === 'RUNNING') {
      this.isPaused = true;
      this.progress.status = 'PAUSED';
      this.log('warn', 'Migration paused by user.');
      this.emitProgress();
    }
  }

  public resumeMigration(): void {
    if (this.progress.status === 'PAUSED') {
      this.isPaused = false;
      this.progress.status = 'RUNNING';
      this.log('info', 'Migration resumed.');
      this.emitProgress();
    }
  }

  public cancelMigration(): void {
    if (this.progress.status === 'RUNNING' || this.progress.status === 'PAUSED') {
      this.isCancelled = true;
      this.progress.status = 'CANCELLED';
      this.log('warn', 'Migration cancelled by user.');
      this.emitProgress();
    }
  }

  private async executeMigration(options: MigrationOptions): Promise<void> {
    try {
      const albumsToMigrate: Array<{ album: ImmichAlbum; assets: ImmichAsset[] }> = [];
      const allLibraryAssets: ImmichAsset[] = [];

      if (options.mode === 'SELECTED_ALBUMS' || options.mode === 'BOTH') {
        const allAlbums = await immichService.getAllAlbums();
        for (const albumId of options.selectedAlbumIds) {
          const album = allAlbums.find((a) => a.id === albumId);
          if (album) {
            this.log('info', `Fetching assets for album: "${album.albumName}"`);
            const assets = await immichService.getAlbumAssets(albumId);
            albumsToMigrate.push({ album, assets });
          }
        }
      }

      if (options.mode === 'ALL_PHOTOS' || options.mode === 'BOTH' || options.mode === 'SELECTED_ASSETS' || options.mode === 'TEST_BATCH') {
        this.log('info', 'Fetching user library assets from Immich...');
        const allFetched = await immichService.getAllAssets();

        if (options.mode === 'SELECTED_ASSETS') {
          const selectedSet = new Set(options.selectedAssetIds || []);
          const filtered = allFetched.filter((a) => selectedSet.has(a.id));
          allLibraryAssets.push(...filtered);
        } else if (options.mode === 'TEST_BATCH') {
          const limit = options.maxItemsLimit || 5;
          this.log('info', `Test Batch Mode: Selecting first ${limit} photos/videos for quick testing.`);
          allLibraryAssets.push(...allFetched.slice(0, limit));
        } else {
          allLibraryAssets.push(...allFetched);
        }
      }

      // Calculate total unique items to migrate
      let totalCount = 0;
      if (options.mode === 'SELECTED_ALBUMS') {
        totalCount = albumsToMigrate.reduce((sum, a) => sum + a.assets.length, 0);
      } else if (options.mode === 'ALL_PHOTOS' || options.mode === 'SELECTED_ASSETS' || options.mode === 'TEST_BATCH') {
        totalCount = allLibraryAssets.length;
      } else {
        const idSet = new Set<string>();
        allLibraryAssets.forEach((a) => idSet.add(a.id));
        albumsToMigrate.forEach((a) => a.assets.forEach((item) => idSet.add(item.id)));
        totalCount = idSet.size;
      }

      const isTestMode = options.mode === 'TEST_BATCH';
      if (isTestMode && options.maxItemsLimit && totalCount > options.maxItemsLimit) {
        totalCount = options.maxItemsLimit;
      }

      this.progress.totalAssets = totalCount;
      this.log('info', `Found total ${totalCount} assets scheduled for migration.`);
      this.emitProgress();

      let itemsProcessedCount = 0;
      const reachedLimit = () => (isTestMode && options.maxItemsLimit) ? itemsProcessedCount >= options.maxItemsLimit : false;

      const concurrency = options.maxConcurrency || 5;
      this.log('info', `High-Performance Mode Active: Running ${concurrency} parallel upload worker streams.`);

      // 1. Process Albums first
      for (const group of albumsToMigrate) {
        if (this.isCancelled || reachedLimit()) break;

        this.progress.currentAlbum = group.album.albumName;
        let targetGoogleAlbumId: string | undefined;

        if (options.createAlbums) {
          this.log('info', `Replicating album "${group.album.albumName}" in Google Photos...`);
          const createdAlbum = await googlePhotosService.createAlbum(group.album.albumName);
          targetGoogleAlbumId = createdAlbum.id;
          this.log('success', `Matched album: "${group.album.albumName}" -> Google Album ID: ${createdAlbum.id}`);
        }

        await this.processAssetsInParallel(
          group.assets,
          concurrency,
          group.album.albumName,
          targetGoogleAlbumId,
          () => {
            itemsProcessedCount++;
            return reachedLimit();
          }
        );
      }

      // 2. Process Library assets
      if (allLibraryAssets.length > 0 && !this.isCancelled && !reachedLimit()) {
        this.progress.currentAlbum = options.mode === 'TEST_BATCH' ? 'Test Batch' : 'Library Photos';
        await this.processAssetsInParallel(
          allLibraryAssets,
          concurrency,
          'Library',
          undefined,
          () => {
            itemsProcessedCount++;
            return reachedLimit();
          }
        );
      }

      if (this.isCancelled) {
        this.progress.status = 'CANCELLED';
        this.log('warn', 'Migration job cancelled.');
      } else {
        this.progress.status = 'COMPLETED';
        this.log(
          'success',
          `Migration completed! Transferred: ${this.progress.completedAssets}, Skipped: ${this.progress.skippedAssets}, Failed: ${this.progress.failedAssets}`
        );
      }
      this.emitProgress();
    } catch (error: any) {
      this.progress.status = 'ERROR';
      this.log('error', `Migration execution error: ${error.message}`);
      this.emitProgress();
    }
  }

  private async processAssetsInParallel(
    assets: ImmichAsset[],
    concurrency: number,
    albumName?: string,
    targetGoogleAlbumId?: string,
    onItemProcessed?: () => boolean
  ): Promise<void> {
    const queue = [...assets];
    const workers: Array<Promise<void>> = [];

    const worker = async () => {
      while (queue.length > 0 && !this.isCancelled) {
        if (onItemProcessed && onItemProcessed()) {
          break;
        }
        const asset = queue.shift();
        if (!asset) break;

        await this.processSingleAsset(asset, albumName, targetGoogleAlbumId);
      }
    };

    const workerCount = Math.min(concurrency, queue.length);
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
  }

  private async processSingleAsset(
    asset: ImmichAsset,
    albumName?: string,
    targetGoogleAlbumId?: string
  ): Promise<void> {
    while (this.isPaused && !this.isCancelled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (this.isCancelled) return;

    this.progress.currentAsset = {
      id: asset.id,
      filename: asset.originalFileName,
      type: asset.type,
      albumName,
    };
    this.emitProgress();

    // Check if asset is already migrated
    if (storageService.isAssetMigrated(asset.id)) {
      this.progress.skippedAssets++;
      this.log('info', `Skipped already migrated asset: ${asset.originalFileName}`, asset.id, albumName);
      this.emitProgress();
      return;
    }

    this.log(
      'info',
      `Streaming ${asset.originalFileName} (${asset.type})...`,
      asset.id,
      albumName
    );

    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries < MAX_RETRIES) {
      try {
        // 1. Get readable stream of 100% original bit-for-bit file from Immich (or disk)
        const { stream, contentLength, mimeType } = await immichService.getAssetOriginalStream(asset);

        // 2. Stream directly to Google Photos upload endpoint
        const uploadToken = await googlePhotosService.uploadMediaStream(
          stream,
          asset.originalFileName,
          mimeType
        );

        this.totalBytesTransferred += contentLength;

        // 3. Batch create media item in Google Photos (preserves EXIF/GPS metadata from raw bytes)
        const createdItems = await googlePhotosService.batchCreateMediaItems(
          [
            {
              uploadToken,
              filename: asset.originalFileName,
              description: `Migrated from Immich (${albumName || 'Library'})`,
            },
          ],
          targetGoogleAlbumId
        );

        const googleMediaItemId = createdItems[0]?.id;

        // 4. Record successful migration in local DB
        storageService.recordMigration({
          assetId: asset.id,
          googleMediaItemId,
          albumId: asset.albumId,
          googleAlbumId: targetGoogleAlbumId,
          migratedAt: new Date().toISOString(),
        });

        this.progress.completedAssets++;
        this.log(
          'success',
          `Successfully migrated ${asset.originalFileName} with metadata intact!`,
          asset.id,
          albumName
        );
        this.emitProgress();
        return;
      } catch (error: any) {
        retries++;
        const msg = error?.message || 'Unknown stream upload error';

        if (retries >= MAX_RETRIES) {
          this.progress.failedAssets++;
          this.log(
            'error',
            `Failed to migrate ${asset.originalFileName} after ${MAX_RETRIES} attempts: ${msg}`,
            asset.id,
            albumName
          );
          this.emitProgress();
          return;
        } else {
          this.log(
            'info',
            `Auto-retrying ${asset.originalFileName} (Attempt ${retries}/${MAX_RETRIES}) after temporary glitch...`,
            asset.id,
            albumName
          );
          await new Promise((resolve) => setTimeout(resolve, retries * 2000));
        }
      }
    }
  }
}

export const migrationService = new MigrationService();
