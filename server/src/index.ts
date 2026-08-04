import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import os from 'os';
import apiRouter from './routes/api.routes';

dotenv.config();

// Prefer IPv4 over IPv6 in Node.js HTTP/HTTPS client to prevent Docker Alpine container network timeouts
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const app = express();
const PORT = process.env.PORT || 3383;

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

function getLocalIPs(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Start server
app.listen(PORT, () => {
  const ips = getLocalIPs();
  console.log('\n====================================================');
  console.log('🚀 IMMICH TO GOOGLE PHOTOS MIGRATION TOOL IS READY!');
  console.log('====================================================');
  console.log(`🔗 Access Web UI in your browser at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  ips.forEach((ip) => {
    console.log(`   👉 http://${ip}:${PORT}`);
  });
  console.log('\n✨ Built for 24/7 Always-On Homelab Migration');
  console.log('====================================================\n');
});
