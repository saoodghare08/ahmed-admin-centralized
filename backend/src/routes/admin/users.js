import express from 'express';
import bcrypt from 'bcrypt';
import db from '../../config/db.js';
import { authorize, logAudit } from '../../middleware/auth.js';

const router = express.Router();
const SALT_ROUNDS = 10;

// All user routes require admin role
router.use(authorize('users'));

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, email, full_name, role, permissions, is_active, created_at, updated_at
       FROM users ORDER BY created_at DESC`
    );

    // Parse permissions JSON for each user
    const users = rows.map(u => ({
      ...u,
      permissions: (() => {
        try {
          return typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || []);
        } catch { return []; }
      })(),
    }));

    res.json({ data: users });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [[user]] = await db.query(
      `SELECT id, username, email, full_name, role, permissions, is_active, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
      user.permissions = typeof user.permissions === 'string'
        ? JSON.parse(user.permissions) : (user.permissions || []);
    } catch { user.permissions = []; }

    res.json({ data: user });
  } catch (err) { next(err); }
});

// POST /api/users
router.post('/', async (req, res, next) => {
  try {
    const { username, email, password, full_name, role, permissions } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const permsJson = JSON.stringify(permissions || []);

    const [result] = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, permissions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, password_hash, full_name || '', role || 'user', permsJson]
    );

    await logAudit(req, {
      action: 'create',
      module: 'users',
      targetId: result.insertId,
      details: { username, email, full_name, role: role || 'user', permissions: permissions || [] },
    });

    res.status(201).json({ data: { id: result.insertId }, message: 'User created' });
  } catch (err) { next(err); }
});

// PUT /api/users/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { username, email, full_name, role, permissions, is_active } = req.body;
    const permsJson = JSON.stringify(permissions || []);

    await db.query(
      `UPDATE users SET username=?, email=?, full_name=?, role=?, permissions=?, is_active=?
       WHERE id=?`,
      [username, email, full_name || '', role || 'user', permsJson, is_active ?? 1, req.params.id]
    );

    await logAudit(req, {
      action: 'update',
      module: 'users',
      targetId: req.params.id,
      details: { username, email, full_name, role, permissions, is_active },
    });

    res.json({ message: 'User updated' });
  } catch (err) { next(err); }
});

// PUT /api/users/:id/password
router.put('/:id/password', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.query(`UPDATE users SET password_hash=? WHERE id=?`, [password_hash, req.params.id]);

    await logAudit(req, {
      action: 'update',
      module: 'users',
      targetId: req.params.id,
      details: { action: 'password_reset' },
    });

    res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id  (soft-delete: sets is_active = 0)
router.delete('/:id', async (req, res, next) => {
  try {
    // Prevent admin from deactivating themselves
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    await db.query(`UPDATE users SET is_active = 0 WHERE id = ?`, [req.params.id]);

    await logAudit(req, {
      action: 'delete',
      module: 'users',
      targetId: req.params.id,
      details: { action: 'deactivated' },
    });

    res.json({ message: 'User deactivated' });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id/hard (hard-delete: physically removes the user)
router.delete('/:id/hard', async (req, res, next) => {
  try {
    // Only superadmin can permanently delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only superadmins can permanently delete users' });
    }
    
    // Prevent admin from deleting themselves
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await db.query(`DELETE FROM users WHERE id = ?`, [req.params.id]);

    await logAudit(req, {
      action: 'delete',
      module: 'users',
      targetId: req.params.id,
      details: { action: 'hard_deleted' },
    });

    res.json({ message: 'User permanently deleted' });
  } catch (err) { next(err); }
});

export default router;
