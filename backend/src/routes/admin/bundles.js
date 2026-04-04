import express from 'express';
import db from '../../config/db.js';
import { logAudit } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/bundles — all bundles with their items
router.get('/', async (req, res, next) => {
  try {
    const [bundles] = await db.query(
      `SELECT b.id AS bundle_id, p.id AS product_id, p.name_en, p.name_ar, p.fgd, p.slug
       FROM bundles b
       JOIN products p ON p.id = b.product_id
       ORDER BY b.id DESC`
    );
    for (const bundle of bundles) {
      const [items] = await db.query(
        `SELECT bi.*,
                p.name_en AS product_name_en, p.name_ar AS product_name_ar,
                p.fgd AS product_fgd
         FROM bundle_items bi
         LEFT JOIN products p ON p.id = bi.product_id
         WHERE bi.bundle_id = ?
         ORDER BY bi.sort_order`, [bundle.bundle_id]
      );
      bundle.items = items;
    }
    res.json({ data: bundles });
  } catch (err) { next(err); }
});

// GET /api/bundles/:productId — single bundle
router.get('/:productId', async (req, res, next) => {
  try {
    const [[bundle]] = await db.query(
      `SELECT b.id AS bundle_id, p.*
       FROM bundles b JOIN products p ON p.id = b.product_id
       WHERE b.product_id = ?`, [req.params.productId]
    );
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });

    const [items] = await db.query(
      `SELECT bi.*,
              p.name_en AS product_name_en, p.name_ar AS product_name_ar, p.fgd
       FROM bundle_items bi
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE bi.bundle_id = ?
       ORDER BY bi.sort_order`, [bundle.bundle_id]
    );
    res.json({ data: { ...bundle, items } });
  } catch (err) { next(err); }
});

// POST /api/bundles — create a bundle from an existing product
// Body: { product_id, items: [{ product_id?, component_name_en?, component_name_ar?, component_image_url?, qty, sort_order }] }
router.post('/', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { product_id, items = [] } = req.body;

    const [result] = await conn.query(
      `INSERT INTO bundles (product_id) VALUES (?)`, [product_id]
    );
    const bundleId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO bundle_items
          (bundle_id, product_id, component_name_en, component_name_ar, component_image_url, qty, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [bundleId, item.product_id || null,
         item.component_name_en || null, item.component_name_ar || null,
         item.component_image_url || null, item.qty || 1, item.sort_order || 0]
      );
    }

    await conn.commit();
    
    await logAudit(req, 'create', 'bundles', bundleId, { product_id, item_count: items.length });

    res.status(201).json({ data: { bundle_id: bundleId } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PUT /api/bundles/:bundleId/items — replace all bundle items
router.put('/:bundleId/items', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items = [] } = req.body;

    await conn.query(`DELETE FROM bundle_items WHERE bundle_id = ?`, [req.params.bundleId]);
    for (const item of items) {
      await conn.query(
        `INSERT INTO bundle_items
          (bundle_id, product_id, component_name_en, component_name_ar, component_image_url, qty, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.params.bundleId, item.product_id || null,
         item.component_name_en || null, item.component_name_ar || null,
         item.component_image_url || null, item.qty || 1, item.sort_order || 0]
      );
    }
    await conn.commit();

    await logAudit(req, 'update', 'bundles', req.params.bundleId, { item_count: items.length });

    res.json({ message: 'Bundle items updated' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// DELETE /api/bundles/:productId
router.delete('/:productId', async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM bundles WHERE product_id = ?`, [req.params.productId]
    );

    await logAudit(req, 'delete', 'bundles', req.params.productId, { action: 'remove_bundle' });

    res.json({ message: 'Bundle removed' });
  } catch (err) { next(err); }
});

export default router;
