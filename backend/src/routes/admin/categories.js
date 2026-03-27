import express from 'express';
import db from '../../config/db.js';
import multer from 'multer';
import xlsx from 'xlsx';
import { logAudit } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const toSlug = (str) =>
  String(str).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').trim();

// POST /api/categories/import
router.post('/import', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No Excel file uploaded' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Normalize headers (lowercase, remove spaces from keys)
    const data = rawData.map(row => {
      const normalizedRow = {};
      for (const key in row) {
        const cleanKey = String(key).toLowerCase().replace(/\s+/g, '');
        normalizedRow[cleanKey] = row[key];
      }
      return normalizedRow;
    }).filter(row => row.type); // Filter out completely empty rows

    console.log('--- EXCEL IMPORT DEBUG ---');
    console.log('Raw parsed data length:', data?.length);
    console.log('First row keys:', data?.length ? Object.keys(data[0]) : 'None');
    console.log('First row data:', data?.[0]);

    if (!data || data.length === 0) throw new Error('Excel sheet is empty or headers are missing/invalid');

    // Load existing categories to map names to IDs
    const [existingCats] = await connection.query(`SELECT id, LOWER(name_en) AS name_lower FROM categories`);
    const catMap = new Map();
    existingCats.forEach(c => catMap.set(c.name_lower, c.id));

    // Process Categories first
    const newCategories = data.filter(r => {
      if (!r.type) return false;
      const t = String(r.type).trim().toLowerCase();
      return t === 'category';
    });

    console.log(`Found ${newCategories.length} categories to insert.`);

    for (const row of newCategories) {
      if (!row.name_en || !row.name_ar) throw new Error('Missing name_en or name_ar on a category');
      
      const slug = toSlug(row.name_en);
      const nameLower = String(row.name_en).toLowerCase().trim();
      const sortOrder = parseInt(row.sort_order) || 0;
      const isActive = row.is_active !== undefined ? (Number(row.is_active) === 1 ? 1 : 0) : 1;

      if (!catMap.has(nameLower)) {
        const [result] = await connection.query(
          `INSERT INTO categories (slug, name_en, name_ar, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`,
          [slug, row.name_en, row.name_ar, sortOrder, isActive]
        );
        catMap.set(nameLower, result.insertId);
      }
    }

    // Process Subcategories next
    const newSubcategories = data.filter(r => r.type?.toLowerCase() === 'subcategory');
    for (const row of newSubcategories) {
      if (!row.name_en || !row.name_ar || !row.parent_category_en) {
        throw new Error(`Missing name_en, name_ar, or parent_category_en on subcategory: ${row.name_en || 'Unknown'}`);
      }
      
      const parentLower = String(row.parent_category_en).toLowerCase().trim();
      const parentId = catMap.get(parentLower);

      if (!parentId) {
        throw new Error(`Parent category '${row.parent_category_en}' not found for subcategory '${row.name_en}'`);
      }

      const slug = toSlug(row.name_en);
      const sortOrder = parseInt(row.sort_order) || 0;
      const isActive = row.is_active !== undefined ? (Number(row.is_active) === 1 ? 1 : 0) : 1;

      await connection.query(
        `INSERT INTO subcategories (category_id, slug, name_en, name_ar, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [parentId, slug, row.name_en, row.name_ar, sortOrder, isActive]
      );
    }

    await connection.commit();
    res.json({ message: 'Excel import successful', imported: data.length });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// GET /api/categories?country=AE&admin=1
router.get('/', async (req, res, next) => {
  try {
    const { country, admin } = req.query;
    let query = `SELECT c.* FROM categories c`;
    const params = [];

    if (country) {
      query += `
        LEFT JOIN category_country cc ON cc.category_id = c.id
          AND cc.country_id = (SELECT id FROM countries WHERE code = ?)
        WHERE c.is_active = 1
          AND (cc.is_visible IS NULL OR cc.is_visible = 1)`;
      params.push(country.toUpperCase());
    } else if (!admin) {
      query += ` WHERE c.is_active = 1`;
    }
    // admin=1 returns all categories regardless of is_active
    query += ` ORDER BY c.sort_order, c.id`;

    const [rows] = await db.query(query, params);

    // For admin: attach subcategories to each category
    if (admin) {
      for (const cat of rows) {
        const [subs] = await db.query(
          `SELECT * FROM subcategories WHERE category_id = ? ORDER BY sort_order, id`,
          [cat.id]
        );
        cat.subcategories = subs;
      }
    }

    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/categories/:id — includes subcategories
router.get('/:id', async (req, res, next) => {
  try {
    const [[category]] = await db.query(
      `SELECT * FROM categories WHERE id = ?`, [req.params.id]
    );
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const [subcategories] = await db.query(
      `SELECT * FROM subcategories WHERE category_id = ? AND is_active = 1 ORDER BY sort_order, id`,
      [req.params.id]
    );
    res.json({ data: { ...category, subcategories } });
  } catch (err) { next(err); }
});

// POST /api/categories
router.post('/', async (req, res, next) => {
  try {
    const { slug, name_en, name_ar, image_url, sort_order, is_active } = req.body;
    const [result] = await db.query(
      `INSERT INTO categories (slug, name_en, name_ar, image_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [slug, name_en, name_ar, image_url || null, sort_order ?? 0, is_active ?? 1,]
    );
    
    await logAudit(req, 'create', 'categories', result.insertId, { slug, name_en, name_ar, image_url, sort_order, is_active });

    res.status(201).json({ data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// PUT /api/categories/reorder
router.put('/reorder', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { items } = req.body; // array of { id, sort_order }
    if (Array.isArray(items)) {
      for (const item of items) {
        await connection.query(`UPDATE categories SET sort_order = ? WHERE id = ?`, [item.sort_order, item.id]);
      }
    }
    await connection.commit();
    res.json({ message: 'Categories reordered successfully' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { slug, name_en, name_ar, image_url, sort_order, is_active } = req.body;
    await db.query(
      `UPDATE categories SET slug=?, name_en=?, name_ar=?, image_url=?, sort_order=?, is_active=? WHERE id=?`,
      [slug, name_en, name_ar, image_url || null, sort_order ?? 0, is_active ?? 1, req.params.id]
    );
    
    await logAudit(req, 'update', 'categories', req.params.id, { slug, name_en, name_ar, image_url, sort_order, is_active });

    res.json({ message: 'Category updated' });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const categoryId = req.params.id;

    // 1. Delete all subcategories first
    await connection.query(
      `DELETE FROM subcategories WHERE category_id = ?`, 
      [categoryId]
    );

    // 2. Delete the parent category
    const [result] = await connection.query(
      `DELETE FROM categories WHERE id = ?`, 
      [categoryId]
    );

    await connection.commit();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await logAudit(req, 'delete', 'categories', categoryId, { action: 'delete_category_and_subcategories' });

    res.json({ message: 'Category and all associated subcategories deleted' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// ── SUBCATEGORY ROUTES ──────────────────────────────────────

// POST /api/categories/:id/subcategories
router.post('/:id/subcategories', async (req, res, next) => {
  try {
    const { slug, name_en, name_ar, image_url, sort_order } = req.body;
    const [result] = await db.query(
      `INSERT INTO subcategories (category_id, slug, name_en, name_ar, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, slug, name_en, name_ar, image_url || null, sort_order || 0]
    );
    
    await logAudit(req, 'create', 'subcategories', result.insertId, { category_id: req.params.id, slug, name_en, name_ar, image_url, sort_order });

    res.status(201).json({ data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// PUT /api/categories/subcategories/reorder
router.put('/subcategories/reorder', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { items } = req.body; // array of { id, sort_order, category_id }
    if (Array.isArray(items)) {
      for (const item of items) {
        await connection.query(
          `UPDATE subcategories SET sort_order = ?, category_id = ? WHERE id = ?`,
          [item.sort_order, item.category_id, item.id]
        );
      }
    }
    await connection.commit();
    res.json({ message: 'Subcategories reordered/reassigned successfully' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// PUT /api/categories/subcategories/:subId
router.put('/subcategories/:subId', async (req, res, next) => {
  try {
    const { slug, name_en, name_ar, image_url, sort_order, is_active } = req.body;
    await db.query(
      `UPDATE subcategories SET slug=?, name_en=?, name_ar=?, image_url=?, sort_order=?, is_active=? WHERE id=?`,
      [slug, name_en, name_ar, image_url || null, sort_order ?? 0, is_active ?? 1, req.params.subId]
    );
    
    await logAudit(req, 'update', 'subcategories', req.params.subId, { slug, name_en, name_ar, image_url, sort_order, is_active });

    res.json({ message: 'Subcategory updated' });
  } catch (err) { next(err); }
});

// DELETE /api/categories/subcategories/:subId
router.delete('/subcategories/:subId', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM subcategories WHERE id = ?`, [req.params.subId]);
    
    await logAudit(req, 'delete', 'subcategories', req.params.subId, {});

    res.json({ message: 'Subcategory deleted' });
  } catch (err) { next(err); }
});

export default router;
