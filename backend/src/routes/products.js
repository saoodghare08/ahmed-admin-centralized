import express from 'express';
import db from '../config/db.js';

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

  return { 
    ...product, 
    fragrance_notes: notes, 
    price, 
    media,
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
    const params = [];

    let query = `
      SELECT DISTINCT p.id
      FROM products p`;

    if (country) {
      query += `
      LEFT JOIN product_country pc ON pc.product_id = p.id
        AND pc.country_id = (SELECT id FROM countries WHERE code = ?)`;
      params.push(country.toUpperCase());
    }

    if (!admin) {
      query += ` WHERE p.is_active = 1`;
    }

    if (country)    { query += ` AND (pc.is_visible IS NULL OR pc.is_visible = 1)`; }
    if (category)    { query += ` AND p.category_id = ?`;    params.push(category); }
    if (subcategory) { query += ` AND p.subcategory_id = ?`; params.push(subcategory); }
    if (featured)    { query += ` AND p.is_featured = 1`; }
    if (search) {
      query += ` AND (p.name_en LIKE ? OR p.name_ar LIKE ? OR p.fgd LIKE ?)`;
      const searchStr = `%${search}%`;
      params.push(searchStr, searchStr, searchStr);
    }

    // Total count
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM (${query}) t`, params
    );

    query += ` ORDER BY p.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [idRows] = await db.query(query, params);
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

    await conn.commit();
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
      res.json({ message: 'Country visibility toggled' });
    } else {
      await db.query(
        `UPDATE products SET is_active = NOT is_active WHERE id = ?`, [req.params.id]
      );
      res.json({ message: 'Global active status toggled' });
    }
  } catch (err) { next(err); }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM products WHERE id = ?`, [req.params.id]);
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

// PUT /api/products/:id/countries — upsert all country configs
router.put('/:id/countries', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const configs = req.body.configs || [];
    for (const cc of configs) {
      await conn.query(
        `INSERT INTO product_country
          (product_id, country_id, is_visible, slug_override,
           meta_title_en, meta_title_ar, meta_desc_en, meta_desc_ar, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           is_visible = VALUES(is_visible),
           slug_override = VALUES(slug_override),
           meta_title_en = VALUES(meta_title_en),
           meta_title_ar = VALUES(meta_title_ar),
           meta_desc_en = VALUES(meta_desc_en),
           meta_desc_ar = VALUES(meta_desc_ar),
           sort_order = VALUES(sort_order)`,
        [req.params.id, cc.country_id, cc.is_visible ?? 1, cc.slug_override || null,
         cc.meta_title_en || null, cc.meta_title_ar || null,
         cc.meta_desc_en || null, cc.meta_desc_ar || null, cc.sort_order || 0]
      );
    }
    await conn.commit();
    res.json({ message: 'Country configs saved' });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
});

export default router;
