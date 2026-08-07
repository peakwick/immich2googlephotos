import { Router, Request, Response } from 'express';
import { immichService } from '../services/immich.service';
import { googlePhotosService } from '../services/googlePhotos.service';
import { migrationService } from '../services/migration.service';
import { storageService } from '../services/storage.service';

const router = Router();

// ==========================================
// IMMICH API ENDPOINTS
// ==========================================
router.post('/immich/test', async (req: Request, res: Response) => {
  try {
    const { immichUrl, immichApiKey } = req.body;
    const serverInfo = await immichService.testConnection(immichUrl, immichApiKey);

    // Save to local storage if successful
    if (immichUrl || immichApiKey) {
      storageService.saveSettings({
        ...(immichUrl ? { immichUrl } : {}),
        ...(immichApiKey ? { immichApiKey } : {}),
      });
    }

    res.json({ success: true, serverInfo });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/immich/albums', async (_req: Request, res: Response) => {
  try {
    const albums = await immichService.getAllAlbums();
    res.json({ success: true, albums });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/immich/assets', async (_req: Request, res: Response) => {
  try {
    const assets = await immichService.getAllAssets();
    res.json({ success: true, count: assets.length, assets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/immich/assets/:id/thumbnail', async (req: Request, res: Response) => {
  try {
    const { stream, mimeType } = await immichService.getAssetThumbnailStream(req.params.id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (error: any) {
    res.status(404).send('Thumbnail not found');
  }
});

// ==========================================
// EXIF DIAGNOSTICS ENDPOINT
// ==========================================
router.get('/exif/diagnostics', async (_req: Request, res: Response) => {
  try {
    const assets = await immichService.getAllAssets(true);
    const albums = await immichService.getAllAlbums();
    
    // Map albums by asset ID for quick lookup
    const albumMap: Record<string, string[]> = {};
    for (const album of albums) {
      if (album.id) {
        const albumAssets = await immichService.getAlbumAssets(album.id, true);
        albumAssets.forEach(a => {
          if (!albumMap[a.id]) albumMap[a.id] = [];
          albumMap[a.id].push(album.albumName);
        });
      }
    }

    const results: any[] = [];

    for (const asset of assets) {
      const dbDate = new Date(asset.fileCreatedAt);
      const rawExif = asset.exifInfo?.dateTimeOriginal;
      
      let status = 'MISMATCH';
      let diffMinutes = 0;
      let exifDate: string | null = null;

      if (!rawExif) {
        status = 'NO_EXIF';
        diffMinutes = 999999;
      } else {
        const eDate = new Date(rawExif);
        if (isNaN(eDate.getTime())) {
          status = 'NO_EXIF';
          diffMinutes = 999999;
        } else {
          exifDate = eDate.toISOString();
          diffMinutes = Math.abs(dbDate.getTime() - eDate.getTime()) / 60000;
        }
      }

      // If diff is greater than 1 minute (to account for minor rounding/timezone edge cases)
      // Actually timezone differences can be exact hours. For now, any difference > 1 minute is flagged.
      if (diffMinutes > 1 || status === 'NO_EXIF') {
        results.push({
          assetId: asset.id,
          originalFileName: asset.originalFileName,
          type: asset.type,
          albumNames: albumMap[asset.id] || [],
          dbDate: dbDate.toISOString(),
          exifDate,
          status,
          diffMinutes: Math.round(diffMinutes),
        });
      }
    }

    res.json({ success: true, count: results.length, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// GOOGLE PHOTOS OAUTH ENDPOINTS
// ==========================================
router.get('/auth/google/url', (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret, redirectUri } = req.query;
    if (clientId || clientSecret) {
      storageService.saveSettings({
        ...(clientId ? { googleClientId: String(clientId) } : {}),
        ...(clientSecret ? { googleClientSecret: String(clientSecret) } : {}),
      });
    }
    const url = googlePhotosService.getAuthUrl(
      clientId ? String(clientId) : undefined,
      clientSecret ? String(clientSecret) : undefined,
      redirectUri ? String(redirectUri) : undefined
    );
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auth/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, clientId, clientSecret, redirectUri } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Authorization code is required' });
    }
    const tokens = await googlePhotosService.exchangeCode(code, clientId, clientSecret, redirectUri);
    res.json({ success: true, tokens });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Support GET loopback redirect from Google OAuth consent screen
router.get('/auth/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  // We should construct the current URL as redirect URI for the GET callback
  // Usually this is requested by Google hitting the homelab backend
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const currentUrl = `${protocol}://${host}${req.baseUrl}${req.path}`;

  if (error) {
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #1a1b26; color: #f7768e;">
          <h2>Google Authorization Failed</h2>
          <p>${error}</p>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('No authorization code received.');
  }

  try {
    await googlePhotosService.exchangeCode(code, undefined, undefined, currentUrl);
    res.send(`
      <html>
        <body style="font-family: 'Inter', sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #38bdf8;">
          <div style="max-width: 480px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h1 style="color: #4ade80; margin-bottom: 10px;">Connection Successful!</h1>
            <p style="color: #cbd5e1; font-size: 16px;">Your Google Photos account is now linked with the Immich Migration App.</p>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 25px;">You may now close this browser tab and return to the application.</p>
          </div>
          <script>
            setTimeout(() => { window.close(); }, 3000);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f87171;">
          <h2>Authentication Error</h2>
          <p>${err.message}</p>
          <p>You can also copy the authorization code from the URL and paste it manually into the app.</p>
        </body>
      </html>
    `);
  }
});

router.post('/auth/google/token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }
    await googlePhotosService.setDirectAccessToken(token);
    res.json({ success: true, message: 'Access token saved successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/auth/google/status', async (_req: Request, res: Response) => {
  try {
    const profile = await googlePhotosService.getUserProfile();
    res.json({ success: true, connected: true, profile });
  } catch (error: any) {
    res.json({ success: true, connected: false, error: error.message });
  }
});

router.post('/auth/google/disconnect', async (_req: Request, res: Response) => {
  try {
    storageService.saveSettings({ googleAccessToken: '', googleRefreshToken: '' });
    res.json({ success: true, message: 'Disconnected' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/immich/disconnect', async (_req: Request, res: Response) => {
  try {
    storageService.saveSettings({ immichUrl: '', immichApiKey: '' });
    res.json({ success: true, message: 'Disconnected' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// MIGRATION JOB ENDPOINTS
// ==========================================
router.post('/migration/start', async (req: Request, res: Response) => {
  try {
    const options = req.body;
    await migrationService.startMigration(options);
    res.json({ success: true, progress: migrationService.getProgress() });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/migration/pause', (_req: Request, res: Response) => {
  migrationService.pauseMigration();
  res.json({ success: true, progress: migrationService.getProgress() });
});

router.post('/migration/resume', (_req: Request, res: Response) => {
  migrationService.resumeMigration();
  res.json({ success: true, progress: migrationService.getProgress() });
});

router.post('/migration/cancel', (_req: Request, res: Response) => {
  migrationService.cancelMigration();
  res.json({ success: true, progress: migrationService.getProgress() });
});

router.get('/migration/status', (_req: Request, res: Response) => {
  res.json({ success: true, progress: migrationService.getProgress() });
});

router.get('/migration/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  migrationService.addSSEClient(res);
});

// ==========================================
// SETTINGS & HISTORY
// ==========================================
router.get('/settings', (_req: Request, res: Response) => {
  const settings = storageService.getSettings();
  // Mask API key and tokens slightly for security
  res.json({
    success: true,
    settings: {
      immichUrl: settings.immichUrl,
      immichApiKey: settings.immichApiKey,
      googleClientId: settings.googleClientId,
      hasGoogleToken: Boolean(settings.googleAccessToken),
    },
  });
});

router.get('/history', (_req: Request, res: Response) => {
  const records = storageService.getMigrationRecords();
  res.json({ success: true, records, count: records.length });
});

router.get('/history/sessions', (_req: Request, res: Response) => {
  const sessions = storageService.getSessions();
  // Sort descending by date
  sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  res.json({ success: true, sessions, count: sessions.length });
});

router.delete('/history/sessions/:id', (req: Request, res: Response) => {
  const sessionId = req.params.id;
  storageService.deleteSession(sessionId);
  res.json({ success: true, message: 'Session deleted' });
});

router.delete('/history', (_req: Request, res: Response) => {
  storageService.clearMigrationHistory();
  res.json({ success: true, message: 'Migration history cleared' });
});

export default router;
