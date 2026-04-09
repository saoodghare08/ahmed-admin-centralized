import express from 'express';
import db from '../../config/db.js';
import { authorize } from '../../middleware/auth.js';

const router = express.Router();

// Only admin can view audit logs
router.use(authorize('audit_logs'));

// GET /api/audit-logs?page=1&limit=50&user_id=&module=&action=&from=&to=
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      user_id,
      module,
      action,
      from,
      to,
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (user_id) {
      conditions.push('a.user_id = ?');
      params.push(parseInt(user_id));
    }
    if (module) {
      conditions.push('a.module = ?');
      params.push(module);
    }
    if (action) {
      conditions.push('a.action = ?');
      params.push(action);
    }
    if (from) {
      conditions.push('a.created_at >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('a.created_at <= ?');
      params.push(to + ' 23:59:59');
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs a ${where}`,
      params
    );

    // Get rows with user info
    const [rows] = await db.query(
      `SELECT a.*, u.username, u.full_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Parse details JSON
    const logs = rows.map(r => ({
      ...r,
      details: (() => {
        try {
          return typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
        } catch { return {}; }
      })(),
    }));

    res.json({
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

export default router;
