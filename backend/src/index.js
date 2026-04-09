import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import errorHandler from './middleware/errorHandler.js';
import { seedAdmin } from './scripts/seedAdmin.js';

import authRoutes from './routes/auth.js';
import storefrontRoutes from './routes/storefront/index.js';
import adminRoutes from './routes/admin/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', true);

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

// Serve gallery files statically
app.use('/gallery', express.static(path.join(__dirname, '..', 'public', 'gallery')));

// ── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/storefront', storefrontRoutes);
app.use('/api', adminRoutes);


// ── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`✅  API running at http://localhost:${PORT}`);
  // Seed default admin user on first run
  await seedAdmin();
});

export default app;
