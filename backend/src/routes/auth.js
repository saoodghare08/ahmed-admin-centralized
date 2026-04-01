import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { authenticate, logAudit } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_long_random_secret';
const JWT_EXPIRES = '7d';

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [[user]] = await db.query(
      `SELECT id, username, email, password_hash, full_name, role, permissions, is_active
       FROM users WHERE username = ?`,
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Parse permissions
    let permissions = [];
    try {
      permissions = typeof user.permissions === 'string'
        ? JSON.parse(user.permissions)
        : (user.permissions || []);
    } catch { permissions = []; }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions,
      },
    });

    // Record the login event asynchronously
    req.user = payload; 
    logAudit(req, 'login', 'auth', user.id, { username: user.username, email: user.email });
    
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [[user]] = await db.query(
      `SELECT id, username, email, full_name, role, permissions, is_active
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    let permissions = [];
    try {
      permissions = typeof user.permissions === 'string'
        ? JSON.parse(user.permissions)
        : (user.permissions || []);
    } catch { permissions = []; }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions,
      },
    });
  } catch (err) { next(err); }
});

export default router;
