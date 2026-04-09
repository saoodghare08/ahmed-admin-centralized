import express from 'express';
import db from '../../config/db.js';

const router = express.Router();

// GET /api/labels
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name_en, name_ar, image_url, sort_order 
       FROM product_labels 
       ORDER BY sort_order ASC, name_en ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/labels
router.post('/', async (req, res, next) => {
  try {
    const { name_en, name_ar, image_url, sort_order } = req.body;
    
    if (!name_en || !name_ar) {
      return res.status(400).json({ error: 'name_en and name_ar are required' });
    }

    const [result] = await db.query(
      `INSERT INTO product_labels (name_en, name_ar, image_url, sort_order) VALUES (?, ?, ?, ?)`,
      [name_en, name_ar, image_url || null, sort_order || 0]
    );

    res.status(201).json({ 
      data: { 
        id: result.insertId, 
        name_en, 
        name_ar, 
        image_url: image_url || null, 
        sort_order: sort_order || 0 
      } 
    });
  } catch (err) {
    next(err);
  }
});

export default router;
