/**
 * Seed the default admin user if none exists.
 * Called automatically on server startup.
 */
import bcrypt from 'bcrypt';
import db from '../config/db.js';

export async function seedAdmin() {
  try {
    const [[existing]] = await db.query(
      `SELECT id FROM users WHERE username = 'admin' LIMIT 1`
    );
    if (existing) return; // Admin already exists

    const hash = await bcrypt.hash('admin123', 10);
    await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, permissions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'admin',
        'admin@ahmedalmaghribi.com',
        hash,
        'Super Admin',
        'admin',
        JSON.stringify(['products', 'categories', 'pricing', 'bundles', 'sales', 'gallery', 'analytics', 'users', 'audit_logs']),
      ]
    );
    console.log('✅  Default admin user seeded (admin / admin123)');
  } catch (err) {
    // Table might not exist yet — that's fine
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.log('⚠️  Users table not found — run migration 002 first');
    } else {
      console.error('⚠️  Admin seed error:', err.message);
    }
  }
}
