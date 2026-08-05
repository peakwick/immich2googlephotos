import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import {
  ImmichServerInfo,
  ImmichUser,
  ImmichAlbum,
  ImmichAsset,
  StoredSettings,
} from '../types';
import { storageService } from './storage.service';

export class ImmichService {
  private getClient(customUrl?: string, customApiKey?: string): AxiosInstance {
    const settings = storageService.getSettings();
    const url = customUrl || settings.immichUrl || 'http://localhost:2283';
    const apiKey = customApiKey || settings.immichApiKey || '';

    return axios.create({
      baseURL: url.replace(/\/$/, ''),
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  public async testConnection(url?: string, apiKey?: string): Promise<ImmichServerInfo> {
    const client = this.getClient(url, apiKey);
    let version = 'Unknown';

    // Try multiple version endpoints for compatibility across all Immich releases (v1.x, v2.x, v3.x)
    try {
      const verRes = await client.get('/api/server/version');
      if (verRes.data) {
        if (verRes.data.major !== undefined) {
          version = `${verRes.data.major}.${verRes.data.minor}.${verRes.data.patch}`;
        } else if (typeof verRes.data === 'string') {
          version = verRes.data;
        } else if (verRes.data.version) {
          version = verRes.data.version;
        }
      }
    } catch {
      try {
        const infoRes = await client.get('/api/server-info');
        version = infoRes.data?.serverVersion || infoRes.data?.version || 'Unknown';
      } catch {
        try {
          const infoRes2 = await client.get('/api/server/info');
          version = infoRes2.data?.serverVersion || infoRes2.data?.version || 'Unknown';
        } catch {
          // Version is non-critical, fallback to Unknown
        }
      }
    }

    try {
      const userInfoRes = await client.get('/api/users/me');

      const serverInfo: ImmichServerInfo = {
        version,
        url: url || storageService.getSettings().immichUrl,
        user: {
          id: userInfoRes.data?.id || '',
          email: userInfoRes.data?.email || '',
          name: userInfoRes.data?.name || userInfoRes.data?.firstName || 'Immich User',
        },
      };

      return serverInfo;
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to connect to Immich server';
      throw new Error(`Immich connection error: ${msg}`);
    }
  }

  public async getAllAlbums(): Promise<ImmichAlbum[]> {
    const client = this.getClient();
    try {
      const response = await client.get('/api/albums');
      const albums: any[] = Array.isArray(response.data) ? response.data : [];

      return albums.map((a) => ({
        id: a.id,
        albumName: a.albumName || a.name || 'Untitled Album',
        description: a.description || '',
        assetCount: a.assetCount || a.assets?.length || 0,
        createdAt: a.createdAt || new Date().toISOString(),
        updatedAt: a.updatedAt || new Date().toISOString(),
      }));
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to fetch albums';
      throw new Error(`Immich getAlbums error: ${msg}`);
    }
  }

  public async getAlbumAssets(albumId: string): Promise<ImmichAsset[]> {
    const client = this.getClient();
    try {
      // For Immich v1.115+ we should use POST /api/search/metadata with albumIds
      // We'll paginate using 'page' and 'take'
      const allAssets: ImmichAsset[] = [];
      let page = 1;
      const take = 250;
      
      while (true) {
        const searchRes = await client.post('/api/search/metadata', {
          albumIds: [albumId],
          take,
          page,
        });

        const items: any[] = Array.isArray(searchRes.data?.assets?.items)
          ? searchRes.data.assets.items
          : Array.isArray(searchRes.data?.items)
          ? searchRes.data.items
          : Array.isArray(searchRes.data)
          ? searchRes.data
          : [];

        if (items.length > 0) {
          allAssets.push(...items.map(asset => this.mapAsset(asset, albumId)));
        }

        if (items.length < take) {
          break; // Last page reached
        }
        page++;
      }
      
      return allAssets;
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || `Failed to fetch album assets for ${albumId}`;
      throw new Error(`Immich getAlbumAssets error: ${msg}`);
    }
  }

  public async getAllAssets(): Promise<ImmichAsset[]> {
    const client = this.getClient();
    try {
      const allAssets: ImmichAsset[] = [];
      let page = 1;
      const take = 250;

      while (true) {
        // Use POST /api/search/metadata (Immich v1.115+)
        const searchRes = await client.post('/api/search/metadata', {
          take,
          page,
          isArchived: false,
          isTrashed: false,
        });

        const items: any[] = Array.isArray(searchRes.data?.assets?.items)
          ? searchRes.data.assets.items
          : Array.isArray(searchRes.data?.items)
          ? searchRes.data.items
          : Array.isArray(searchRes.data)
          ? searchRes.data
          : [];

        if (items.length > 0) {
          allAssets.push(...items.map(asset => this.mapAsset(asset)));
        }

        if (items.length < take) {
          break; // Last page reached
        }
        page++;
      }

      return allAssets;
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to fetch assets';
      throw new Error(`Immich getAllAssets error: ${msg}`);
    }
  }



  private mapAsset(raw: any, albumId?: string): ImmichAsset {
    return {
      id: raw.id,
      originalFileName: raw.originalFileName || raw.originalName || raw.id + '.jpg',
      originalPath: raw.originalPath || '',
      type: raw.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
      fileCreatedAt: raw.fileCreatedAt || raw.localDateTime || raw.exifInfo?.dateTimeOriginal || raw.createdAt || new Date().toISOString(),
      fileModifiedAt: raw.fileModifiedAt || raw.updatedAt || new Date().toISOString(),
      exifInfo: raw.exifInfo,
      albumId,
    };
  }

  public async getAssetThumbnailStream(assetId: string): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
    const client = this.getClient();
    const response = await client.get(`/api/assets/${assetId}/thumbnail`, {
      responseType: 'stream',
      timeout: 10000,
    });
    return {
      stream: response.data,
      mimeType: response.headers['content-type'] ? String(response.headers['content-type']) : 'image/jpeg',
    };
  }

  /**
   * Returns a readable stream of the 100% original, bit-for-bit file bytes.
   * Zero processing, zero re-encoding, zero compression.
   * Checks local filesystem if accessible, otherwise streams via GET /api/assets/{id}/original
   */
  public async getAssetOriginalStream(asset: ImmichAsset): Promise<{
    stream: NodeJS.ReadableStream;
    contentLength: number;
    mimeType: string;
  }> {
    // 1. Check if originalPath exists directly on local disk
    if (asset.originalPath && fs.existsSync(asset.originalPath)) {
      const stat = fs.statSync(asset.originalPath);
      const ext = asset.originalFileName.split('.').pop()?.toLowerCase() || '';
      const mimeType = this.guessMimeType(ext, asset.type);
      const stream = fs.createReadStream(asset.originalPath);
      return {
        stream,
        contentLength: stat.size,
        mimeType,
      };
    }

    // 2. Otherwise stream via Immich REST API /api/assets/{id}/original
    const client = this.getClient();
    const response = await client.get(`/api/assets/${asset.id}/original`, {
      responseType: 'stream',
      timeout: 300000, // 5 min timeout for large 4K video downloads
    });

    const contentLength = Number(response.headers['content-length']) || 0;
    const contentTypeHeader = response.headers['content-type'];
    const mimeType = contentTypeHeader ? String(contentTypeHeader) : (asset.type === 'VIDEO' ? 'video/mp4' : 'image/jpeg');

    return {
      stream: response.data,
      contentLength,
      mimeType,
    };
  }

  private guessMimeType(ext: string, type: 'IMAGE' | 'VIDEO'): string {
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
      heif: 'image/heif',
      webp: 'image/webp',
      dng: 'image/x-adobe-dng',
      raw: 'image/x-canon-cr2',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      avi: 'video/x-msvideo',
    };
    if (map[ext]) return map[ext];
    return type === 'VIDEO' ? 'video/mp4' : 'image/jpeg';
  }
}

export const immichService = new ImmichService();
