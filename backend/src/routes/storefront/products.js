import express from 'express';
import db from '../../config/db.js';

const router = express.Router();

// ── GET /api/storefront/products/:idOrSlug ────────────────────
router.get('/:idOrSlug', async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const { country = 'AE' } = req.query;

    // 1. Resolve Product ID
    let productId;
    if (!isNaN(idOrSlug)) {
      productId = parseInt(idOrSlug);
    } else {
      const [[slugRow]] = await db.query('SELECT id FROM products WHERE slug = ?', [idOrSlug]);
      if (!slugRow) return res.status(404).json({ error: 'Product not found' });
      productId = slugRow.id;
    }

    // 2. Fetch Base Product Info & Country Pricing
    const [[product]] = await db.query(
      `SELECT p.*, 
              c.name_en AS fragrance_category, 
              sz.label_en AS size_label_en,
              lb.name_en AS label_name, lb.image_url AS label_image,
              pp.regular_price, 
              cu.decimal_places, cu.code AS currency_code
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_sizes sz ON sz.id = p.size_id
       LEFT JOIN product_labels lb ON lb.id = p.label_id
       LEFT JOIN product_prices pp ON pp.product_id = p.id
         AND pp.country_id = (SELECT id FROM countries WHERE code = ?)
       LEFT JOIN currencies cu ON cu.id = pp.currency_id
       WHERE p.id = ? AND p.deleted_status = 'active' AND p.is_active = 1`,
      [country.toUpperCase(), productId]
    );

    if (!product) return res.status(404).json({ error: 'Product not found' });

    // 3. Media (Primary, Images, Video)
    const [mediaRows] = await db.query(
      `SELECT url, media_type, is_primary FROM product_media WHERE product_id = ? ORDER BY sort_order`,
      [productId]
    );
    const primaryImage = mediaRows.find(m => m.is_primary && m.media_type === 'image')?.url || null;
    const imagesArray = mediaRows.filter(m => m.media_type === 'image').map(m => m.url);
    const videoArray = mediaRows.filter(m => m.media_type === 'video').map(m => m.url);

    // 4. Stock
    const [[stockRow]] = await db.query(
      `SELECT quantity FROM product_stock WHERE product_id = ? AND country_id = (SELECT id FROM countries WHERE code = ?)`,
      [productId, country.toUpperCase()]
    );

    // 5. Notes (Top, Heart, Base)
    const [notesRows] = await db.query(
      `SELECT * FROM fragrance_notes WHERE product_id = ?`,
      [productId]
    );

    const getNote = (type) => {
      const n = notesRows.find(r => r.note_type === type) || {};
      let ingredientsEn = [], ingredientsAr = [];
      try { ingredientsEn = typeof n.ingredients_en === 'string' ? JSON.parse(n.ingredients_en) : (n.ingredients_en || []); } catch (e) { }
      try { ingredientsAr = typeof n.ingredients_ar === 'string' ? JSON.parse(n.ingredients_ar) : (n.ingredients_ar || []); } catch (e) { }

      return {
        name: Array.isArray(ingredientsEn) ? ingredientsEn.join(', ') : '',
        name_ar: Array.isArray(ingredientsAr) ? ingredientsAr.join(', ') : '',
        image: n.image_url || null,
        description: n.description_en || null,
        description_ar: n.description_ar || null
      };
    };

    const topNote = getNote('top');
    const heartNote = getNote('heart');
    const baseNote = getNote('base');

    // 6. Attributes & Tags
    let attributes = {};
    try { attributes = typeof product.attributes === 'string' ? JSON.parse(product.attributes) : (product.attributes || {}); } catch (e) { }

    let dbTags = [];
    try { dbTags = typeof product.tags === 'string' ? JSON.parse(product.tags) : (product.tags || []); } catch (e) { }

    let sizeTags = [];
    if (product.size_label_en) {
      sizeTags.push(product.size_label_en.toLowerCase());
    }

    // 7. Bundle / Collection Logic
    const [[bundleRow]] = await db.query('SELECT id FROM bundles WHERE product_id = ?', [productId]);
    const isCollection = bundleRow ? 1 : 0;
    let collectionItems = [];
    if (isCollection) {
      const [items] = await db.query(
        `SELECT bi.product_id AS child_product_id, 
                    COALESCE(p.name_en, bi.component_name_en) AS name, 
                    COALESCE(p.name_ar, bi.component_name_ar) AS name_ar,
                    COALESCE(pm.url, bi.component_image_url) AS image
             FROM bundle_items bi
             LEFT JOIN products p ON p.id = bi.product_id
             LEFT JOIN product_media pm ON pm.product_id = p.id AND pm.is_primary = 1
             WHERE bi.bundle_id = ?
             ORDER BY bi.sort_order`,
        [bundleRow.id]
      );
      collectionItems = items;
    }

    // 8. Discount / Campaign Logic
    // Find active campaigns for this country and product
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
      [productId, country.toUpperCase()]
    );

    let discountObj = null;
    if (campaigns.length > 0) {
      const camp = campaigns[0];
      const dtype = camp.item_type || camp.base_type; // item level override takes priority
      const dval = camp.item_value !== null ? camp.item_value : camp.base_value;
      const regPrice = parseFloat(product.regular_price || 0);

      if (dval !== null && regPrice > 0) {
        let discountAmount = 0;
        if (dtype === 'percentage') {
          discountAmount = (regPrice * parseFloat(dval)) / 100;
        } else {
          discountAmount = parseFloat(dval);
        }

        discountObj = {
          value: parseFloat(dval),
          apply_to: camp.is_all_products ? "group" : "individual",
          discount_type: dtype === 'percentage' ? "percent" : "amount",
          product_price: regPrice.toFixed(product.decimal_places || 2),
          discount_amount: discountAmount.toFixed(product.decimal_places || 2),
          final_price: (regPrice - discountAmount).toFixed(product.decimal_places || 2),
          start_date: camp.start_at,
          end_date: camp.end_at
        };
      }
    }

    // 8.5 Related Products
    let relatedProductIds = [];
    const [manualRelated] = await db.query(
      `SELECT related_product_id FROM related_products WHERE product_id = ? ORDER BY sort_order LIMIT 4`,
      [productId]
    );

    if (manualRelated.length > 0) {
      relatedProductIds = manualRelated.map(r => r.related_product_id);
    } else if (product.category_id) {
      // Fallback
      const [randomRelated] = await db.query(
        `SELECT p.id FROM products p 
         JOIN product_country pc ON pc.product_id = p.id AND pc.country_id = (SELECT id FROM countries WHERE code = ?)
         WHERE p.category_id = ? AND p.id != ? AND p.deleted_status = 'active' AND p.is_active = 1 AND pc.is_visible = 1
         ORDER BY RAND() LIMIT 4`,
        [country.toUpperCase(), product.category_id, productId]
      );
      relatedProductIds = randomRelated.map(r => r.id);
    }

    let relatedProds = [];
    if (relatedProductIds.length > 0) {
      const [rpRows] = await db.query(
        `SELECT p.*,
                c.name_en AS category_name,
                sz.label_en AS size_label_en,
                lb.name_en AS label_name, lb.image_url AS label_image,
                pp.regular_price, cu.decimal_places,
                sc.name_en AS subcategory_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
         LEFT JOIN product_sizes sz ON sz.id = p.size_id
         LEFT JOIN product_labels lb ON lb.id = p.label_id
         LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.country_id = (SELECT id FROM countries WHERE code = ?)
         LEFT JOIN currencies cu ON cu.id = pp.currency_id
         WHERE p.id IN (?)`,
        [country.toUpperCase(), relatedProductIds]
      );
      console.log(rpRows[0].label_name)

      // Re-order to match standard (or random) order if possible. Wait, IN (?) does not guarantee order.
      // We will loop through relatedProductIds to preserve order fetched.
      for (const rpid of relatedProductIds) {
        const rpConfig = rpRows.find(x => x.id === rpid);
        if (!rpConfig) continue;

        // Fetch media
        const [rpMedia] = await db.query(
          `SELECT url, media_type, is_primary FROM product_media WHERE product_id = ? ORDER BY sort_order`,
          [rpid]
        );
        const rpPrimaryImage = rpMedia.find(m => m.is_primary && m.media_type === 'image')?.url || null;
        const rpImagesArray = rpMedia.filter(m => m.media_type === 'image').map(m => m.url);

        // Fetch stock
        const [[rpStockRow]] = await db.query(
          `SELECT quantity FROM product_stock WHERE product_id = ? AND country_id = (SELECT id FROM countries WHERE code = ?)`,
          [rpid, country.toUpperCase()]
        );

        // Fetch discount
        const [rpCampaigns] = await db.query(
          `SELECT c.*, cd.discount_type AS base_type, cd.discount_value AS base_value,
                  ci.discount_type AS item_type, ci.discount_value AS item_value, ci.is_excluded
           FROM campaigns c
           JOIN campaign_countries cc ON cc.campaign_id = c.id
           LEFT JOIN campaign_discounts cd ON cd.campaign_id = c.id
           LEFT JOIN campaign_items ci ON ci.campaign_id = c.id AND ci.product_id = ?
           WHERE cc.country_id = (SELECT id FROM countries WHERE code = ?)
             AND c.status = 'active' AND NOW() BETWEEN c.start_at AND c.end_at
             AND (c.is_all_products = 1 OR ci.id IS NOT NULL)
             AND (ci.is_excluded IS NULL OR ci.is_excluded = 0)
           ORDER BY c.priority DESC, c.id DESC LIMIT 1`,
          [rpid, country.toUpperCase()]
        );

        let rpDiscountObj = null;
        if (rpCampaigns.length > 0) {
          const camp = rpCampaigns[0];
          const dtype = camp.item_type || camp.base_type;
          const dval = camp.item_value !== null ? camp.item_value : camp.base_value;
          const regPrice = parseFloat(rpConfig.regular_price || 0);

          if (dval !== null && regPrice > 0) {
            let discountAmount = dtype === 'percentage' ? (regPrice * parseFloat(dval)) / 100 : parseFloat(dval);
            rpDiscountObj = {
              value: parseFloat(dval),
              apply_to: camp.is_all_products ? "group" : "individual",
              discount_type: dtype === 'percentage' ? "percent" : "amount",
              product_price: regPrice.toFixed(rpConfig.decimal_places || 2),
              discount_amount: discountAmount.toFixed(rpConfig.decimal_places || 2),
              final_price: (regPrice - discountAmount).toFixed(rpConfig.decimal_places || 2),
              start_date: camp.start_at,
              end_date: camp.end_at
            };
          }
        }

        let rpTags = [];
        try { rpTags = typeof rpConfig.size_label_en === 'string' ? JSON.parse(rpConfig.size_label_en) : (rpConfig.size_label_en || []); } catch (e) { }
        if (rpConfig.size_label_en && !rpTags.includes(rpConfig.size_label_en.toLowerCase())) {
          rpTags.push(rpConfig.size_label_en.toLowerCase());
        }


        relatedProds.push({
          price: rpConfig.regular_price ? parseFloat(rpConfig.regular_price).toFixed(rpConfig.decimal_places || 2) : null,
          product_id: rpConfig.id,
          product_name: rpConfig.name_en,
          category_name: rpConfig.category_name,
          image: rpPrimaryImage,
          images: JSON.stringify(rpImagesArray),
          collection_name: null,
          description: rpConfig.description_en,
          product_qty: rpStockRow ? rpStockRow.quantity : 0,
          label_name: rpConfig.label_name || null,
          label_color: rpConfig.label_image || null,
          sale_price: rpDiscountObj?.final_price || null,
          maximum_order_quantity: rpConfig.maximum_order_quantity || 0,
          labels: rpConfig.label_name ? [{ label_name: rpConfig.label_name, label_color: rpConfig.label_image }] : [],
          tags: rpTags,
          subcategory: rpConfig.subcategory_name ? { subcategory_name: rpConfig.subcategory_name } : null,
          discount: rpDiscountObj,
          coupon: []
        });
      }
    }

    // 9. Format Final Response
    const response = {
      price: product.regular_price ? parseFloat(product.regular_price).toFixed(product.decimal_places || 2) : null,
      product_id: product.id,
      product_name_ar: product.name_ar,
      product_name: product.name_en,
      image: primaryImage,
      images: JSON.stringify(imagesArray),
      description: product.description_en,
      description_ar: product.description_ar,
      product_qty: stockRow ? stockRow.quantity : 0,
      video: JSON.stringify(videoArray),
      sku: product.fgd, // In the database we use 'fgd' as SKU
      tags: sizeTags,
      meta: dbTags,
      labels: product.label_name ? [
        {
          label_name: product.label_name,
          label_color: product.label_image
        }
      ] : [],
      attributes: attributes,
      // sillage: attributes.Sillage || attributes.sillage || null,
      // longevity: attributes.Longevity || attributes.longevity || null,
      // how_to_use: attributes['How to Use'] || attributes.how_to_use || "",
      // occasion: attributes.Occasion || attributes.occasion || "",
      // ingredients: attributes.Ingredients || attributes.ingredients || "",
      // olfactory_family: attributes['Olfactory Family'] || attributes.olfactory_family || null,
      // fragrance_type: attributes['Fragrance Type'] || attributes.fragrance_type || null,
      // fragrance_category: product.fragrance_category,
      // dispenser_type: attributes['Dispenser Type'] || attributes.dispenser_type || null,
      // additional_details: attributes['Additional Details'] || attributes.additional_details || null,
      is_collection: isCollection,
      base_note_description: baseNote.description,
      base_note_description_ar: baseNote.description_ar,
      maximum_order_quantity: product.maximum_order_quantity || 0,
      discount: discountObj,
      related_prods: relatedProds
    };

    res.json(response);

  } catch (err) {
    next(err);
  }
});

export default router;
