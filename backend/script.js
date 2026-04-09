import db from './src/config/db.js';

async function run() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`related_products\` (
        \`id\` int(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`product_id\` int(10) UNSIGNED NOT NULL,
        \`related_product_id\` int(10) UNSIGNED NOT NULL,
        \`sort_order\` smallint(6) NOT NULL DEFAULT 0,
        FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`related_product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Table related_products created successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit();
  }
}

run();
