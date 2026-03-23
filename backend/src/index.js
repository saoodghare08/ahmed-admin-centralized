import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import errorHandler from './middleware/errorHandler.js';

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

// Serve uploaded files statically
// Serve gallery files statically
app.use('/gallery', express.static(path.join(__dirname, '..', 'public', 'gallery')));

// ── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────
app.use('/api/countries', countries);
app.use('/api/categories', categories);
app.use('/api/products', products);
app.use('/api/pricing', pricing);
app.use('/api/media', media);
app.use('/api/bundles', bundles);
app.use('/api/sales', sales);
app.use('/api/gallery', gallery);
app.use('/api/import', importRoute);
app.use('/api/analytics', analytics);

// ── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅  API running at http://localhost:${PORT}`);
});

// Trigger nodemon restart after dependency fix

export default app;
