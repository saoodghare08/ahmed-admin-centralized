import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_long_random_secret';

/**
 * authenticate – verifies JWT and attaches req.user
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, permissions }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * authorize(...modules) – checks that the user is admin OR has at least one
 * of the listed module permissions.
 * Usage: router.use(authorize('products'))
 */
export function authorize(...modules) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    // Admin bypasses all permission checks
    if (req.user.role === 'admin') return next();

    // Check if user has at least one of the required modules
    const userPerms = req.user.permissions || [];
    const hasAccess = modules.length === 0 || modules.some(m => userPerms.includes(m));

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to access this resource' });
    }

    next();
  };
}

/**
 * logAudit – utility to insert an audit log entry
 */
export async function logAudit(req, actionArg, moduleArg, targetIdArg, detailsArg = {}) {
  let action = actionArg;
  let module = moduleArg;
  let targetId = targetIdArg;
  let details = detailsArg;

  // Support for object notation (backward compatibility with users.js)
  if (typeof actionArg === 'object' && actionArg !== null) {
    action = actionArg.action;
    module = actionArg.module;
    targetId = actionArg.targetId;
    details = actionArg.details || {};
  }

  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, module, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        action,
        module,
        String(targetId || ''),
        JSON.stringify(details || {}),
        req.ip || req.connection?.remoteAddress || null,
      ]
    );
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err.message);
    // Don't fail the request if audit logging fails
  }
}
