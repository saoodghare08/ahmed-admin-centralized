import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import errorHandler from './middleware/errorHandler.js';
import { authenticate, authorize } from './middleware/auth.js';
import { seedAdmin } from './scripts/seedAdmin.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import countries from './routes/countries.js';
import categories from './routes/categories.js';
import products from './routes/products.js';
import pricing from './routes/pricing.js';
import media from './routes/media.js';
import bundles from './routes/bundles.js';
import sales from './routes/sales.js';
import gallery from './routes/gallery.js';
import importRoute from './routes/import.js';
import analytics from './routes/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

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

// ── Public Routes (no auth required) ────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected Routes (auth required) ────────────────────────
app.use('/api/countries',  authenticate, countries);
app.use('/api/categories', authenticate, authorize('categories'), categories);
app.use('/api/products',   authenticate, authorize('products'), products);
app.use('/api/pricing',    authenticate, authorize('pricing'), pricing);
app.use('/api/media',      authenticate, authorize('products'), media);
app.use('/api/bundles',    authenticate, authorize('bundles'), bundles);
app.use('/api/sales',      authenticate, authorize('sales'), sales);
app.use('/api/gallery',    authenticate, authorize('gallery'), gallery);
app.use('/api/import',     authenticate, authorize('products'), importRoute);
app.use('/api/analytics',  authenticate, authorize('analytics'), analytics);
app.use('/api/users',      authenticate, usersRoutes);
app.use('/api/audit-logs', authenticate, auditRoutes);

// ── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`✅  API running at http://localhost:${PORT}`);
  // Seed default admin user on first run
  await seedAdmin();
});

export default app;
