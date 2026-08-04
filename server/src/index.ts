import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/api.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Immich-to-Google-Photos Backend', timestamp: new Date().toISOString() });
});

// API Router
app.use('/api', apiRouter);

// Static Client Files Serving (Production / Docker Mode)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Immich-to-Google-Photos running on port ${PORT}`);
  console.log(`🔗 App URL: http://localhost:${PORT}`);
  console.log(`✨ Ready to migrate photos and albums with zero cloud friction`);
  console.log('====================================================');
});
