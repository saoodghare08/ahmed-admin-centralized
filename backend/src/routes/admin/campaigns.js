import express from 'express';
import db from '../../config/db.js';
import { logAudit } from '../../middleware/auth.js';

const router = express.Router();

/* ================================================================
   GET /api/campaigns - List all campaigns
   ================================================================ */
router.get('/', async (req, res, next) => {
    try {
        const { status, effective_status, type, search, country_id, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
        let where = 'WHERE 1=1';
        const params = [];

        if (status) { where += ' AND c.status = ?'; params.push(status); }
        if (type) { where += ' AND c.type = ?'; params.push(type); }
        if (search) { where += ' AND (c.name_en LIKE ? OR c.name_ar LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        if (country_id) {
            where += ' AND EXISTS (SELECT 1 FROM campaign_countries cc WHERE cc.campaign_id = c.id AND cc.country_id = ?)';
            params.push(country_id);
        }

        const validSortCols = ['name_en', 'start_at', 'end_at', 'priority', 'created_at'];
        const orderCol = validSortCols.includes(sortBy) ? sortBy : 'created_at';
        const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const query = `
            SELECT * FROM (
                SELECT c.*, 
                    CASE 
                        WHEN c.status = 'archived' THEN 'archived'
                        WHEN c.status = 'draft' THEN 'draft'
                        WHEN NOW() < c.start_at THEN 'scheduled'
                        WHEN NOW() > c.end_at THEN 'expired'
                        ELSE 'active'
                    END AS effective_status,
                    (SELECT GROUP_CONCAT(co.code) FROM campaign_countries cc JOIN countries co ON co.id = cc.country_id WHERE cc.campaign_id = c.id) as country_codes
                FROM campaigns c
                ${where}
            ) as sub
            ${effective_status ? 'WHERE effective_status = ?' : ''}
            ORDER BY ${orderCol} ${orderDir}
        `;

        if (effective_status) params.push(effective_status);

        const [rows] = await db.query(query, params);
        res.json({ data: rows });
    } catch (err) { next(err); }
});

/* ================================================================
   GET /api/campaigns/:id - Full details
   ================================================================ */
router.get('/:id', async (req, res, next) => {
    try {
        const id = req.params.id;
        const [[campaign]] = await db.query(
            `SELECT *, 
                CASE 
                    WHEN status = 'archived' THEN 'archived'
                    WHEN status = 'draft' THEN 'draft'
                    WHEN NOW() < start_at THEN 'scheduled'
                    WHEN NOW() > end_at THEN 'expired'
                    ELSE 'active'
                END AS effective_status
             FROM campaigns WHERE id = ?`, [id]
        );
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Countries
        const [countries] = await db.query(
            'SELECT country_id FROM campaign_countries WHERE campaign_id = ?', [id]
        );
        campaign.countries = countries.map(c => c.country_id);

        // Base Discount
        const [[discount]] = await db.query('SELECT * FROM campaign_discounts WHERE campaign_id = ?', [id]);
        campaign.base_discount = discount || null;

        // Items (Overrides/Selection)
        const [items] = await db.query(
            `SELECT ci.*, p.name_en as product_name, p.fgd as product_fgd 
             FROM campaign_items ci 
             JOIN products p ON p.id = ci.product_id 
             WHERE ci.campaign_id = ?`, [id]
        );
        campaign.items = items;

        res.json({ data: campaign });
    } catch (err) { next(err); }
});

/* ================================================================
   POST /api/campaigns - Create a new campaign
   ================================================================ */
router.post('/', async (req, res, next) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const {
            name_en, name_ar, type = 'discount', start_at, end_at, 
            is_all_products = 0, is_stackable = 0, priority = 100, notes,
            countries = [], base_discount, items = []
        } = req.body;

        // Status logic
        const now = new Date();
        const start = new Date(start_at);
        let status = 'draft';
        if (req.body.activate) {
            status = start <= now ? 'active' : 'scheduled';
        }

        const [result] = await conn.query(
            `INSERT INTO campaigns (name_en, name_ar, type, status, priority, start_at, end_at, is_all_products, is_stackable, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name_en, name_ar, type, status, priority, start_at, end_at, is_all_products ? 1 : 0, is_stackable ? 1 : 0, notes]
        );
        const campaignId = result.insertId;

        // Countries
        if (countries.length) {
            const cVals = countries.map(cid => [campaignId, cid]);
            await conn.query('INSERT INTO campaign_countries (campaign_id, country_id) VALUES ?', [cVals]);
        }

        // Base Discount
        if (base_discount) {
            await conn.query(
                'INSERT INTO campaign_discounts (campaign_id, discount_type, discount_value, min_price_floor) VALUES (?, ?, ?, ?)',
                [campaignId, base_discount.discount_type, base_discount.discount_value, base_discount.min_price_floor || 0]
            );
        }

        // Items
        if (items.length) {
            const iVals = items.map(it => [
                campaignId, it.product_id, it.discount_type || null, it.discount_value ?? null, it.is_excluded ? 1 : 0
            ]);
            await conn.query(
                'INSERT INTO campaign_items (campaign_id, product_id, discount_type, discount_value, is_excluded) VALUES ?',
                [iVals]
            );
        }

        await conn.commit();
        
        await logAudit(req, 'create', 'campaigns', campaignId, {
            name_en, name_ar, type, start_at, end_at, is_all_products
        });

        res.status(201).json({ id: campaignId, message: 'Campaign created' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

/* ================================================================
   PUT /api/campaigns/:id - Update existing campaign
   ================================================================ */
router.put('/:id', async (req, res, next) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const id = req.params.id;
        const {
            name_en, name_ar, type, start_at, end_at, 
            is_all_products, is_stackable, priority, notes,
            countries = [], base_discount, items = []
        } = req.body;

        await conn.query(
            `UPDATE campaigns SET name_en=?, name_ar=?, type=?, priority=?, start_at=?, end_at=?, 
             is_all_products=?, is_stackable=?, notes=?, updated_at=NOW() WHERE id=?`,
            [name_en, name_ar, type, priority, start_at, end_at, is_all_products ? 1 : 0, is_stackable ? 1 : 0, notes, id]
        );

        // Countries
        await conn.query('DELETE FROM campaign_countries WHERE campaign_id = ?', [id]);
        if (countries.length) {
            const cVals = countries.map(cid => [id, cid]);
            await conn.query('INSERT INTO campaign_countries (campaign_id, country_id) VALUES ?', [cVals]);
        }

        // Base Discount
        await conn.query('DELETE FROM campaign_discounts WHERE campaign_id = ?', [id]);
        if (base_discount) {
            await conn.query(
                'INSERT INTO campaign_discounts (campaign_id, discount_type, discount_value, min_price_floor) VALUES (?, ?, ?, ?)',
                [id, base_discount.discount_type, base_discount.discount_value, base_discount.min_price_floor || 0]
            );
        }

        // Items
        await conn.query('DELETE FROM campaign_items WHERE campaign_id = ?', [id]);
        if (items.length) {
            const iVals = items.map(it => [
                id, it.product_id, it.discount_type || null, it.discount_value ?? null, it.is_excluded ? 1 : 0
            ]);
            await conn.query(
                'INSERT INTO campaign_items (campaign_id, product_id, discount_type, discount_value, is_excluded) VALUES ?',
                [iVals]
            );
        }

        await conn.commit();

        await logAudit(req, 'update', 'campaigns', id, {
            name_en, name_ar, type, start_at, end_at, is_all_products
        });

        res.json({ message: 'Campaign updated' });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

/* ================================================================
   DELETE /api/campaigns/:id
   ================================================================ */
router.delete('/:id', async (req, res, next) => {
    try {
        const id = req.params.id;
        await db.query('UPDATE campaigns SET status = "archived" WHERE id = ?', [id]);
        
        await logAudit(req, 'delete', 'campaigns', id, { action: 'archived' });

        res.json({ message: 'Campaign archived' });
    } catch (err) { next(err); }
});

/* ================================================================
   GET /api/campaigns/products/search - Unified Search with Active Check
   ================================================================ */
router.get('/products/search', async (req, res, next) => {
    try {
        const { q = '', limit = 30 } = req.query;
        const params = [];
        let where = 'WHERE p.is_active = 1';
        if (q) {
            where += ' AND (p.name_en LIKE ? OR p.fgd LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }

        const query = `
            SELECT p.id, p.fgd, p.name_en, p.name_ar,
                   (SELECT c.name_en FROM campaigns c 
                    JOIN campaign_items ci ON ci.campaign_id = c.id 
                    WHERE ci.product_id = p.id AND c.status IN ('active', 'scheduled') 
                    LIMIT 1) as active_campaign_name
            FROM products p
            ${where}
            ORDER BY p.name_en LIMIT ?`;

        const [rows] = await db.query(query, [...params, parseInt(limit)]);
        res.json({ data: rows });
    } catch (err) { next(err); }
});

/* ================================================================
   POST /api/campaigns/preview - Price impact preview
   ================================================================ */
router.post('/preview', async (req, res, next) => {
    try {
        const {
            countries = [], is_all_products = 0, base_discount, items = []
        } = req.body;

        if (!countries.length) return res.json({ data: [] });

        let productsQuery;
        let productsParams = [];

        if (is_all_products) {
            productsQuery = `SELECT id, name_en, name_ar, fgd FROM products WHERE is_active = 1`;
        } else {
            if (!items.length) return res.json({ data: [] });
            productsQuery = `SELECT id, name_en, name_ar, fgd FROM products WHERE id IN (?)`;
            productsParams.push(items.map(i => i.product_id));
        }

        const [products] = await db.query(productsQuery, productsParams);
        const productIds = products.map(p => p.id);

        // Fetch Prices
        const [prices] = await db.query(
            `SELECT pp.*, co.code as country_code, cu.symbol_en as currency_symbol
             FROM product_prices pp 
             JOIN countries co ON co.id = pp.country_id 
             JOIN currencies cu ON cu.id = pp.currency_id
             WHERE pp.product_id IN (?) AND pp.country_id IN (?)`,
            [productIds, countries]
        );

        // Build result map
        const itemMap = new Map(items.map(i => [i.product_id, i]));
        
        const preview = prices.map(p => {
            const product = products.find(prod => prod.id === p.product_id);
            const override = itemMap.get(p.product_id);
            
            let discType = null;
            let discVal = 0;
            let isExcluded = false;

            if (is_all_products) {
                // Default: Base Rule
                discType = base_discount?.discount_type;
                discVal = base_discount?.discount_value || 0;

                // Check for item override/exclusion
                if (override) {
                    if (override.is_excluded) isExcluded = true;
                    else if (override.discount_type) {
                        discType = override.discount_type;
                        discVal = override.discount_value;
                    }
                }
            } else {
                // Individual Mode: Item must exist in list
                if (override) {
                    if (override.is_excluded) isExcluded = true;
                    else {
                        discType = override.discount_type || base_discount?.discount_type;
                        discVal = override.discount_value ?? base_discount?.discount_value ?? 0;
                    }
                } else {
                    isExcluded = true; // Not selected
                }
            }

            let discountedPrice = p.regular_price;
            if (!isExcluded && discVal > 0) {
                if (discType === 'percentage') {
                    discountedPrice = p.regular_price * (1 - discVal / 100);
                } else {
                    discountedPrice = Math.max(0, p.regular_price - discVal);
                }
            }

            return {
                product_id: p.product_id,
                product_name: product?.name_en,
                fgd: product?.fgd,
                country_code: p.country_code,
                currency_symbol: p.currency_symbol,
                original_price: p.regular_price,
                discounted_price: discountedPrice,
                discount_label: isExcluded ? 'None' : (discType === 'percentage' ? `${discVal}%` : `-${discVal}`),
                is_excluded: isExcluded
            };
        });

        res.json({ data: preview });
    } catch (err) { next(err); }
});

export default router;
