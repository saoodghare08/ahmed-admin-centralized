import express from 'express';
import db from '../config/db.js';
import { logAudit } from '../middleware/auth.js';

const router = express.Router();

// GET /api/pricing/:productId — all country prices for a product
router.get('/:productId', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT pp.*, co.code AS country_code, co.name_en AS country_name,
              cu.code AS currency_code, cu.symbol_en, cu.decimal_places
       FROM product_prices pp
       JOIN countries  co ON co.id = pp.country_id
       JOIN currencies cu ON cu.id = pp.currency_id
       WHERE pp.product_id = ?
       ORDER BY co.id`, [req.params.productId]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// PUT /api/pricing/:productId — upsert prices for all countries at once
// Body: { prices: [{ country_id, currency_id, regular_price, cost_price }] }
router.put('/:productId', async (req, res, next) => {
  try {
    const { prices = [] } = req.body;
    const productId = req.params.productId;

    for (const p of prices) {
      await db.query(
        `INSERT INTO product_prices (product_id, country_id, currency_id, regular_price)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           currency_id   = VALUES(currency_id),
           regular_price = VALUES(regular_price)`,
        [productId, p.country_id, p.currency_id, p.regular_price]
      );
    }
    
    await logAudit(req, 'update', 'pricing', productId, { action: 'bulk_update_prices', prices });
    
    res.json({ message: 'Prices updated' });
  } catch (err) { next(err); }
});

// PATCH /api/pricing/:productId/country/:countryId — update single country price
router.patch('/:productId/country/:countryId', async (req, res, next) => {
  try {
    const { currency_id, regular_price } = req.body;
    await db.query(
      `INSERT INTO product_prices (product_id, country_id, currency_id, regular_price)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         currency_id   = VALUES(currency_id),
         regular_price = VALUES(regular_price)`,
      [req.params.productId, req.params.countryId, currency_id, regular_price]
    );
    
    await logAudit(req, 'update', 'pricing', req.params.productId, { 
      action: 'update_country_price', 
      country_id: req.params.countryId, 
      regular_price 
    });

    res.json({ message: 'Price updated' });
  } catch (err) { next(err); }
});

export default router;
