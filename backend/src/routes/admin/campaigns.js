import express from 'express';
import db from '../../config/db.js';

const router = express.Router();

/* ================================================================
   HELPERS
   ================================================================ */

// Insert type-specific rules inside a transaction connection
async function insertDiscountRules(conn, campaignId, rules, overrides = []) {
  if (!rules) return;
  await conn.query(
    `INSERT INTO campaign_discount_rules (campaign_id, discount_type, discount_value, min_price)
     VALUES (?, ?, ?, ?)`,
    [campaignId, rules.discount_type, rules.discount_value, rules.min_price || 0]
  );
  if (overrides.length) {
    const vals = overrides.map(o => [campaignId, o.product_id, o.discount_type, o.discount_value]);
    await conn.query(
      `INSERT INTO campaign_product_overrides (campaign_id, product_id, discount_type, discount_value) VALUES ?`,
      [vals]
    );
  }
}

async function insertBxgyRules(conn, campaignId, rules, products) {
  if (!rules) return;
  await conn.query(
    `INSERT INTO campaign_bxgy_rules
       (campaign_id, buy_qty, get_qty, get_discount_type, get_discount_value, is_repeatable, max_repeats, allow_overlap)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [campaignId, rules.buy_qty, rules.get_qty, rules.get_discount_type || 'free',
     rules.get_discount_value || 0, rules.is_repeatable ? 1 : 0,
     rules.max_repeats || null, rules.allow_overlap ? 1 : 0]
  );
  if (products) {
    const buyVals = (products.buy || []).map(pid => [campaignId, pid, 'buy']);
    const getVals = (products.get || []).map(pid => [campaignId, pid, 'get']);
    const all = [...buyVals, ...getVals];
    if (all.length) {
      await conn.query(
        `INSERT INTO campaign_bxgy_products (campaign_id, product_id, list_type) VALUES ?`, [all]
      );
    }
  }
}

async function insertFocRules(conn, campaignId, rules, products = []) {
  if (!rules) return;
  await conn.query(
    `INSERT INTO campaign_foc_rules (campaign_id, cart_min, cart_max, selection_mode, max_free_items)
     VALUES (?, ?, ?, ?, ?)`,
    [campaignId, rules.cart_min, rules.cart_max || null,
     rules.selection_mode || 'auto', rules.max_free_items || 1]
  );
  if (products.length) {
    const vals = products.map(pid => [campaignId, pid]);
    await conn.query(
      `INSERT INTO campaign_foc_products (campaign_id, product_id) VALUES ?`, [vals]
    );
  }
}

async function deleteTypeRules(conn, campaignId) {
  await conn.query(`DELETE FROM campaign_discount_rules WHERE campaign_id = ?`, [campaignId]);
  await conn.query(`DELETE FROM campaign_product_overrides WHERE campaign_id = ?`, [campaignId]);
  await conn.query(`DELETE FROM campaign_bxgy_rules WHERE campaign_id = ?`, [campaignId]);
  await conn.query(`DELETE FROM campaign_bxgy_products WHERE campaign_id = ?`, [campaignId]);
  await conn.query(`DELETE FROM campaign_foc_rules WHERE campaign_id = ?`, [campaignId]);
  await conn.query(`DELETE FROM campaign_foc_products WHERE campaign_id = ?`, [campaignId]);
}

// Build a scope summary string
function scopeSummary(scopes) {
  if (!scopes || !scopes.length) return 'None';
  if (scopes.some(s => s.scope_type === 'all')) return 'All products';
  const cats = scopes.filter(s => s.scope_type === 'category').length;
  const subs = scopes.filter(s => s.scope_type === 'subcategory').length;
  const prods = scopes.filter(s => s.scope_type === 'product').length;
  const parts = [];
  if (cats) parts.push(`${cats} categor${cats > 1 ? 'ies' : 'y'}`);
  if (subs) parts.push(`${subs} subcategor${subs > 1 ? 'ies' : 'y'}`);
  if (prods) parts.push(`${prods} product${prods > 1 ? 's' : ''}`);
  return parts.join(', ');
}

/* ================================================================
   GET /api/campaigns  — list with filters & pagination
   ================================================================ */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type, country, search, sort = 'created_at', order = 'desc' } = req.query;
    const offset = (Math.max(1, +page) - 1) * +limit;
    const params = [];

    let where = 'WHERE 1=1';
    if (status) { where += ` AND c.status = ?`; params.push(status); }
    if (type) { where += ` AND c.type = ?`; params.push(type); }
    if (search) { where += ` AND (c.name_en LIKE ? OR c.name_ar LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
    if (country) {
      where += ` AND c.id IN (SELECT campaign_id FROM campaign_countries cc2
                  JOIN countries co ON co.id = cc2.country_id WHERE co.code = ?)`;
      params.push(country.toUpperCase());
    }

    const allowedSorts = ['priority', 'start_at', 'end_at', 'created_at', 'name_en'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Count
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM campaigns c ${where}`, params);

    // Rows
    const [rows] = await db.query(
      `SELECT c.*, GROUP_CONCAT(DISTINCT co.code) AS country_codes
       FROM campaigns c
       LEFT JOIN campaign_countries cc ON cc.campaign_id = c.id
       LEFT JOIN countries co ON co.id = cc.country_id
       ${where}
       GROUP BY c.id
       ORDER BY c.${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, +limit, offset]
    );

    // Scope summaries
    if (rows.length) {
      const ids = rows.map(r => r.id);
      const [scopes] = await db.query(
        `SELECT * FROM campaign_scope WHERE campaign_id IN (?)`, [ids]
      );
      const scopeMap = {};
      scopes.forEach(s => {
        if (!scopeMap[s.campaign_id]) scopeMap[s.campaign_id] = [];
        scopeMap[s.campaign_id].push(s);
      });
      rows.forEach(r => {
        r.countries = r.country_codes ? r.country_codes.split(',') : [];
        delete r.country_codes;
        r.scope_summary = scopeSummary(scopeMap[r.id]);
      });
    }

    res.json({ data: rows, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { next(err); }
});

/* ================================================================
   GET /api/campaigns/:id  — full detail
   ================================================================ */
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const [[campaign]] = await db.query(`SELECT * FROM campaigns WHERE id = ?`, [id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Countries
    const [countries] = await db.query(
      `SELECT co.id, co.code, co.name_en FROM campaign_countries cc
       JOIN countries co ON co.id = cc.country_id WHERE cc.campaign_id = ?`, [id]
    );
    campaign.countries = countries;

    // Scope
    const [scope] = await db.query(`SELECT * FROM campaign_scope WHERE campaign_id = ?`, [id]);
    campaign.scope = scope;

    // Type-specific rules
    if (campaign.type === 'discount') {
      const [[rules]] = await db.query(`SELECT * FROM campaign_discount_rules WHERE campaign_id = ?`, [id]);
      campaign.discount_rules = rules || null;
      const [overrides] = await db.query(
        `SELECT po.*, p.name_en AS product_name, p.fgd AS product_fgd
         FROM campaign_product_overrides po
         JOIN products p ON p.id = po.product_id
         WHERE po.campaign_id = ?`, [id]
      );
      campaign.product_overrides = overrides;
    } else if (campaign.type === 'bxgy') {
      const [[rules]] = await db.query(`SELECT * FROM campaign_bxgy_rules WHERE campaign_id = ?`, [id]);
      campaign.bxgy_rules = rules || null;
      const [products] = await db.query(`SELECT * FROM campaign_bxgy_products WHERE campaign_id = ?`, [id]);
      campaign.bxgy_products = { buy: products.filter(p => p.list_type === 'buy'), get: products.filter(p => p.list_type === 'get') };
    } else if (campaign.type === 'foc') {
      const [[rules]] = await db.query(`SELECT * FROM campaign_foc_rules WHERE campaign_id = ?`, [id]);
      campaign.foc_rules = rules || null;
      const [products] = await db.query(`SELECT * FROM campaign_foc_products WHERE campaign_id = ?`, [id]);
      campaign.foc_products = products;
    }

    // History
    const [history] = await db.query(
      `SELECT * FROM campaign_history WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 20`, [id]
    );
    campaign.history = history;

    res.json({ data: campaign });
  } catch (err) { next(err); }
});

/* ================================================================
   POST /api/campaigns  — create
   ================================================================ */
router.post('/', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name_en, name_ar, type, priority = 100, start_at, end_at,
      is_stackable = false, max_uses, notes, countries = [], scope = [],
      discount_rules, product_overrides = [],
      bxgy_rules, bxgy_products,
      foc_rules, foc_products = []
    } = req.body;

    // Determine initial status
    const now = new Date();
    const startDate = new Date(start_at);
    let status = 'draft';
    if (req.body.activate) {
      status = startDate <= now ? 'active' : 'scheduled';
    }

    const [result] = await conn.query(
      `INSERT INTO campaigns (name_en, name_ar, type, status, priority, start_at, end_at, is_stackable, max_uses, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name_en, name_ar || null, type, status, priority, start_at, end_at,
       is_stackable ? 1 : 0, max_uses || null, notes || null]
    );
    const campaignId = result.insertId;

    // Countries
    if (countries.length) {
      const cVals = countries.map(cid => [campaignId, cid]);
      await conn.query(`INSERT INTO campaign_countries (campaign_id, country_id) VALUES ?`, [cVals]);
    }

    // Scope
    if (scope.length) {
      const sVals = scope.map(s => [campaignId, s.scope_type, s.scope_ref_id || null]);
      await conn.query(`INSERT INTO campaign_scope (campaign_id, scope_type, scope_ref_id) VALUES ?`, [sVals]);
    }

    // Type rules
    if (type === 'discount') await insertDiscountRules(conn, campaignId, discount_rules, product_overrides);
    if (type === 'bxgy') await insertBxgyRules(conn, campaignId, bxgy_rules, bxgy_products);
    if (type === 'foc') await insertFocRules(conn, campaignId, foc_rules, foc_products);

    // History
    await conn.query(
      `INSERT INTO campaign_history (campaign_id, action, details) VALUES (?, 'created', ?)`,
      [campaignId, JSON.stringify({ type, status })]
    );

    await conn.commit();
    res.status(201).json({ id: campaignId, message: 'Campaign created successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

/* ================================================================
   PUT /api/campaigns/:id  — update
   ================================================================ */
router.put('/:id', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const id = req.params.id;
    const {
      name_en, name_ar, type, priority, start_at, end_at,
      is_stackable, max_uses, notes, countries = [], scope = [],
      discount_rules, product_overrides = [],
      bxgy_rules, bxgy_products,
      foc_rules, foc_products = []
    } = req.body;

    await conn.query(
      `UPDATE campaigns SET name_en=?, name_ar=?, type=?, priority=?, start_at=?, end_at=?,
       is_stackable=?, max_uses=?, notes=?, updated_at=NOW() WHERE id=?`,
      [name_en, name_ar || null, type, priority, start_at, end_at,
       is_stackable ? 1 : 0, max_uses || null, notes || null, id]
    );

    // Rebuild countries
    await conn.query(`DELETE FROM campaign_countries WHERE campaign_id = ?`, [id]);
    if (countries.length) {
      const cVals = countries.map(cid => [id, cid]);
      await conn.query(`INSERT INTO campaign_countries (campaign_id, country_id) VALUES ?`, [cVals]);
    }

    // Rebuild scope
    await conn.query(`DELETE FROM campaign_scope WHERE campaign_id = ?`, [id]);
    if (scope.length) {
      const sVals = scope.map(s => [id, s.scope_type, s.scope_ref_id || null]);
      await conn.query(`INSERT INTO campaign_scope (campaign_id, scope_type, scope_ref_id) VALUES ?`, [sVals]);
    }

    // Rebuild type rules
    await deleteTypeRules(conn, id);
    if (type === 'discount') await insertDiscountRules(conn, id, discount_rules, product_overrides);
    if (type === 'bxgy') await insertBxgyRules(conn, id, bxgy_rules, bxgy_products);
    if (type === 'foc') await insertFocRules(conn, id, foc_rules, foc_products);

    // History
    await conn.query(
      `INSERT INTO campaign_history (campaign_id, action, details) VALUES (?, 'updated', ?)`,
      [id, JSON.stringify({ type })]
    );

    await conn.commit();
    res.json({ message: 'Campaign updated' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

/* ================================================================
   PATCH /api/campaigns/:id/status  — change status
   ================================================================ */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db.query(`UPDATE campaigns SET status = ?, updated_at = NOW() WHERE id = ?`, [status, req.params.id]);

    const actionMap = { active: 'activated', paused: 'paused', expired: 'expired', archived: 'archived' };
    if (actionMap[status]) {
      await db.query(
        `INSERT INTO campaign_history (campaign_id, action) VALUES (?, ?)`,
        [req.params.id, actionMap[status]]
      );
    }

    res.json({ message: `Campaign ${status}` });
  } catch (err) { next(err); }
});

/* ================================================================
   DELETE /api/campaigns/:id
   ================================================================ */
router.delete('/:id', async (req, res, next) => {
  try {
    // Only drafts can be hard-deleted; others get archived
    const [[campaign]] = await db.query(`SELECT status FROM campaigns WHERE id = ?`, [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    if (campaign.status === 'draft') {
      await db.query(`DELETE FROM campaigns WHERE id = ?`, [req.params.id]);
      res.json({ message: 'Campaign deleted' });
    } else {
      await db.query(`UPDATE campaigns SET status = 'archived', updated_at = NOW() WHERE id = ?`, [req.params.id]);
      await db.query(
        `INSERT INTO campaign_history (campaign_id, action) VALUES (?, 'archived')`, [req.params.id]
      );
      res.json({ message: 'Campaign archived' });
    }
  } catch (err) { next(err); }
});

/* ================================================================
   POST /api/campaigns/validate  — check conflicts
   ================================================================ */
router.post('/validate', async (req, res, next) => {
  try {
    const { type, start_at, end_at, countries = [], scope = [], id: excludeId } = req.body;
    const errors = [];
    const warnings = [];

    // 1. Date validation
    if (new Date(start_at) >= new Date(end_at)) {
      errors.push({ code: 'INVALID_DATES', message: 'Start date must be before end date' });
    }
    if (new Date(end_at) < new Date()) {
      errors.push({ code: 'PAST_END_DATE', message: 'End date is in the past' });
    }

    // 2. Check for overlapping campaigns of the same type in the same countries
    if (countries.length && !errors.length) {
      let overlapQuery = `
        SELECT DISTINCT c.id, c.name_en, c.type, c.start_at, c.end_at
        FROM campaigns c
        JOIN campaign_countries cc ON cc.campaign_id = c.id
        WHERE c.type = ? AND c.status IN ('draft','scheduled','active')
          AND c.start_at < ? AND c.end_at > ?
          AND cc.country_id IN (?)`;
      const params = [type, end_at, start_at, countries];
      if (excludeId) {
        overlapQuery += ` AND c.id != ?`;
        params.push(excludeId);
      }

      const [overlaps] = await db.query(overlapQuery, params);

      // Check scope overlap
      for (const overlap of overlaps) {
        const [oScopes] = await db.query(
          `SELECT * FROM campaign_scope WHERE campaign_id = ?`, [overlap.id]
        );
        // If either campaign targets 'all', they definitely overlap
        const thisHasAll = scope.some(s => s.scope_type === 'all');
        const otherHasAll = oScopes.some(s => s.scope_type === 'all');

        if (thisHasAll || otherHasAll) {
          warnings.push({
            code: 'DATE_OVERLAP',
            message: `Overlaps with "${overlap.name_en}" (ID ${overlap.id}) — both cover all products`
          });
        } else {
          // Check if any specific scope refs match
          const thisRefs = new Set(scope.map(s => `${s.scope_type}:${s.scope_ref_id}`));
          const otherRefs = new Set(oScopes.map(s => `${s.scope_type}:${s.scope_ref_id}`));
          const intersection = [...thisRefs].filter(r => otherRefs.has(r));
          if (intersection.length) {
            warnings.push({
              code: 'DATE_OVERLAP',
              message: `Overlaps with "${overlap.name_en}" (ID ${overlap.id}) on ${intersection.length} scope(s)`
            });
          }
        }
      }
    }

    // 3. Validate product references
    const productIds = [];
    scope.filter(s => s.scope_type === 'product').forEach(s => productIds.push(s.scope_ref_id));
    if (req.body.product_overrides) req.body.product_overrides.forEach(o => productIds.push(o.product_id));
    if (req.body.bxgy_products) {
      (req.body.bxgy_products.buy || []).forEach(p => productIds.push(p));
      (req.body.bxgy_products.get || []).forEach(p => productIds.push(p));
    }
    if (req.body.foc_products) req.body.foc_products.forEach(p => productIds.push(p));

    if (productIds.length) {
      const unique = [...new Set(productIds)];
      const [existing] = await db.query(
        `SELECT id FROM products WHERE id IN (?) AND is_active = 1`, [unique]
      );
      const existingIds = new Set(existing.map(r => r.id));
      const missing = unique.filter(pid => !existingIds.has(pid));
      missing.forEach(pid => {
        errors.push({ code: 'INVALID_PRODUCT', message: `Product ${pid} does not exist or is inactive` });
      });
    }

    res.json({ valid: errors.length === 0, errors, warnings });
  } catch (err) { next(err); }
});

/* ================================================================
   POST /api/campaigns/:id/preview  — price impact preview
   ================================================================ */
router.post('/:id/preview', async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { 
      country_id, type, scope = [], 
      discount_rules, product_overrides = [] 
    } = req.body;

    if (!country_id) return res.status(400).json({ error: 'country_id required' });

    // Get currency info for the country
    const [[countryInfo]] = await db.query(
      `SELECT co.*, cu.code AS currency_code, cu.symbol_en, cu.decimal_places
       FROM countries co JOIN currencies cu ON cu.id = co.currency_id WHERE co.id = ?`, [country_id]
    );
    if (!countryInfo) return res.status(404).json({ error: 'Country not found' });

    // Resolve products from provided scope
    let productFilter = '';
    const pParams = [country_id];

    if (scope.some(s => s.scope_type === 'all')) {
      productFilter = '';
    } else {
      const conditions = [];
      const catIds = scope.filter(s => s.scope_type === 'category').map(s => s.scope_ref_id);
      const subIds = scope.filter(s => s.scope_type === 'subcategory').map(s => s.scope_ref_id);
      const prodIds = scope.filter(s => s.scope_type === 'product').map(s => s.scope_ref_id);
      const overrideIds = product_overrides.map(o => o.product_id);

      if (catIds.length) { conditions.push(`p.category_id IN (?)`); pParams.push(catIds); }
      if (subIds.length) { conditions.push(`p.subcategory_id IN (?)`); pParams.push(subIds); }
      if (prodIds.length || overrideIds.length) { 
        const allProdIds = [...new Set([...prodIds, ...overrideIds])];
        conditions.push(`p.id IN (?)`); 
        pParams.push(allProdIds); 
      }

      if (conditions.length) productFilter = `AND (${conditions.join(' OR ')})`;
      else productFilter = `AND 1=0`;
    }

    // Fetch affected products with prices (respecting per-country visibility)
    const [products] = await db.query(
      `SELECT p.id AS product_id, p.name_en, p.name_ar, p.fgd,
              pp.regular_price
       FROM products p
       JOIN product_prices pp ON pp.product_id = p.id AND pp.country_id = ?
       LEFT JOIN product_country pc ON pc.product_id = p.id AND pc.country_id = ?
       WHERE p.is_active = 1 
         AND (pc.is_visible IS NULL OR pc.is_visible = 1)
         ${productFilter}
       ORDER BY p.name_en`, [country_id, country_id, ...pParams.slice(1)]
    );

    if (type !== 'discount') {
      return res.json({
        campaign_id: campaignId,
        country: countryInfo.code,
        currency: { code: countryInfo.currency_code, symbol: countryInfo.symbol_en, decimals: countryInfo.decimal_places },
        affected_products: products,
        summary: { total_products: products.length }
      });
    }

    // Calculate Discounts using provided rules
    const overrideMap = {};
    (product_overrides || []).forEach(o => { overrideMap[o.product_id] = o; });

    const decimals = countryInfo.decimal_places;
    let totalSavings = 0;
    let totalDiscountPct = 0;

    const affected = products.map(p => {
      const override = overrideMap[p.product_id];
      const dType = override ? override.discount_type : discount_rules?.discount_type || 'percentage';
      const dValue = override ? +override.discount_value : +(discount_rules?.discount_value || 0);
      const regular = +p.regular_price;
      const minPrice = +(discount_rules?.min_price || 0);

      let salePrice;
      if (dType === 'percentage') {
        salePrice = regular * (1 - dValue / 100);
      } else {
        salePrice = regular - dValue;
      }
      // Floor
      salePrice = Math.max(salePrice, minPrice);
      salePrice = +salePrice.toFixed(decimals);

      const savings = +(regular - salePrice).toFixed(decimals);
      totalSavings += savings;
      totalDiscountPct += regular > 0 ? (savings / regular * 100) : 0;

      // (Optional) Below cost check removed due to missing column in current schema

      return {
        product_id: p.product_id, name_en: p.name_en, fgd: p.fgd,
        regular_price: regular, discount_type: dType, discount_value: dValue,
        sale_price: salePrice, savings, margin_pct: null, warnings: []
      };
    });

    res.json({
      campaign_id: campaignId,
      country: countryInfo.code,
      currency: { code: countryInfo.currency_code, symbol: countryInfo.symbol_en, decimals },
      affected_products: affected,
      summary: {
        total_products: affected.length,
        avg_discount_pct: affected.length ? +(totalDiscountPct / affected.length).toFixed(1) : 0,
        total_potential_savings: +totalSavings.toFixed(decimals)
      }
    });
  } catch (err) { next(err); }
});

/* ================================================================
   GET /api/campaigns/products/search — search products for selectors
   ================================================================ */
router.get('/products/search', async (req, res, next) => {
  try {
    const { q = '', category_id, subcategory_id, limit = 30 } = req.query;
    const params = [];
    let where = 'WHERE p.is_active = 1';
    if (q) { where += ` AND (p.name_en LIKE ? OR p.fgd LIKE ?)`; params.push(`%${q}%`, `%${q}%`); }
    if (category_id) { where += ` AND p.category_id = ?`; params.push(category_id); }
    if (subcategory_id) { where += ` AND p.subcategory_id = ?`; params.push(subcategory_id); }

    const [rows] = await db.query(
      `SELECT p.id, p.fgd, p.name_en, p.name_ar, c.name_en AS category_name,
              (SELECT url FROM product_media pm WHERE pm.product_id = p.id AND pm.is_primary = 1 LIMIT 1) AS image_url
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.name_en LIMIT ?`, [...params, +limit]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

export default router;
