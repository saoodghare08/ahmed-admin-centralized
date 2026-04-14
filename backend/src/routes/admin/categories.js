import express from 'express';
import db from '../../config/db.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { logAudit } from '../../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const toSlug = (str) =>
  String(str).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').trim();

// GET /api/categories/template
router.get('/template', (_req, res) => {
  const headers = ['Type', 'Name_EN', 'Name_AR', 'Parent_Category_EN', 'Sort_Order', 'Is_Active'];
  
  const exampleData = [
    {
      Type: 'Category',
      Name_EN: 'Perfumes',
      Name_AR: 'عطور',
      Parent_Category_EN: '',
      Sort_Order: 1,
      Is_Active: 1,
    },
    {
      Type: 'Subcategory',
      Name_EN: 'Oud',
      Name_AR: 'عود',
      Parent_Category_EN: 'Perfumes',
      Sort_Order: 1,
      Is_Active: 1,
    }
  ];

  const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
  ws['!cols'] = headers.map(() => ({ wch: 25 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Categories');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="categories_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.status(200).send(buf);
});

// POST /api/categories/import
router.post('/import', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No Excel file uploaded' });

  const dryRun = req.query.dry_run === 'true';
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    // Normalize headers (lowercase, remove spaces from keys)
    const data = rawData.map((row, index) => {
      const normalizedRow = { __rowNum: index + 2 };
      for (const key in row) {
        if (key === '__rowNum') continue;
        const cleanKey = String(key).toLowerCase().replace(/\s+/g, '');
        normalizedRow[cleanKey] = row[key];
      }
      return normalizedRow;
    }).filter(row => row.type); // Filter out completely empty rows

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'Excel sheet is empty or headers are missing/invalid' });
    }

    // Load existing categories to map names to IDs
    const [existingCats] = await connection.query(`SELECT id, LOWER(name_en) AS name_lower FROM categories`);
    const catMap = new Map();
    existingCats.forEach(c => catMap.set(c.name_lower, c.id));

    const results = [];
    let inserted = 0, skipped = 0, errors = 0;

    // Process Categories first
    const newCategories = data.filter(r => String(r.type).trim().toLowerCase() === 'category');
    for (const row of newCategories) {
      const rowNum = row.__rowNum;
      const t = 'Category';
      const nameEn = String(row.name_en || '').trim();
      const nameAr = String(row.name_ar || '').trim();

      if (!nameEn) {
        results.push({ row: rowNum, type: t, name_en: nameEn || '—', parent: '—', status: 'error', reason: 'Missing name_en' });
        errors++;
        continue;
      }

      const nameLower = nameEn.toLowerCase();
      if (catMap.has(nameLower)) {
        results.push({ row: rowNum, type: t, name_en: nameEn, parent: '—', status: 'skip', reason: 'Category already exists' });
        skipped++;
        continue;
      }

      const slug = toSlug(nameEn);
      const sortOrder = parseInt(row.sort_order) || 0;
      const isActive = row.is_active !== undefined && row.is_active !== '' ? (Number(row.is_active) === 1 ? 1 : 0) : 1;

      if (dryRun) {
        catMap.set(nameLower, 'fake_id_for_dry_run');
        results.push({ row: rowNum, type: t, name_en: nameEn, parent: '—', status: 'ready', reason: '' });
        inserted++;
      } else {
        try {
          const [result] = await connection.query(
            `INSERT INTO categories (slug, name_en, name_ar, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`,
            [slug, nameEn, nameAr, sortOrder, isActive]
          );
          catMap.set(nameLower, result.insertId);
          results.push({ row: rowNum, type: t, name_en: nameEn, parent: '—', status: 'inserted', reason: '' });
          inserted++;
        } catch (err) {
          results.push({ row: rowNum, type: t, name_en: nameEn, parent: '—', status: 'error', reason: err.message });
          errors++;
        }
      }
    }

    // Process Subcategories next
    const newSubcategories = data.filter(r => String(r.type).trim().toLowerCase() === 'subcategory');
    for (const row of newSubcategories) {
      const rowNum = row.__rowNum;
      const t = 'Subcategory';
      const nameEn = String(row.name_en || '').trim();
      const nameAr = String(row.name_ar || '').trim();
      const parentName = String(row.parent_category_en || '').trim();

      if (!nameEn || !parentName) {
        results.push({ row: rowNum, type: t, name_en: nameEn || '—', parent: parentName || '—', status: 'error', reason: 'Missing name_en or parent' });
        errors++;
        continue;
      }

      const parentLower = parentName.toLowerCase();
      const parentId = catMap.get(parentLower);

      if (!parentId) {
        results.push({ row: rowNum, type: t, name_en: nameEn, parent: parentName, status: 'error', reason: `Parent category '${parentName}' not found` });
        errors++;
        continue;
      }

      const slug = toSlug(nameEn);
      const sortOrder = parseInt(row.sort_order) || 0;
      const isActive = row.is_active !== undefined && row.is_active !== '' ? (Number(row.is_active) === 1 ? 1 : 0) : 1;

      if (dryRun) {
        results.push({ row: rowNum, type: t, name_en: nameEn, parent: parentName, status: 'ready', reason: '' });
        inserted++;
      } else {
        try {
          await connection.query(
            `INSERT INTO subcategories (category_id, slug, name_en, name_ar, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
            [parentId, slug, nameEn, nameAr, sortOrder, isActive]
          );
          results.push({ row: rowNum, type: t, name_en: nameEn, parent: parentName, status: 'inserted', reason: '' });
          inserted++;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
             results.push({ row: rowNum, type: t, name_en: nameEn, parent: parentName, status: 'skip', reason: 'Duplicate slug' });
             skipped++;
          } else {
             results.push({ row: rowNum, type: t, name_en: nameEn, parent: parentName, status: 'error', reason: err.message });
             errors++;
          }
        }
      }
    }

    if (dryRun) {
      await connection.rollback();
    } else {
      await connection.commit();
    }

    // Sort results by row number to match Excel order
    results.sort((a, b) => a.row - b.row);

    res.json({
      dry_run: dryRun,
      summary: { inserted, skipped, errors },
      results
    });
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
    let query = `SELECT c.* FROM categories c WHERE 1=1`;
    const params = [];

    if (country) {
      query += `
        LEFT JOIN category_country cc ON cc.category_id = c.id
          AND cc.country_id = (SELECT id FROM countries WHERE code = ?)
        AND c.is_active = 1
        AND (cc.is_visible IS NULL OR cc.is_visible = 1)`;
      params.push(country.toUpperCase());
    } else if (!admin) {
      query += ` AND c.is_active = 1`;
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
    const { slug, name_en, name_ar, description_en, description_ar, image_url, sort_order, is_active } = req.body;
    const [result] = await db.query(
      `INSERT INTO categories (slug, name_en, name_ar, description_en, description_ar, image_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, name_en, name_ar, description_en || null, description_ar || null, image_url || null, sort_order ?? 0, is_active ?? 1]
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
    const { slug, name_en, name_ar, description_en, description_ar, image_url, sort_order, is_active } = req.body;
    await db.query(
      `UPDATE categories SET slug=?, name_en=?, name_ar=?, description_en=?, description_ar=?, image_url=?, sort_order=?, is_active=? WHERE id=?`,
      [slug, name_en, name_ar, description_en || null, description_ar || null, image_url || null, sort_order ?? 0, is_active ?? 1, req.params.id]
    );
    
    await logAudit(req, 'update', 'categories', req.params.id, { slug, name_en, name_ar, image_url, sort_order, is_active });

    res.json({ message: 'Category updated' });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id (Permanent delete)
router.delete('/:id', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const categoryId = req.params.id;

    // First delete subcategories
    await connection.query(`DELETE FROM subcategories WHERE category_id = ?`, [categoryId]);
    // Then delete the category
    const [result] = await connection.query(`DELETE FROM categories WHERE id = ?`, [categoryId]);

    await connection.commit();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
    
    await logAudit(req, 'delete', 'categories', categoryId, { action: 'permanent_delete_category_with_subcategories' });
    res.json({ message: 'Category and all its subcategories have been permanently deleted' });
  } catch (err) { 
    await connection.rollback(); 
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete category because it is linked to products. Please remove the products or reassign them first.' });
    }
    next(err); 
  }
  finally { connection.release(); }
});


// ── SUBCATEGORY ROUTES ──────────────────────────────────────

// POST /api/categories/:id/subcategories
router.post('/:id/subcategories', async (req, res, next) => {
  try {
    const { slug, name_en, name_ar, description_en, description_ar, image_url, sort_order } = req.body;
    const [result] = await db.query(
      `INSERT INTO subcategories (category_id, slug, name_en, name_ar, description_en, description_ar, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, slug, name_en, name_ar, description_en || null, description_ar || null, image_url || null, sort_order || 0]
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
    const { slug, name_en, name_ar, description_en, description_ar, image_url, sort_order, is_active } = req.body;
    await db.query(
      `UPDATE subcategories SET slug=?, name_en=?, name_ar=?, description_en=?, description_ar=?, image_url=?, sort_order=?, is_active=? WHERE id=?`,
      [slug, name_en, name_ar, description_en || null, description_ar || null, image_url || null, sort_order ?? 0, is_active ?? 1, req.params.subId]
    );
    
    await logAudit(req, 'update', 'subcategories', req.params.subId, { slug, name_en, name_ar, image_url, sort_order, is_active });

    res.json({ message: 'Subcategory updated' });
  } catch (err) { next(err); }
});

// DELETE /api/categories/subcategories/:subId (Permanent delete)
router.delete('/subcategories/:subId', async (req, res, next) => {
  try {
    const [result] = await db.query(`DELETE FROM subcategories WHERE id = ?`, [req.params.subId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Subcategory not found' });
    
    await logAudit(req, 'delete', 'subcategories', req.params.subId, { action: 'permanent_delete_subcategory' });
    res.json({ message: 'Subcategory permanently deleted' });
  } catch (err) { 
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete subcategory because it is linked to products. Please remove the products or reassign them first.' });
    }
    next(err); 
  }
});

export default router;
