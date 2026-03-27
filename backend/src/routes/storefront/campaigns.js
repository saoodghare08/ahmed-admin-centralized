import express from 'express';
import db from '../../config/db.js';

const router = express.Router();

/* ================================================================
   GET /api/storefront/campaigns/active?country=AE
   Public endpoint — returns active campaigns for a storefront
   ================================================================ */
router.get('/active', async (req, res, next) => {
  try {
    const { country } = req.query;
    if (!country) return res.status(400).json({ error: 'country query param required' });

    const now = new Date();
    const [campaigns] = await db.query(
      `SELECT c.id, c.name_en, c.name_ar, c.type, c.start_at, c.end_at, c.is_stackable, c.priority
       FROM campaigns c
       JOIN campaign_countries cc ON cc.campaign_id = c.id
       JOIN countries co ON co.id = cc.country_id
       WHERE c.status = 'active'
         AND c.start_at <= ? AND c.end_at >= ?
         AND co.code = ?
       ORDER BY c.priority ASC`, [now, now, country.toUpperCase()]
    );

    res.json({ data: campaigns });
  } catch (err) { next(err); }
});

/* ================================================================
   POST /api/storefront/cart/apply-campaigns
   Evaluate and apply all eligible campaigns to a cart
   ================================================================ */
router.post('/cart/apply-campaigns', async (req, res, next) => {
  try {
    const { country_id, items = [] } = req.body;
    if (!country_id || !items.length) {
      return res.status(400).json({ error: 'country_id and items[] required' });
    }

    const now = new Date();

    // Get currency info
    const [[countryInfo]] = await db.query(
      `SELECT co.*, cu.code AS currency_code, cu.symbol_en, cu.decimal_places
       FROM countries co JOIN currencies cu ON cu.id = co.currency_id WHERE co.id = ?`, [country_id]
    );
    const decimals = countryInfo.decimal_places;

    // Get all active campaigns for this country
    const [campaigns] = await db.query(
      `SELECT c.*
       FROM campaigns c
       JOIN campaign_countries cc ON cc.campaign_id = c.id
       WHERE c.status = 'active'
         AND c.start_at <= ? AND c.end_at >= ?
         AND cc.country_id = ?
       ORDER BY c.priority ASC`, [now, now, country_id]
    );

    // Get product info for all cart items (checking country visibility)
    const productIds = items.map(i => i.product_id);
    const [products] = await db.query(
      `SELECT p.id, p.category_id, p.subcategory_id 
       FROM products p 
       LEFT JOIN product_country pc ON pc.product_id = p.id AND pc.country_id = ?
       WHERE p.id IN (?) AND p.is_active = 1 
         AND (pc.is_visible IS NULL OR pc.is_visible = 1)`,
      [country_id, productIds]
    );
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // Build cart line results
    const lineItems = items.map(i => ({
      product_id: i.product_id,
      qty: i.qty,
      original_price: +i.unit_price,
      sale_price: +i.unit_price,
      line_total: +(i.qty * i.unit_price).toFixed(decimals),
      applied_discounts: []
    }));

    const appliedCampaigns = [];
    const focEligible = [];
    const bxgyApplied = [];
    const appliedNonStackable = new Set(); // track product IDs already hit by non-stackable

    for (const campaign of campaigns) {
      // Load scope
      const [scopes] = await db.query(
        `SELECT * FROM campaign_scope WHERE campaign_id = ?`, [campaign.id]
      );

      // Determine which cart items are in scope
      const inScope = (productId) => {
        const prod = productMap[productId];
        if (!prod) return false;
        if (scopes.some(s => s.scope_type === 'all')) return true;
        if (scopes.some(s => s.scope_type === 'product' && s.scope_ref_id === productId)) return true;
        if (scopes.some(s => s.scope_type === 'category' && s.scope_ref_id === prod.category_id)) return true;
        if (prod.subcategory_id && scopes.some(s => s.scope_type === 'subcategory' && s.scope_ref_id === prod.subcategory_id)) return true;
        return false;
      };

      if (campaign.type === 'discount') {
        const [[rule]] = await db.query(
          `SELECT * FROM campaign_discount_rules WHERE campaign_id = ?`, [campaign.id]
        );
        const [overrides] = await db.query(
          `SELECT * FROM campaign_product_overrides WHERE campaign_id = ?`, [campaign.id]
        );
        const overrideMap = {};
        overrides.forEach(o => { overrideMap[o.product_id] = o; });

        let campaignSavings = 0;
        const campaignLines = [];

        for (const line of lineItems) {
          if (!inScope(line.product_id)) continue;
          if (!campaign.is_stackable && appliedNonStackable.has(line.product_id)) continue;

          const override = overrideMap[line.product_id];
          const dType = override ? override.discount_type : rule.discount_type;
          const dValue = override ? +override.discount_value : +rule.discount_value;

          let newPrice;
          if (dType === 'percentage') {
            newPrice = line.sale_price * (1 - dValue / 100);
          } else {
            newPrice = line.sale_price - dValue;
          }
          newPrice = Math.max(newPrice, +rule.min_price);
          newPrice = +newPrice.toFixed(decimals);

          const lineSavings = +((line.sale_price - newPrice) * line.qty).toFixed(decimals);
          if (lineSavings > 0) {
            line.sale_price = newPrice;
            line.line_total = +(newPrice * line.qty).toFixed(decimals);
            line.applied_discounts.push({ campaign_id: campaign.id, name: campaign.name_en, savings: lineSavings });
            campaignSavings += lineSavings;
            campaignLines.push({ product_id: line.product_id, qty: line.qty, original: line.original_price, sale: newPrice, line_savings: lineSavings });
            if (!campaign.is_stackable) appliedNonStackable.add(line.product_id);
          }
        }

        if (campaignSavings > 0) {
          appliedCampaigns.push({
            campaign_id: campaign.id, name_en: campaign.name_en, type: 'discount',
            savings: +campaignSavings.toFixed(decimals), line_items: campaignLines
          });
        }

      } else if (campaign.type === 'bxgy') {
        const [[rule]] = await db.query(
          `SELECT * FROM campaign_bxgy_rules WHERE campaign_id = ?`, [campaign.id]
        );
        const [bxgyProducts] = await db.query(
          `SELECT * FROM campaign_bxgy_products WHERE campaign_id = ?`, [campaign.id]
        );
        const buyIds = new Set(bxgyProducts.filter(p => p.list_type === 'buy').map(p => p.product_id));
        const getIds = new Set(bxgyProducts.filter(p => p.list_type === 'get').map(p => p.product_id));

        // Count eligible "buy" items
        let buyQty = 0;
        for (const line of lineItems) {
          if (buyIds.has(line.product_id)) buyQty += line.qty;
        }

        const timesEligible = Math.floor(buyQty / rule.buy_qty);
        const repeats = rule.is_repeatable
          ? (rule.max_repeats ? Math.min(timesEligible, rule.max_repeats) : timesEligible)
          : Math.min(timesEligible, 1);

        if (repeats > 0) {
          bxgyApplied.push({
            campaign_id: campaign.id, name_en: campaign.name_en,
            eligible_times: repeats,
            get_qty: rule.get_qty * repeats,
            get_discount_type: rule.get_discount_type,
            get_products: [...getIds]
          });
        }

      } else if (campaign.type === 'foc') {
        const [[rule]] = await db.query(
          `SELECT * FROM campaign_foc_rules WHERE campaign_id = ?`, [campaign.id]
        );
        const [focProducts] = await db.query(
          `SELECT fp.product_id, p.name_en FROM campaign_foc_products fp
           JOIN products p ON p.id = fp.product_id WHERE fp.campaign_id = ?`, [campaign.id]
        );

        const cartTotal = lineItems.reduce((sum, l) => sum + l.line_total, 0);
        const inRange = cartTotal >= +rule.cart_min && (!rule.cart_max || cartTotal <= +rule.cart_max);

        if (inRange) {
          focEligible.push({
            campaign_id: campaign.id, name_en: campaign.name_en,
            selection_mode: rule.selection_mode,
            available_products: focProducts,
            max_selections: rule.max_free_items
          });
        }
      }
    }

    const originalTotal = +items.reduce((s, i) => s + i.qty * i.unit_price, 0).toFixed(decimals);
    const finalTotal = +lineItems.reduce((s, l) => s + l.line_total, 0).toFixed(decimals);
    const discountTotal = +(originalTotal - finalTotal).toFixed(decimals);

    res.json({
      original_total: originalTotal,
      discount_total: discountTotal,
      final_total: finalTotal,
      applied_campaigns: appliedCampaigns,
      foc_eligible: focEligible,
      bxgy_applied: bxgyApplied,
      line_items: lineItems
    });
  } catch (err) { next(err); }
});

export default router;
