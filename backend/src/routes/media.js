import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ── Multer config ────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.query.type === 'category'
      ? path.join(__dirname, '../../public/uploads/categories')
      : path.join(__dirname, '../../public/uploads/products', String(req.query.product_id || 'misc'));
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

// POST /api/media/upload?product_id=1001&type=product
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { product_id, size_id, alt_en, alt_ar, is_primary = 0, sort_order = 0 } = req.body;
    const isVideo = req.file.mimetype.startsWith('video');
    const urlPath = req.file.path
      .replace(/\\/g, '/')
      .split('public/')[1];
    const url = `/${urlPath}`;

    let insertId = null;
    if (product_id) {
      const [result] = await db.query(
        `INSERT INTO product_media (product_id, size_id, url, alt_en, alt_ar, media_type, is_primary, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [product_id, size_id || null, url, alt_en || null, alt_ar || null,
         isVideo ? 'video' : 'image', is_primary, sort_order]
      );
      insertId = result.insertId;
    }

    res.status(201).json({ data: { id: insertId, url } });
  } catch (err) { next(err); }
});

// POST /api/media/link — save a gallery path to product_media (no file upload)
router.post('/link', async (req, res, next) => {
  try {
    const { product_id, url, size_id, alt_en, alt_ar, is_primary = 0, sort_order = 0 } = req.body;
    if (!product_id || !url) return res.status(400).json({ error: 'product_id and url are required' });
    const isVideo = /\.(mp4|webm|mov)$/i.test(url);
    const [result] = await db.query(
      `INSERT INTO product_media (product_id, size_id, url, alt_en, alt_ar, media_type, is_primary, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_id, size_id || null, url, alt_en || null, alt_ar || null,
       isVideo ? 'video' : 'image', is_primary, sort_order]
    );
    // If this is set as primary, clear others
    if (is_primary) {
      await db.query(`UPDATE product_media SET is_primary = 0 WHERE product_id = ? AND id != ?`, [product_id, result.insertId]);
    }
    res.status(201).json({ data: { id: result.insertId, url } });
  } catch (err) { next(err); }
});

// GET /api/media/:productId
router.get('/:productId', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM product_media WHERE product_id = ? ORDER BY is_primary DESC, sort_order`,
      [req.params.productId]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// DELETE /api/media/:mediaId
router.delete('/:mediaId', async (req, res, next) => {
  try {
    const [[media]] = await db.query(`SELECT * FROM product_media WHERE id = ?`, [req.params.mediaId]);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    // Delete file from disk
    const filePath = path.join(__dirname, '../../public', media.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.query(`DELETE FROM product_media WHERE id = ?`, [req.params.mediaId]);
    res.json({ message: 'Media deleted' });
  } catch (err) { next(err); }
});

// PATCH /api/media/:mediaId/sort — update sort order / primary
router.patch('/:mediaId/sort', async (req, res, next) => {
  try {
    const { sort_order, is_primary } = req.body;
    await db.query(
      `UPDATE product_media SET sort_order = ?, is_primary = ? WHERE id = ?`,
      [sort_order ?? 0, is_primary ?? 0, req.params.mediaId]
    );
    res.json({ message: 'Updated' });
  } catch (err) { next(err); }
});

// PATCH /api/media/:mediaId/primary — set as primary, clear others for same product
router.patch('/:mediaId/primary', async (req, res, next) => {
  try {
    const [[media]] = await db.query(`SELECT product_id FROM product_media WHERE id = ?`, [req.params.mediaId]);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    await db.query(`UPDATE product_media SET is_primary = 0 WHERE product_id = ?`, [media.product_id]);
    await db.query(`UPDATE product_media SET is_primary = 1 WHERE id = ?`, [req.params.mediaId]);
    res.json({ message: 'Primary set' });
  } catch (err) { next(err); }
});

export default router;
