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
              pp.regular_price, 
              cu.decimal_places, cu.code AS currency_code
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
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
        try { ingredientsEn = typeof n.ingredients_en === 'string' ? JSON.parse(n.ingredients_en) : (n.ingredients_en || []); } catch(e){}
        try { ingredientsAr = typeof n.ingredients_ar === 'string' ? JSON.parse(n.ingredients_ar) : (n.ingredients_ar || []); } catch(e){}
        
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

    // 6. Attributes
    let attributes = {};
    try { attributes = typeof product.attributes === 'string' ? JSON.parse(product.attributes) : (product.attributes || {}); } catch(e){}

    // 7. Bundle / Collection Logic
    const [[bundleRow]] = await db.query('SELECT id FROM bundles WHERE product_id = ?', [productId]);
    const isCollection = bundleRow ? 1 : 0;
    let collectionItems = [];
    if (isCollection) {
        const [items] = await db.query(
            `SELECT bi.product_id AS child_product_id, 
                    p.name_en AS name, p.name_ar AS name_ar,
                    pm.url AS image
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
        sillage: attributes.Sillage || attributes.sillage || null,
        longevity: attributes.Longevity || attributes.longevity || null,
        how_to_use: attributes['How to Use'] || attributes.how_to_use || "",
        occasion: attributes.Occasion || attributes.occasion || "",
        ingredients: attributes.Ingredients || attributes.ingredients || "",
        olfactory_family: attributes['Olfactory Family'] || attributes.olfactory_family || null,
        fragrance_type: attributes['Fragrance Type'] || attributes.fragrance_type || null,
        fragrance_category: product.fragrance_category,
        dispenser_type: attributes['Dispenser Type'] || attributes.dispenser_type || null,
        additional_details: attributes['Additional Details'] || attributes.additional_details || null,
        is_collection: isCollection,
        maximum_order_quantity: 0,
        collection_items: collectionItems.map(item => ({
            name: item.name,
            name_ar: item.name_ar,
            image: item.image
        })),
        top_note: topNote.name,
        top_note_ar: topNote.name_ar,
        top_note_image: topNote.image,
        top_note_description: topNote.description,
        top_note_description_ar: topNote.description_ar,
        heart_note: heartNote.name,
        heart_note_ar: heartNote.name_ar,
        heart_note_image: heartNote.image,
        heart_note_description: heartNote.description,
        heart_note_description_ar: heartNote.description_ar,
        base_note: baseNote.name,
        base_note_ar: baseNote.name_ar,
        base_note_image: baseNote.image,
        base_note_description: baseNote.description,
        base_note_description_ar: baseNote.description_ar,
        discount: discountObj
    };

    res.json(response);

  } catch (err) {
    next(err);
  }
});

export default router;
