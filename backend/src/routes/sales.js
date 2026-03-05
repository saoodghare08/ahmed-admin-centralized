import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// POST /api/sales/log — push sale record from external system
// Body: { product_id, country_id, qty_sold, unit_price, currency_id, sold_at?, order_ref? }
router.post('/log', async (req, res, next) => {
  try {
    const { product_id, country_id, qty_sold = 1, unit_price, currency_id, sold_at, order_ref } = req.body;
    await db.query(
      `INSERT INTO product_sales_log (product_id, country_id, qty_sold, unit_price, currency_id, sold_at, order_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product_id, country_id, qty_sold, unit_price || null, currency_id || null,
       sold_at ? new Date(sold_at) : new Date(), order_ref || null]
    );
    res.status(201).json({ message: 'Sale logged' });
  } catch (err) { next(err); }
});

// POST /api/sales/log/bulk — push multiple records at once
router.post('/log/bulk', async (req, res, next) => {
  try {
    const { records = [] } = req.body;
    if (!records.length) return res.status(400).json({ error: 'No records provided' });

    const values = records.map(r => [
      r.product_id, r.country_id, r.qty_sold || 1, r.unit_price || null,
      r.currency_id || null, r.sold_at ? new Date(r.sold_at) : new Date(), r.order_ref || null
    ]);
    await db.query(
      `INSERT INTO product_sales_log (product_id, country_id, qty_sold, unit_price, currency_id, sold_at, order_ref)
       VALUES ?`, [values]
    );
    res.status(201).json({ message: `${records.length} records logged` });
  } catch (err) { next(err); }
});

// GET /api/sales/report?country=AE&product_id=1001&from=2025-01-01&to=2025-12-31
router.get('/report', async (req, res, next) => {
  try {
    const { country, product_id, from, to } = req.query;
    const params = [];
    let query = `
      SELECT
        sl.product_id,
        p.name_en, p.name_ar, p.fgd,
        co.code AS country_code, co.name_en AS country_name,
        SUM(sl.qty_sold) AS total_units,
        SUM(sl.qty_sold * COALESCE(sl.unit_price, 0)) AS total_revenue,
        cu.code AS currency_code
      FROM product_sales_log sl
      JOIN products  p  ON p.id  = sl.product_id
      JOIN countries co ON co.id = sl.country_id
      LEFT JOIN currencies cu ON cu.id = sl.currency_id
      WHERE 1=1`;

    if (country)    { query += ` AND co.code = ?`;       params.push(country.toUpperCase()); }
    if (product_id) { query += ` AND sl.product_id = ?`; params.push(product_id); }
    if (from)       { query += ` AND sl.sold_at >= ?`;   params.push(new Date(from)); }
    if (to)         { query += ` AND sl.sold_at <= ?`;   params.push(new Date(to)); }

    query += ` GROUP BY sl.product_id, sl.country_id ORDER BY total_units DESC`;

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

export default router;
