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
// @ts-ignore
import * as piexif from 'piexifjs';

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function injectExifDate(jpegBuffer: Buffer, isoDateString: string): Buffer {
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return jpegBuffer;

    const pad = (n: number) => String(n).padStart(2, '0');
    const exifDateStr = `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const binaryString = jpegBuffer.toString('binary');
    let exifObj: any;
    try {
      exifObj = piexif.load(binaryString);
    } catch {
      exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {} };
    }

    exifObj['0th'] = exifObj['0th'] || {};
    exifObj['Exif'] = exifObj['Exif'] || {};
    exifObj['GPS'] = exifObj['GPS'] || {};
    exifObj['Interop'] = exifObj['Interop'] || {};
    exifObj['1st'] = exifObj['1st'] || {};

    exifObj['0th'][piexif.TagNumbers.ImageIFD.DateTime] = exifDateStr;
    exifObj['Exif'][piexif.TagNumbers.ExifIFD.DateTimeOriginal] = exifDateStr;
    exifObj['Exif'][piexif.TagNumbers.ExifIFD.DateTimeDigitized] = exifDateStr;

    const newExifBytes = piexif.dump(exifObj);
    const newBinaryString = piexif.insert(newExifBytes, binaryString);
    return Buffer.from(newBinaryString, 'binary');
  } catch (err) {
    console.warn(`Failed to inject EXIF date: ${err}`);
    return jpegBuffer;
  }
}

export class MigrationService {
  private progress: MigrationProgress;
  private sseClients: Set<Response> = new Set();
  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private startTime: number = 0;
  private totalBytesTransferred: number = 0;
  private failedAssetsQueue: Array<{ asset: ImmichAsset; albumName?: string; targetGoogleAlbumId?: string }> = [];

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
      activeWorkers: [],
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
    this.failedAssetsQueue = [];
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

      if (options.mode === 'SELECTED_ALBUMS' || options.mode === 'BOTH' || (options.mode === 'ALL_PHOTOS' && options.createAlbums)) {
        const allAlbums = await immichService.getAllAlbums();
        const albumsToProcess = options.mode === 'ALL_PHOTOS' 
          ? allAlbums 
          : allAlbums.filter(a => options.selectedAlbumIds.includes(a.id));

        for (const album of albumsToProcess) {
          this.log('info', `Fetching assets for album: "${album.albumName}"`);
          const assets = await immichService.getAlbumAssets(album.id);
          albumsToMigrate.push({ album, assets });
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
          // Exclude assets that are already being migrated as part of an album
          const albumAssetIds = new Set<string>();
          albumsToMigrate.forEach(a => a.assets.forEach(asset => albumAssetIds.add(asset.id)));
          
          const filtered = allFetched.filter((a) => !albumAssetIds.has(a.id));
          allLibraryAssets.push(...filtered);
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

      // 3. Final Retry Pass for Failed Assets
      if (this.failedAssetsQueue.length > 0 && !this.isCancelled && !reachedLimit()) {
        this.log('info', `Running final retry pass for ${this.failedAssetsQueue.length} previously failed assets...`);
        // Process them slowly (concurrency = 1) to avoid hitting quotas again
        const retryQueue = [...this.failedAssetsQueue];
        this.failedAssetsQueue = []; // Clear so we don't double process
        
        // We will decrement failedAssets before retrying, as processSingleAsset will increment either completed or failed again.
        
        await this.processAssetsInParallel(
          retryQueue.map(q => q.asset),
          1, // Single thread for retries
          'Final Retry',
          undefined,
          undefined,
          retryQueue
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
    onItemProcessed?: () => boolean,
    retryQueueContext?: Array<{ asset: ImmichAsset; albumName?: string; targetGoogleAlbumId?: string }>
  ): Promise<void> {
    const queue = [...assets];
    const workers: Array<Promise<void>> = [];

    const worker = async (workerId: number) => {
      while (queue.length > 0 && !this.isCancelled) {
        if (onItemProcessed && onItemProcessed()) {
          break;
        }
        const asset = queue.shift();
        if (!asset) break;

        let currentAlbumName = albumName;
        let currentTargetAlbumId = targetGoogleAlbumId;
        
        // If we are in the final retry queue, grab the original context
        if (retryQueueContext) {
          const ctx = retryQueueContext.find(q => q.asset.id === asset.id);
          if (ctx) {
            currentAlbumName = ctx.albumName;
            currentTargetAlbumId = ctx.targetGoogleAlbumId;
            // Decrement failedAssets since we are retrying it now
            this.progress.failedAssets = Math.max(0, this.progress.failedAssets - 1);
            this.emitProgress();
          }
        }

        await this.processSingleAsset(workerId, asset, currentAlbumName, currentTargetAlbumId, !!retryQueueContext);
      }
      
      // Cleanup worker state when done
      const idx = this.progress.activeWorkers.findIndex((w) => w.workerId === workerId);
      if (idx !== -1) {
        this.progress.activeWorkers.splice(idx, 1);
        this.emitProgress();
      }
    };

    const workerCount = Math.min(concurrency, queue.length);
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker(i));
    }

    await Promise.all(workers);
  }

  private async processSingleAsset(
    workerId: number,
    asset: ImmichAsset,
    albumName?: string,
    targetGoogleAlbumId?: string,
    isFinalRetry: boolean = false
  ): Promise<void> {
    while (this.isPaused && !this.isCancelled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (this.isCancelled) return;

    const updateWorkerState = (
      status: 'DOWNLOADING' | 'UPLOADING' | 'RETRYING' | 'SAVING',
      retries: number = 0
    ) => {
      let workerState = this.progress.activeWorkers.find((w) => w.workerId === workerId);
      if (!workerState) {
        workerState = {
          workerId,
          assetId: asset.id,
          filename: asset.originalFileName,
          type: asset.type,
          status,
          retries,
          albumName,
        };
        this.progress.activeWorkers.push(workerState);
      } else {
        workerState.assetId = asset.id;
        workerState.filename = asset.originalFileName;
        workerState.type = asset.type;
        workerState.status = status;
        workerState.retries = retries;
        workerState.albumName = albumName;
      }
      this.emitProgress();
    };

    updateWorkerState('DOWNLOADING');

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
        updateWorkerState('DOWNLOADING', retries);
        // 1. Get readable stream of 100% original bit-for-bit file from Immich (or disk)
        const { stream, contentLength, mimeType } = await immichService.getAssetOriginalStream(asset);

        updateWorkerState('UPLOADING', retries);
        let uploadToken = '';
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
          // 2. Buffer the stream and inject EXIF date for JPEGs
          const buffer = await streamToBuffer(stream);
          const injectedBuffer = injectExifDate(buffer, asset.fileCreatedAt);
          uploadToken = await googlePhotosService.uploadMediaBuffer(
            injectedBuffer,
            asset.originalFileName,
            mimeType
          );
          this.totalBytesTransferred += injectedBuffer.length;
        } else {
          // 2. Stream directly to Google Photos upload endpoint
          uploadToken = await googlePhotosService.uploadMediaStream(
            stream,
            asset.originalFileName,
            mimeType
          );
          this.totalBytesTransferred += contentLength;
        }

        updateWorkerState('SAVING', retries);

        // 3. Batch create media item in Google Photos (preserves EXIF/GPS metadata from raw bytes)
        const createdItems = await googlePhotosService.batchCreateMediaItems(
          [
            {
              uploadToken,
              filename: asset.originalFileName,
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
          
          // Queue for final retry if it's not already the final retry pass
          if (!isFinalRetry) {
             this.failedAssetsQueue.push({ asset, albumName, targetGoogleAlbumId });
          }
          
          this.emitProgress();
          return;
        } else {
          const isQuotaError = msg.toLowerCase().includes('quota') || msg.includes('429');
          // Exponential backoff for Quota errors (10s, 20s, 30s)
          // Standard backoff for other glitches (2s, 4s, 6s)
          const delayMs = isQuotaError ? (retries * 10000) : (retries * 2000);
          const reason = isQuotaError ? 'Google Photos Quota Limit' : 'temporary glitch';
          
          this.log(
            'info',
            `Auto-retrying ${asset.originalFileName} (Attempt ${retries}/${MAX_RETRIES}) after ${reason}... Sleeping for ${delayMs/1000}s`,
            asset.id,
            albumName
          );
          updateWorkerState('RETRYING', retries);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  }
}

export const migrationService = new MigrationService();
