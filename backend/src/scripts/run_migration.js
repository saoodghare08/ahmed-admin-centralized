import db from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const scriptName = process.argv[2] || '002_users_and_audit.sql';
  const sqlPath = path.join(__dirname, '..', 'db', 'migrations', scriptName);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  // Split statements by semicolon
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));

  const connection = await db.getConnection();
  
  try {
    for (const stmt of statements) {
      console.log('Executing:', stmt.substring(0, 50) + '...');
      await connection.query(stmt);
    }
    console.log('✅ Migration 002 completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration();
