import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import db from '../config/db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Country map ───────────────────────────────────────────────
const COUNTRIES = [
  { id: 1, code: 'AE', currency_id: 1 },
  { id: 2, code: 'SA', currency_id: 2 },
  { id: 3, code: 'QA', currency_id: 3 },
  { id: 4, code: 'BH', currency_id: 4 },
  { id: 5, code: 'KW', currency_id: 5 },
  { id: 6, code: 'OM', currency_id: 6 },
];

// ── Helpers ───────────────────────────────────────────────────
const toSlug = (str) =>
  String(str).toLowerCase().trim()
    .replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/--+/g, '-');

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const flag = (v, def = 1) => (v === '' || v === null || v === undefined ? def : Number(v) ? 1 : 0);

/** Parse "Key=Value;Key2=Value2" → { Key: 'Value', Key2: 'Value2' } */
function parseAttributes(raw) {
  if (!str(raw)) return null;
  const obj = {};
  str(raw).split(';').forEach((pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 1) return;
    const k = pair.slice(0, eqIdx).trim();
    const v = pair.slice(eqIdx + 1).trim();
    if (k) obj[k] = v;
  });
  return Object.keys(obj).length ? obj : null;
}

// ── GET /api/import/template ─────────────────────────────────
router.get('/template', (_req, res) => {
  const headers = [
    // Core
    'fgd', 'barcode', 'slug', 'name_en', 'name_ar', 'description_en', 'description_ar',
    'category', 'subcategory', 'size_label_en', 'size_label_ar',
    'tags', 'attributes', 'is_active', 'is_featured',
    // Pricing
    'price_AE', 'price_SA', 'price_QA', 'price_BH', 'price_KW', 'price_OM',
    // Visibility
    'visible_AE', 'visible_SA', 'visible_QA', 'visible_BH', 'visible_KW', 'visible_OM',
    // Images
    'image_1', 'image_2', 'image_3',
    // Notes — Top
    'notes_top_ingd_en', 'notes_top_ingd_ar', 'notes_top_desc_en', 'notes_top_desc_ar', 'notes_top_image',
    // Notes — Heart
    'notes_heart_ingd_en', 'notes_heart_ingd_ar', 'notes_heart_desc_en', 'notes_heart_desc_ar', 'notes_heart_image',
    // Notes — Base
    'notes_base_ingd_en', 'notes_base_ingd_ar', 'notes_base_desc_en', 'notes_base_desc_ar', 'notes_base_image',
  ];

  // Example row so users see the expected format
  const exampleRow = {
    fgd: 'FGD-1001', barcode: 'FGD-1001', slug: '', name_en: 'Example Perfume', name_ar: 'مثال عطر',
    description_en: 'A rich oud fragrance', description_ar: 'عطر عود غني',
    category: 'Perfumes', subcategory: 'Oud',
    size_label_en: '50ML', size_label_ar: '٥٠ مل',
    tags: 'oud,woody,luxury', attributes: 'Gender=Unisex;Origin=Morocco',
    is_active: 1, is_featured: 0,
    price_AE: 299, price_SA: 299, price_QA: 0, price_BH: 0, price_KW: 0, price_OM: 0,
    visible_AE: 1, visible_SA: 1, visible_QA: 1, visible_BH: 1, visible_KW: 1, visible_OM: 1,
    image_1: '/gallery/products/example.jpg', image_2: '', image_3: '',
    notes_top_ingd_en: 'Bergamot,Lemon', notes_top_ingd_ar: 'برغموت,ليمون',
    notes_top_desc_en: 'Fresh citrus opening', notes_top_desc_ar: 'افتتاح حمضي منعش', notes_top_image: '',
    notes_heart_ingd_en: 'Rose,Jasmine', notes_heart_ingd_ar: 'ورد,ياسمين',
    notes_heart_desc_en: 'Floral heart', notes_heart_desc_ar: 'قلب زهري', notes_heart_image: '',
    notes_base_ingd_en: 'Oud,Amber', notes_base_ingd_ar: 'عود,عنبر',
    notes_base_desc_en: 'Woody base', notes_base_desc_ar: 'قاعدة خشبية', notes_base_image: '',
  };

  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
  // Style the header row width hints
  ws['!cols'] = headers.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="products_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ── POST /api/import/products ─────────────────────────────────
router.post('/products', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const dryRun = req.query.dry_run === 'true';

    // Parse xlsx
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return res.status(400).json({ error: 'Excel file is empty' });

    // Pre-load categories + subcategories
    const [cats] = await db.query(`SELECT id, name_en FROM categories`);
    const [subs] = await db.query(`SELECT id, name_en, category_id FROM subcategories`);

    // Pre-load existing FGD codes to check duplicates
    const [existingFgds] = await db.query(`SELECT fgd FROM products`);
    const fgdSet = new Set(existingFgds.map((r) => r.fgd.trim().toUpperCase()));

    const results = [];
    let inserted = 0, skipped = 0, errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)
      const fgd = str(row.fgd).toUpperCase();

      // ── Validate required ──────────────────────────────────
      const missingFields = [];
      if (!fgd) missingFields.push('fgd');
      if (!str(row.name_en)) missingFields.push('name_en');
      if (!str(row.category)) missingFields.push('category');

      if (missingFields.length) {
        results.push({ row: rowNum, fgd: fgd || '—', name_en: str(row.name_en), status: 'error', reason: `Missing: ${missingFields.join(', ')}` });
        errors++;
        continue;
      }

      // ── Duplicate check ────────────────────────────────────
      if (fgdSet.has(fgd)) {
        results.push({ row: rowNum, fgd, name_en: str(row.name_en), status: 'skip', reason: 'Duplicate FGD' });
        skipped++;
        continue;
      }

      // ── Resolve category ───────────────────────────────────
      const cat = cats.find((c) => c.name_en.trim().toLowerCase() === str(row.category).toLowerCase());
      if (!cat) {
        results.push({ row: rowNum, fgd, name_en: str(row.name_en), status: 'error', reason: `Category not found: "${str(row.category)}"` });
        errors++;
        continue;
      }

      const subName = str(row.subcategory);
      let subcategoryId = null;
      if (subName) {
        const sub = subs.find((s) => s.category_id === cat.id && s.name_en.trim().toLowerCase() === subName.toLowerCase());
        if (!sub) {
          results.push({ row: rowNum, fgd, name_en: str(row.name_en), status: 'error', reason: `Subcategory not found: "${subName}" under "${str(row.category)}"` });
          errors++;
          continue;
        }
        subcategoryId = sub.id;
      }

      // ── Build data ─────────────────────────────────────────
      const slug = str(row.slug) || toSlug(str(row.name_en));
      const barcode = str(row.barcode) || fgd; // fall back to FGD if not provided
      const tags = str(row.tags) ? str(row.tags).split(',').map((t) => t.trim()).filter(Boolean) : null;
      const attributes = parseAttributes(row.attributes);

      const prices = COUNTRIES.map((c) => ({
        country_id: c.id,
        currency_id: c.currency_id,
        regular_price: num(row[`price_${c.code}`]),
      })).filter((p) => p.regular_price !== null && p.regular_price > 0);

      const countryConfigs = COUNTRIES.map((c) => ({
        country_id: c.id,
        is_visible: flag(row[`visible_${c.code}`], 1),
      }));

      const images = ['image_1', 'image_2', 'image_3']
        .map((col) => str(row[col]))
        .filter(Boolean);

      const noteTypes = ['top', 'heart', 'base'];
      const notes = noteTypes
        .map((type) => {
          const ingdEn = str(row[`notes_${type}_ingd_en`]);
          const ingdAr = str(row[`notes_${type}_ingd_ar`]);
          const descEn = str(row[`notes_${type}_desc_en`]);
          const descAr = str(row[`notes_${type}_desc_ar`]);
          const img = str(row[`notes_${type}_image`]);
          if (!ingdEn && !ingdAr && !descEn && !descAr && !img) return null;
          return {
            note_type: type,
            ingredients_en: ingdEn ? ingdEn.split(',').map((s) => s.trim()).filter(Boolean) : [],
            ingredients_ar: ingdAr ? ingdAr.split(',').map((s) => s.trim()).filter(Boolean) : [],
            description_en: descEn || null,
            description_ar: descAr || null,
            image_url: img || null,
          };
        })
        .filter(Boolean);

      if (dryRun) {
        // Mark as ready without inserting
        fgdSet.add(fgd); // avoid duplicates within the same file
        results.push({ row: rowNum, fgd, name_en: str(row.name_en), category: str(row.category), status: 'ready' });
        inserted++;
        continue;
      }

      // ── Transactional insert ───────────────────────────────
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // products
        const [res2] = await conn.query(
          `INSERT INTO products
            (fgd, barcode, slug, name_en, name_ar, description_en, description_ar,
             category_id, subcategory_id, is_active, is_featured, tags, attributes,
             size_label_en, size_label_ar)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fgd, barcode, slug, str(row.name_en), str(row.name_ar),
            str(row.description_en) || null, str(row.description_ar) || null,
            cat.id, subcategoryId,
            flag(row.is_active, 1), flag(row.is_featured, 0),
            tags ? JSON.stringify(tags) : null,
            attributes ? JSON.stringify(attributes) : null,
            str(row.size_label_en) || null, str(row.size_label_ar) || null,
          ]
        );
        const productId = res2.insertId;

        // product_country
        for (const cc of countryConfigs) {
          await conn.query(
            `INSERT INTO product_country (product_id, country_id, is_visible) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)`,
            [productId, cc.country_id, cc.is_visible]
          );
        }

        // product_prices
        for (const p of prices) {
          await conn.query(
            `INSERT INTO product_prices (product_id, country_id, currency_id, regular_price)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE regular_price = VALUES(regular_price)`,
            [productId, p.country_id, p.currency_id, p.regular_price]
          );
        }

        // product_media
        for (let mi = 0; mi < images.length; mi++) {
          await conn.query(
            `INSERT INTO product_media (product_id, url, is_primary, sort_order, media_type)
             VALUES (?, ?, ?, ?, 'image')`,
            [productId, images[mi], mi === 0 ? 1 : 0, mi]
          );
        }

        // fragrance_notes
        for (const n of notes) {
          await conn.query(
            `INSERT INTO fragrance_notes
              (product_id, note_type, ingredients_en, ingredients_ar, description_en, description_ar, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               ingredients_en = VALUES(ingredients_en),
               ingredients_ar = VALUES(ingredients_ar),
               description_en = VALUES(description_en),
               description_ar = VALUES(description_ar),
               image_url = VALUES(image_url)`,
            [
              productId, n.note_type,
              JSON.stringify(n.ingredients_en), JSON.stringify(n.ingredients_ar),
              n.description_en, n.description_ar, n.image_url,
            ]
          );
        }

        await conn.commit();
        fgdSet.add(fgd); // register so same-file duplicates are caught
        results.push({ row: rowNum, fgd, name_en: str(row.name_en), category: str(row.category), status: 'inserted' });
        inserted++;
      } catch (rowErr) {
        await conn.rollback();
        results.push({ row: rowNum, fgd, name_en: str(row.name_en), status: 'error', reason: rowErr.message });
        errors++;
      } finally {
        conn.release();
      }
    }

    res.json({
      dry_run: dryRun,
      summary: { inserted, skipped, errors },
      results,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
