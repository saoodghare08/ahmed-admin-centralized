import express from 'express';
import db from '../../config/db.js';

const router = express.Router();

// GET /api/countries
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, cu.code AS currency_code, cu.symbol_en, cu.symbol_ar, cu.decimal_places
       FROM countries c
       JOIN currencies cu ON cu.id = c.currency_id
       WHERE c.is_active = 1
       ORDER BY c.id`
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/countries/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, cu.code AS currency_code, cu.symbol_en, cu.symbol_ar, cu.decimal_places
       FROM countries c
       JOIN currencies cu ON cu.id = c.currency_id
       WHERE c.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Country not found' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

export default router;
