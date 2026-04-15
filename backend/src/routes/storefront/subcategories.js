import express from 'express';
import db from '../../config/db.js';

const router = express.Router();

// ── GET /api/storefront/subcategories/:idOrSlug ────────────────────
router.get('/:idOrSlug', async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const { country = 'AE' } = req.query;

    // 1. Resolve Subcategory
    let subcategory;
    const countryCode = country.toUpperCase();

    if (!isNaN(idOrSlug)) {
      const [[row]] = await db.query('SELECT * FROM subcategories WHERE id = ? AND is_active = 1 AND deleted_status = "active"', [idOrSlug]);
      subcategory = row;
    } else {
      const [[row]] = await db.query('SELECT * FROM subcategories WHERE slug = ? AND is_active = 1 AND deleted_status = "active"', [idOrSlug]);
      subcategory = row;
    }

    if (!subcategory) return res.status(404).json({ error: 'Subcategory not found' });

    // 2. Fetch Products
    const [products] = await db.query(
      `SELECT p.*,
              pp.regular_price, cu.decimal_places, cu.code AS currency_code,
              lb.name_en AS label_name, lb.image_url AS label_image
       FROM products p
       LEFT JOIN product_prices pp ON pp.product_id = p.id 
         AND pp.country_id = (SELECT id FROM countries WHERE code = ?)
       LEFT JOIN currencies cu ON cu.id = pp.currency_id
       LEFT JOIN product_labels lb ON lb.id = p.label_id
       JOIN product_country pc ON pc.product_id = p.id AND pc.country_id = (SELECT id FROM countries WHERE code = ?)
       WHERE p.subcategory_id = ? AND p.is_active = 1 AND p.deleted_status = 'active' AND pc.is_visible = 1
       ORDER BY p.id DESC`,
      [countryCode, countryCode, subcategory.id]
    );

    const enrichedProducts = [];

    for (const p of products) {
      const productId = p.id;

      // Media
      const [mediaRows] = await db.query(
        `SELECT url, media_type, is_primary FROM product_media WHERE product_id = ? ORDER BY sort_order`,
        [productId]
      );
      const primaryImage = mediaRows.find(m => m.is_primary && m.media_type === 'image')?.url || null;
      const imagesArray = mediaRows.filter(m => m.media_type === 'image').map(m => m.url);

      // Stock
      const [[stockRow]] = await db.query(
        `SELECT quantity FROM product_stock WHERE product_id = ? AND country_id = (SELECT id FROM countries WHERE code = ?)`,
        [productId, countryCode]
      );

      // Sales
      const [[salesRow]] = await db.query(
        `SELECT SUM(qty_sold) as total_sales FROM product_sales_log WHERE product_id = ?`,
        [productId]
      );

      // Campaigns / Discount
      const [campaigns] = await db.query(
        `SELECT c.*, cd.discount_type AS base_type, cd.discount_value AS base_value,
                ci.discount_type AS item_type, ci.discount_value AS item_value, ci.is_excluded
         FROM campaigns c
         JOIN campaign_countries cc ON cc.campaign_id = c.id
         LEFT JOIN campaign_discounts cd ON cd.campaign_id = c.id
         LEFT JOIN campaign_items ci ON ci.campaign_id = c.id AND ci.product_id = ?
         WHERE cc.country_id = (SELECT id FROM countries WHERE code = ?)
           AND c.status = 'active'
           AND NOW() BETWEEN c.start_at AND c.end_at
           AND (c.is_all_products = 1 OR ci.id IS NOT NULL)
           AND (ci.is_excluded IS NULL OR ci.is_excluded = 0)
         ORDER BY c.priority DESC, c.id DESC LIMIT 1`,
        [productId, countryCode]
      );

      let discountObj = null;
      let finalPriceValue = p.regular_price ? parseFloat(p.regular_price) : null;

      if (campaigns.length > 0) {
        const camp = campaigns[0];
        const dtype = camp.item_type || camp.base_type;
        const dval = camp.item_value !== null ? camp.item_value : camp.base_value;
        const regPrice = parseFloat(p.regular_price || 0);

        if (dval !== null && regPrice > 0) {
          let discountAmount = 0;
          if (dtype === 'percentage') {
            discountAmount = (regPrice * parseFloat(dval)) / 100;
          } else {
            discountAmount = parseFloat(dval);
          }

          finalPriceValue = regPrice - discountAmount;
          discountObj = {
            value: parseFloat(dval),
            apply_to: camp.is_all_products ? "group" : "individual",
            discount_type: dtype === 'percentage' ? "percent" : "amount",
            product_price: regPrice.toFixed(p.decimal_places || 2),
            discount_amount: discountAmount.toFixed(p.decimal_places || 2),
            final_price: finalPriceValue.toFixed(p.decimal_places || 2),
            start_date: camp.start_at,
            end_date: camp.end_at
          };
        }
      }

      // Format tags
      let productTags = [];
      try {
        productTags = typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []);
      } catch (e) {
        productTags = typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      }

      enrichedProducts.push({
        price: p.regular_price ? parseFloat(p.regular_price).toFixed(p.decimal_places || 2) : null,
        product_id: p.id,
        product_name: p.name_en,
        image: primaryImage,
        images: JSON.stringify(imagesArray),
        product_qty: stockRow ? stockRow.quantity : 0,
        sale_price: (discountObj && finalPriceValue) ? finalPriceValue.toFixed(p.decimal_places || 2) : null,
        product_name_ar: p.name_ar,
        maximum_order_quantity: p.maximum_order_quantity || 0,
        labels: p.label_name ? [{ label_name: p.label_name, label_color: p.label_image }] : [],
        tags: productTags,
        permalink: { key: p.slug },
        sales: parseInt(salesRow?.total_sales || 0),
        discount: discountObj,
        coupon: []
      });
    }

    res.json({
      id: subcategory.id,
      name: subcategory.name_en,
      image: subcategory.image_url,
      mobile_image: subcategory.mobile_image,
      description: subcategory.description_en || "",
      description_ar: subcategory.description_ar || "",
      products: enrichedProducts
    });

  } catch (err) {
    next(err);
  }
});

export default router;
