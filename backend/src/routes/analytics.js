import express from 'express';
import db from '../config/db.js';

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Helper: append optional date-range WHERE clauses
   ────────────────────────────────────────────────────────────── */
function addDateRange(query, params, { from, to }, col = 'o.created_at') {
  if (from) { query += ` AND ${col} >= ?`; params.push(from); }
  if (to) { query += ` AND ${col} <= ?`; params.push(`${to} 23:59:59`); }
  return query;
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ══════════════════════════════════════════════════════════════ */

// GET /api/analytics/summary
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let q = `
      SELECT
        COUNT(*)                     AS total_orders,
        COALESCE(SUM(amount), 0)     AS total_revenue,
        COALESCE(SUM(tax_amount), 0) AS total_tax,
        COALESCE(AVG(amount), 0)     AS avg_order_value,
        COUNT(DISTINCT user_id)      AS total_customers
      FROM ec_orders o WHERE 1=1`;
    q = addDateRange(q, params, { from, to });
    const [rows] = await db.query(q, params);
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

// GET /api/analytics/monthly-sales
router.get('/monthly-sales', async (req, res, next) => {
  try {
    const { from, to, year } = req.query;
    const params = [];
    let q = `
      SELECT
        DATE_FORMAT(o.created_at, '%Y-%m') AS month,
        COUNT(*)                            AS order_count,
        COALESCE(SUM(o.amount), 0)          AS revenue
      FROM ec_orders o WHERE 1=1`;
    if (year) { q += ` AND YEAR(o.created_at) = ?`; params.push(year); }
    q = addDateRange(q, params, { from, to });
    q += ` GROUP BY month ORDER BY month ASC`;
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/order-status
router.get('/order-status', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let q = `
      SELECT COALESCE(o.status, 'unknown') AS status, COUNT(*) AS count
      FROM ec_orders o WHERE 1=1`;
    q = addDateRange(q, params, { from, to });
    q += ` GROUP BY o.status ORDER BY count DESC`;
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/delivery-performance
router.get('/delivery-performance', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let q = `
      SELECT
        ROUND(AVG(DATEDIFF(o.completed_at, o.created_at)), 1) AS avg_completion_days,
        COUNT(CASE WHEN o.completed_at IS NOT NULL THEN 1 END) AS completed_count,
        COUNT(*) AS total_count
      FROM ec_orders o
      WHERE o.completed_at IS NOT NULL`;
    q = addDateRange(q, params, { from, to });
    const [rows] = await db.query(q, params);
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

// GET /api/analytics/recent-orders
router.get('/recent-orders', async (req, res, next) => {
  try {
    const { from, to, status, limit = 20 } = req.query;
    const params = [];
    let q = `
      SELECT
        o.id, o.code AS order_code, o.amount, o.tax_amount,
        o.status, o.created_at, o.completed_at,
        c.id AS customer_id, c.name AS customer_name, c.email AS customer_email
      FROM ec_orders o
      LEFT JOIN ec_customers c ON c.id = o.user_id
      WHERE 1=1`;
    if (status) { q += ` AND o.status = ?`; params.push(status); }
    q = addDateRange(q, params, { from, to });
    q += ` ORDER BY o.created_at DESC LIMIT ?`;
    params.push(Number(limit));
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

/* ══════════════════════════════════════════════════════════════
   PRODUCTS TAB
   ══════════════════════════════════════════════════════════════ */

// GET /api/analytics/top-products
router.get('/top-products', async (req, res, next) => {
  try {
    const { from, to, limit = 10, category } = req.query;
    const params = [];
    let q = `
      SELECT
        op.product_id,
        op.product_name,
        SUM(op.qty)            AS total_qty,
        SUM(op.total_amount)   AS total_revenue
      FROM ec_order_product op
      JOIN ec_orders o ON o.id = op.order_id
      WHERE 1=1`;
    if (category) { q += ` AND op.product_category = ?`; params.push(category); }
    q = addDateRange(q, params, { from, to });
    q += ` GROUP BY op.product_id, op.product_name ORDER BY total_qty DESC LIMIT ?`;
    params.push(Number(limit));
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/least-products
router.get('/least-products', async (req, res, next) => {
  try {
    const { from, to, limit = 10, category } = req.query;
    const params = [];
    let q = `
      SELECT
        op.product_id,
        op.product_name,
        SUM(op.qty)            AS total_qty,
        SUM(op.total_amount)   AS total_revenue
      FROM ec_order_product op
      JOIN ec_orders o ON o.id = op.order_id
      WHERE o.status IN ('completed', 'shipped')`;
    if (category) { q += ` AND op.product_category = ?`; params.push(category); }
    q = addDateRange(q, params, { from, to });
    q += ` GROUP BY op.product_id, op.product_name ORDER BY total_qty ASC LIMIT ?`;
    params.push(Number(limit));
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

/* ══════════════════════════════════════════════════════════════
   CATEGORIES TAB
   ══════════════════════════════════════════════════════════════ */

// GET /api/analytics/category-sales — revenue & qty per category
router.get('/category-sales', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let q = `
      SELECT
        COALESCE(op.product_category, 'Uncategorized') AS category,
        COUNT(DISTINCT op.order_id) AS order_count,
        SUM(op.qty)                 AS total_qty,
        SUM(op.total_amount)        AS total_revenue
      FROM ec_order_product op
      JOIN ec_orders o ON o.id = op.order_id
      WHERE 1=1`;
    q = addDateRange(q, params, { from, to });
    q += ` GROUP BY op.product_category ORDER BY total_revenue DESC`;
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/subcategory-sales — revenue & qty per subcategory
router.get('/subcategory-sales', async (req, res, next) => {
  try {
    const { from, to, category } = req.query;
    const params = [];
    let q = `
      SELECT
        COALESCE(op.product_category, 'Uncategorized')    AS category,
        COALESCE(op.product_subcategory, 'Uncategorized') AS subcategory,
        COUNT(DISTINCT op.order_id) AS order_count,
        SUM(op.qty)                 AS total_qty,
        SUM(op.total_amount)        AS total_revenue
      FROM ec_order_product op
      JOIN ec_orders o ON o.id = op.order_id
      WHERE 1=1`;
    if (category) { q += ` AND op.product_category = ?`; params.push(category); }
    q = addDateRange(q, params, { from, to });
    q += ` GROUP BY op.product_category, op.product_subcategory ORDER BY total_revenue DESC`;
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/category-monthly — monthly trend per category
router.get('/category-monthly', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let q = `
      SELECT
        DATE_FORMAT(o.created_at, '%Y-%m') AS month,
        COALESCE(op.product_category, 'Uncategorized') AS category,
        SUM(op.qty)          AS total_qty,
        SUM(op.total_amount) AS total_revenue
      FROM ec_order_product op
      JOIN ec_orders o ON o.id = op.order_id
      WHERE 1=1`;
    q = addDateRange(q, params, { from, to });
    q += ` GROUP BY month, op.product_category ORDER BY month ASC, total_revenue DESC`;
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/categories — list of distinct categories
router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT product_category AS category 
      FROM ec_order_product 
      WHERE product_category IS NOT NULL 
      ORDER BY category ASC
    `);
    res.json({ data: rows.map(r => r.category) });
  } catch (err) { next(err); }
});

// GET /api/analytics/product-search
router.get('/product-search', async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) return res.json({ data: [] });
    const search = `%${q}%`;
    const query = `
      SELECT product_id, product_name, product_category
      FROM ec_order_product
      WHERE product_name LIKE ? OR product_id = ?
      GROUP BY product_id, product_name, product_category
      LIMIT ?
    `;
    const [rows] = await db.query(query, [search, q, Number(limit)]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/product-monthly
router.get('/product-monthly', async (req, res, next) => {
  try {
    const { product_id, from, to } = req.query;
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });
    const params = [product_id];
    let q = `
      SELECT
        DATE_FORMAT(o.created_at, '%Y-%m') AS month,
        SUM(op.qty) AS total_qty,
        SUM(op.total_amount) AS total_revenue
      FROM ec_order_product op
      JOIN ec_orders o ON o.id = op.order_id
      WHERE op.product_id = ?
    `;
    q = addDateRange(q, params, { from, to });
    q += " GROUP BY month ORDER BY month ASC";
    const [rows] = await db.query(q, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

export default router;
