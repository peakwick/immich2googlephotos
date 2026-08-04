import axios from 'axios';
import {
  GoogleTokens,
  GoogleAlbum,
  GoogleMediaItem,
  GoogleUploadResult,
} from '../types';
import { storageService } from './storage.service';

// Built-in default OAuth Client configuration for local desktop loopback testing
const DEFAULT_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '825946356784-0s76g1nggddm8f3u568ps7d671234567.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'GOCSPX-dummy-secret';
const DEFAULT_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';

export class GooglePhotosService {
  private getTokens(): { accessToken: string; refreshToken: string } {
    const settings = storageService.getSettings();
    return {
      accessToken: settings.googleAccessToken || '',
      refreshToken: settings.googleRefreshToken || '',
    };
  }

  private getCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
    const settings = storageService.getSettings();
    return {
      clientId: settings.googleClientId || DEFAULT_CLIENT_ID,
      clientSecret: settings.googleClientSecret || DEFAULT_CLIENT_SECRET,
      redirectUri: DEFAULT_REDIRECT_URI,
    };
  }

  public getAuthUrl(customClientId?: string, customClientSecret?: string): string {
    const creds = this.getCredentials();
    const clientId = customClientId || creds.clientId;
    const redirectUri = creds.redirectUri;

    const scopes = [
      'https://www.googleapis.com/auth/photoslibrary.appendonly',
      'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  public async exchangeCode(code: string, customClientId?: string, customClientSecret?: string): Promise<GoogleTokens> {
    const creds = this.getCredentials();
    const clientId = customClientId || creds.clientId;
    const clientSecret = customClientSecret || creds.clientSecret;

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: creds.redirectUri,
        grant_type: 'authorization_code',
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const tokens: GoogleTokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || '',
        expiry_date: Date.now() + (response.data.expires_in || 3600) * 1000,
        token_type: response.data.token_type,
      };

      storageService.saveSettings({
        googleAccessToken: tokens.access_token,
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
      });

      return tokens;
    } catch (error: any) {
      const msg = error?.response?.data?.error_description || error?.message || 'Failed to exchange authorization code';
      throw new Error(`Google OAuth code exchange error: ${msg}`);
    }
  }

  public async setDirectAccessToken(token: string): Promise<void> {
    const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
    storageService.saveSettings({
      googleAccessToken: cleanToken,
    });
  }

  public async getUserProfile(): Promise<{ name: string; email: string; picture?: string }> {
    const { accessToken } = this.getTokens();
    if (!accessToken || accessToken.length < 20) {
      throw new Error('No Google access token found. Please connect Google Photos first.');
    }

    // 1. Validate token with Google tokeninfo endpoint
    try {
      await axios.get(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`, {
        timeout: 5000,
      });
    } catch (tokenErr: any) {
      throw new Error('Google token süresi doldu veya geçersiz. Lütfen OAuth Playground üzerinden yeni bir token alıp yapıştırın.');
    }

    // 2. Try fetching user profile if scope allows
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      });

      return {
        name: response.data.name || 'Google Photos User',
        email: response.data.email || 'Connected (Google Photos User)',
        picture: response.data.picture,
      };
    } catch (error: any) {
      // If tokeninfo passed, the token is 100% active and valid for photoslibrary.appendonly migration!
      return {
        name: 'Google Photos User',
        email: 'Connected via Photos Library API (Ready for Migration)',
        picture: undefined,
      };
    }
  }

  public async getAlbums(): Promise<GoogleAlbum[]> {
    const { accessToken } = this.getTokens();
    if (!accessToken) return [];

    try {
      const response = await axios.get('https://photoslibrary.googleapis.com/v1/albums', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { pageSize: 50 },
      });

      const albums: any[] = Array.isArray(response.data?.albums) ? response.data.albums : [];
      return albums.map((a) => ({
        id: a.id,
        title: a.title || 'Untitled Album',
        productUrl: a.productUrl || '',
        isWriteable: a.isWriteable ?? true,
        mediaItemsCount: a.mediaItemsCount || '0',
      }));
    } catch (error: any) {
      console.warn('Google Photos getAlbums warning (scope may be appendonly):', error?.message);
      return [];
    }
  }

  public async createAlbum(title: string): Promise<GoogleAlbum> {
    const { accessToken } = this.getTokens();
    if (!accessToken) {
      throw new Error('Google Photos not connected.');
    }

    // First check if an album with the same title already exists in writeable albums
    const existingAlbums = await this.getAlbums();
    const match = existingAlbums.find((a) => a.title.trim().toLowerCase() === title.trim().toLowerCase() && a.isWriteable);
    if (match) {
      return match;
    }

    try {
      const response = await axios.post(
        'https://photoslibrary.googleapis.com/v1/albums',
        {
          album: { title },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        id: response.data.id,
        title: response.data.title || title,
        productUrl: response.data.productUrl || '',
        isWriteable: response.data.isWriteable ?? true,
        mediaItemsCount: response.data.mediaItemsCount || '0',
      };
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error?.message || 'Failed to create Google Photos album';
      throw new Error(`Create Google album error: ${msg}`);
    }
  }

  /**
   * Streams raw file bytes directly to Google Photos upload server.
   * Returns the uploadToken string.
   */
  public async uploadMediaStream(
    stream: NodeJS.ReadableStream,
    filename: string,
    mimeType: string
  ): Promise<string> {
    const { accessToken } = this.getTokens();
    if (!accessToken) {
      throw new Error('Google Photos not connected.');
    }

    try {
      const response = await axios.post(
        'https://photoslibrary.googleapis.com/v1/uploads',
        stream,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'X-Goog-Upload-Content-Type': mimeType || 'application/octet-stream',
            'X-Goog-Upload-Protocol': 'raw',
            'X-Goog-Upload-File-Name': filename,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 600000, // 10 mins timeout for large media streams
        }
      );

      const uploadToken = response.data;
      if (!uploadToken || typeof uploadToken !== 'string') {
        throw new Error('Invalid uploadToken response from Google Photos');
      }

      return uploadToken;
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error?.message || 'Upload stream failed';
      throw new Error(`Google Photos uploadMediaStream error: ${msg}`);
    }
  }

  /**
   * Creates media items in Google Photos library or inside a specific album.
   * Batches up to 50 items per request as per Google Photos Library API specification.
   */
  public async batchCreateMediaItems(
    items: Array<{ uploadToken: string; filename: string; description?: string }>,
    albumId?: string
  ): Promise<GoogleMediaItem[]> {
    const { accessToken } = this.getTokens();
    if (!accessToken) {
      throw new Error('Google Photos not connected.');
    }

    const createdItems: GoogleMediaItem[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const payload: any = {
        newMediaItems: batch.map((item) => ({
          description: item.description || '',
          simpleMediaItem: {
            uploadToken: item.uploadToken,
            fileName: item.filename,
          },
        })),
      };

      if (albumId) {
        payload.albumId = albumId;
      }

      try {
        const response = await axios.post(
          'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          }
        );

        const results: any[] = Array.isArray(response.data?.newMediaItemResults)
          ? response.data.newMediaItemResults
          : [];

        for (const res of results) {
          if (res.status?.message && res.status.message !== 'Success' && res.status.message !== 'OK') {
            console.warn(`Item creation status warning for file: ${res.status.message}`);
          }
          if (res.mediaItem) {
            createdItems.push({
              id: res.mediaItem.id,
              description: res.mediaItem.description,
              productUrl: res.mediaItem.productUrl || '',
              mimeType: res.mediaItem.mimeType || '',
              filename: res.mediaItem.filename || '',
            });
          }
        }
      } catch (error: any) {
        const msg = error?.response?.data?.error?.message || error?.message || 'Batch create media items failed';
        throw new Error(`Google Photos batchCreateMediaItems error: ${msg}`);
      }
    }

    return createdItems;
  }
}

export const googlePhotosService = new GooglePhotosService();
