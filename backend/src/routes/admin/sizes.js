import express from 'express';
import db from '../../config/db.js';

const router = express.Router();

// GET /api/sizes
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, label_en, label_ar, value_ml, sort_order 
       FROM product_sizes 
       ORDER BY sort_order ASC, value_ml ASC, id ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/sizes
router.post('/', async (req, res, next) => {
  try {
    const { label_en, label_ar, value_ml, sort_order } = req.body;
    
    if (!label_en) {
      return res.status(400).json({ error: 'label_en is required' });
    }

    // Try to parse ML value safely if not expressly provided
    let extractedMl = value_ml;
    if (!extractedMl) {
      const mlMatch = label_en.match(/(\d+)/);
      if (mlMatch) extractedMl = parseInt(mlMatch[1], 10);
    }

    const [result] = await db.query(
      `INSERT INTO product_sizes (label_en, label_ar, value_ml, sort_order) VALUES (?, ?, ?, ?)`,
      [label_en, label_ar || label_en, extractedMl || null, sort_order || 0]
    );

    res.status(201).json({ 
      data: { 
        id: result.insertId, 
        label_en, 
        label_ar: label_ar || label_en, 
        value_ml: extractedMl || null, 
        sort_order: sort_order || 0 
      } 
    });
  } catch (err) {
    next(err);
  }
});

export default router;
