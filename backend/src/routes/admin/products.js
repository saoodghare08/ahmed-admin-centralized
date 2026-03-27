import express from 'express';
import db from '../../config/db.js';
import { logAudit } from '../middleware/auth.js';

const router = express.Router();

// ── Helpers ─────────────────────────────────────────────────

/** Build a full product object including sizes, notes, prices, media */
async function buildProduct(productId, countryCode) {
  // Base product
  const [[product]] = await db.query(
    `SELECT p.*,
            c.name_en  AS category_name_en,  c.name_ar  AS category_name_ar,
            sc.name_en AS sub_name_en,        sc.name_ar AS sub_name_ar
     FROM products p
     LEFT JOIN categories    c  ON c.id  = p.category_id
     LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
     WHERE p.id = ?`, [productId]
  );
  if (!product) return null;

  if (typeof product.attributes === 'string') {
    try { product.attributes = JSON.parse(product.attributes); } catch (e) { product.attributes = {}; }
  }
  if (typeof product.tags === 'string') {
    try { product.tags = JSON.parse(product.tags); } catch (e) { product.tags = []; }
  }

  // Fragrance notes
  const [notes] = await db.query(
    `SELECT * FROM fragrance_notes WHERE product_id = ? ORDER BY FIELD(note_type,'top','heart','base')`,
    [productId]
  );

  // Price and Overrides for country
  let price = null;
  let country_visibility = null;
  let country_slug = null;

  if (countryCode) {
    const [priceRows] = await db.query(
      `SELECT pp.*, cu.code AS currency_code, cu.symbol_en, cu.symbol_ar, cu.decimal_places
       FROM product_prices pp
       JOIN currencies cu ON cu.id = pp.currency_id
       JOIN countries  co ON co.id = pp.country_id AND co.code = ?
       WHERE pp.product_id = ?`,
      [countryCode.toUpperCase(), productId]
    );
    price = priceRows[0] || null;

    const [overrideRows] = await db.query(
      `SELECT pc.is_visible, pc.slug_override
       FROM product_country pc
       JOIN countries co ON co.id = pc.country_id
       WHERE pc.product_id = ? AND co.code = ?`,
      [productId, countryCode.toUpperCase()]
    );
    if (overrideRows[0]) {
      country_visibility = overrideRows[0].is_visible;
      country_slug = overrideRows[0].slug_override;
    }
  }

  // Media
  const [media] = await db.query(
    `SELECT * FROM product_media WHERE product_id = ? ORDER BY is_primary DESC, sort_order`,
    [productId]
  );

  // Stock
  const [stock] = await db.query(
    `SELECT ps.*, co.code AS country_code
     FROM product_stock ps
     JOIN countries co ON co.id = ps.country_id
     WHERE ps.product_id = ?`,
    [productId]
  );

  return { 
    ...product, 
    fragrance_notes: notes, 
    price, 
    media,
    stock,
    country_visibility,
    country_slug
  };
}

// ── Routes ───────────────────────────────────────────────────

// GET /api/products?country=AE&category=1&featured=1&page=1&limit=20&search=xyz
router.get('/', async (req, res, next) => {
  try {
    const { country, category, subcategory, featured, search, page = 1, limit = 20, admin } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    // Define Sort
    const allowedSort = ['id', 'fgd', 'name_en', 'category_name_en', 'price'];
    let sortBy    = allowedSort.includes(req.query.sort) ? req.query.sort : 'id';
    let sortOrder = req.query.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let joinClause = `
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
    `;
    const params = [];

    if (country) {
      joinClause += `
      LEFT JOIN product_country pc ON pc.product_id = p.id
        AND pc.country_id = (SELECT id FROM countries WHERE code = ?)`;
      params.push(country.toUpperCase());
    }

    // Map sort fields to columns
    let sortCol = `p.id`;
    if (sortBy === 'fgd') sortCol = 'p.fgd';
    if (sortBy === 'name_en') sortCol = 'p.name_en';
    if (sortBy === 'category_name_en') sortCol = 'c.name_en';
    if (sortBy === 'price') {
      if (country) {
        joinClause += `
        LEFT JOIN product_prices pp ON pp.product_id = p.id 
          AND pp.country_id = (SELECT id FROM countries WHERE code = ?)`;
        params.push(country.toUpperCase());
        sortCol = 'pp.regular_price';
      } else {
        sortCol = 'p.id';
      }
    }

    let whereClause = ` WHERE 1=1`;
    if (!admin) { whereClause += ` AND p.is_active = 1`; }
    if (country && !admin) { whereClause += ` AND (pc.is_visible IS NULL OR pc.is_visible = 1)`; }
    if (category)    { whereClause += ` AND p.category_id = ?`;    params.push(category); }
    if (subcategory) { whereClause += ` AND p.subcategory_id = ?`; params.push(subcategory); }
    if (featured)    { whereClause += ` AND p.is_featured = 1`; }
    if (search) {
      whereClause += ` AND (p.name_en LIKE ? OR p.name_ar LIKE ? OR p.fgd LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    // Total Count using a subquery for distinctness
    const countQuery = `SELECT COUNT(DISTINCT p.id) AS total FROM products p ${joinClause} ${whereClause}`;
    const [[{ total }]] = await db.query(countQuery, params);

    // Final Query: Select ID and the sort column so DISTINCT can include it
    const selectClause = sortCol === 'p.id' ? 'DISTINCT p.id' : `DISTINCT p.id, ${sortCol}`;
    const mainQuery = `SELECT ${selectClause} FROM products p ${joinClause} ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
    
    const [idRows] = await db.query(mainQuery, [...params, parseInt(limit), offset]);
    const ids = idRows.map(r => r.id);

    // Build full product data for each
    const products = await Promise.all(ids.map(id => buildProduct(id, country)));

    res.json({
      data: products.filter(Boolean),
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) { next(err); }
});

// GET /api/products/:id?country=AE
router.get('/:id', async (req, res, next) => {
  try {
    const product = await buildProduct(req.params.id, req.query.country);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ data: product });
  } catch (err) { next(err); }
});

// POST /api/products
router.post('/', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      fgd, slug, name_en, name_ar, description_en, description_ar,
      category_id, subcategory_id, barcode,
      is_active = 1, is_featured = 0, tags, attributes,
      size_label_en, size_label_ar,
      fragrance_notes = [], country_configs = [], prices = []
    } = req.body;

    // Insert product
    const [result] = await conn.query(
      `INSERT INTO products
        (fgd, barcode, slug, name_en, name_ar, description_en, description_ar,
         category_id, subcategory_id, is_active, is_featured, tags, attributes, size_label_en, size_label_ar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fgd, barcode || fgd || null, slug, name_en, name_ar, description_en, description_ar,
       category_id, subcategory_id || null,
       is_active, is_featured,
       tags ? JSON.stringify(tags) : null,
       attributes ? JSON.stringify(attributes) : null,
       size_label_en || null, size_label_ar || null]
    );
    const productId = result.insertId;

    // Fragrance notes
    for (const n of fragrance_notes) {
      await conn.query(
        `INSERT INTO fragrance_notes (product_id, note_type, ingredients, description_en, description_ar, image_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, n.note_type, JSON.stringify(n.ingredients || []),
         n.description_en || null, n.description_ar || null, n.image_url || null]
      );
    }

    // Per-country configs
    for (const cc of country_configs) {
      await conn.query(
        `INSERT INTO product_country (product_id, country_id, is_visible, slug_override,
          meta_title_en, meta_title_ar, meta_desc_en, meta_desc_ar, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, cc.country_id, cc.is_visible ?? 1, cc.slug_override || null,
         cc.meta_title_en || null, cc.meta_title_ar || null,
         cc.meta_desc_en || null, cc.meta_desc_ar || null, cc.sort_order || 0]
      );
    }

    // Prices
    for (const p of prices) {
      await conn.query(
        `INSERT INTO product_prices (product_id, country_id, currency_id, regular_price)
         VALUES (?, ?, ?, ?)`,
        [productId, p.country_id, p.currency_id, p.regular_price]
      );
    }
    
    // Stock
    const stocks = req.body.stock || [];
    for (const s of stocks) {
      await conn.query(
        `INSERT INTO product_stock (product_id, country_id, quantity)
         VALUES (?, ?, ?)`,
        [productId, s.country_id, s.quantity || 0]
      );
    }

    await conn.commit();
    
    await logAudit(req, 'create', 'products', productId, {
      name_en, name_ar, fgd, barcode, slug, category_id, subcategory_id
    });

    res.status(201).json({ data: { id: productId } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      fgd, slug, name_en, name_ar, description_en, description_ar,
      category_id, subcategory_id, barcode,
      is_active, is_featured, tags, attributes,
      size_label_en, size_label_ar
    } = req.body;

    await db.query(
      `UPDATE products SET
        fgd=?, barcode=?, slug=?, name_en=?, name_ar=?, description_en=?, description_ar=?,
        category_id=?, subcategory_id=?,
        is_active=?, is_featured=?, tags=?, attributes=?,
        size_label_en=?, size_label_ar=?
       WHERE id=?`,
      [fgd, barcode || fgd || null, slug, name_en, name_ar, description_en, description_ar,
       category_id, subcategory_id || null,
       is_active ?? 1, is_featured ?? 0,
       tags ? JSON.stringify(tags) : null,
       attributes ? JSON.stringify(attributes) : null,
       size_label_en || null, size_label_ar || null,
       req.params.id]
    );
    
    await logAudit(req, 'update', 'products', req.params.id, {
      name_en, name_ar, fgd, barcode, slug, category_id, subcategory_id, is_active, is_featured
    });

    res.json({ message: 'Product updated' });
  } catch (err) { next(err); }
});

// PATCH /api/products/:id/toggle — toggle is_active
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { country } = req.query;
    if (country) {
      await db.query(
        `UPDATE product_country pc
         JOIN countries co ON co.id = pc.country_id
         SET pc.is_visible = NOT pc.is_visible
         WHERE pc.product_id = ? AND co.code = ?`,
        [req.params.id, country.toUpperCase()]
      );
      
      await logAudit(req, 'update', 'products', req.params.id, { action: 'toggle_country_visibility', country });

      res.json({ message: 'Country visibility toggled' });
    } else {
      await db.query(
        `UPDATE products SET is_active = NOT is_active WHERE id = ?`, [req.params.id]
      );
      
      await logAudit(req, 'update', 'products', req.params.id, { action: 'toggle_global_active' });

      res.json({ message: 'Global active status toggled' });
    }
  } catch (err) { next(err); }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM products WHERE id = ?`, [req.params.id]);
    
    await logAudit(req, 'delete', 'products', req.params.id, { action: 'delete_product' });

    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
});

// ── FRAGRANCE NOTES ──────────────────────────────────────────
// GET /api/products/:id/notes
router.get('/:id/notes', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM fragrance_notes WHERE product_id = ? ORDER BY FIELD(note_type,'top','heart','base')`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// PUT /api/products/:id/notes — upsert all 3 note types at once
router.put('/:id/notes', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const notes = req.body.notes || [];
    for (const n of notes) {
      await conn.query(
        `INSERT INTO fragrance_notes (product_id, note_type, ingredients_en, ingredients_ar, description_en, description_ar, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ingredients_en = VALUES(ingredients_en),
           ingredients_ar = VALUES(ingredients_ar),
           description_en = VALUES(description_en),
           description_ar = VALUES(description_ar),
           image_url = VALUES(image_url)`,
        [req.params.id, n.note_type,
         JSON.stringify(n.ingredients_en || []),
         JSON.stringify(n.ingredients_ar || []),
         n.description_en || null, n.description_ar || null, n.image_url || null]
      );
    }
    await conn.commit();
    
    await logAudit(req, 'update', 'products', req.params.id, { action: 'update_fragrance_notes', count: notes.length });

    res.json({ message: 'Notes saved' });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
});

// ── PRODUCT COUNTRY CONFIGS ──────────────────────────────────
// GET /api/products/:id/countries
router.get('/:id/countries', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT pc.*, co.code AS country_code, co.name_en AS country_name
       FROM product_country pc
       JOIN countries co ON co.id = pc.country_id
       WHERE pc.product_id = ? ORDER BY co.id`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// PUT /api/products/:id/visibility
router.put('/:id/visibility', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const vis = req.body.visibility || [];
    for (const v of vis) {
      await conn.query(
        `INSERT INTO product_country (product_id, country_id, is_visible)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)`,
        [req.params.id, v.country_id, v.is_visible ?? 1]
      );
    }
    await conn.commit();
    res.json({ message: 'Visibility saved' });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
});

// PUT /api/products/:id/seo
router.put('/:id/seo', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const seo = req.body.seo || [];
    for (const s of seo) {
      await conn.query(
        `INSERT INTO product_country
          (product_id, country_id, slug_override, meta_title_en, meta_title_ar, meta_desc_en, meta_desc_ar, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           slug_override = VALUES(slug_override),
           meta_title_en = VALUES(meta_title_en),
           meta_title_ar = VALUES(meta_title_ar),
           meta_desc_en = VALUES(meta_desc_en),
           meta_desc_ar = VALUES(meta_desc_ar),
           sort_order = VALUES(sort_order)`,
        [req.params.id, s.country_id, s.slug_override || null,
         s.meta_title_en || null, s.meta_title_ar || null,
         s.meta_desc_en || null, s.meta_desc_ar || null, s.sort_order || 0]
      );
    }
    await conn.commit();
    
    await logAudit(req, 'update', 'products', req.params.id, { action: 'update_country_configs', count: configs.length });

    res.json({ message: 'Country configs saved' });
    res.json({ message: 'SEO data saved' });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
});

// ── PRODUCT STOCK ──────────────────────────────────────────
// GET /api/products/:id/stock
router.get('/:id/stock', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT ps.*, co.code AS country_code, co.name_en AS country_name
       FROM product_stock ps
       JOIN countries co ON co.id = ps.country_id
       WHERE ps.product_id = ? ORDER BY co.id`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// PUT /api/products/:id/stock
router.put('/:id/stock', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const stocks = req.body.stocks || [];
    for (const s of stocks) {
      await conn.query(
        `INSERT INTO product_stock (product_id, country_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
        [req.params.id, s.country_id, s.quantity || 0]
      );
    }
    await conn.commit();
    res.json({ message: 'Stock saved' });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
});

export default router;
