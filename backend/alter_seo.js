import db from './src/config/db.js';

async function updateSchema() {
  try {
    await db.query(`ALTER TABLE categories ADD COLUMN description_en TEXT NULL, ADD COLUMN description_ar TEXT NULL`);
    await db.query(`ALTER TABLE subcategories ADD COLUMN description_en TEXT NULL, ADD COLUMN description_ar TEXT NULL`);
    console.log('Successfully altered DB schemas added description cols.');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}
updateSchema();
