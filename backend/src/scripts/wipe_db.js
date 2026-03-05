import 'dotenv/config';
import pool from '../config/db.js';

async function wipeDatabase() {
  let connection;
  try {
    console.log('Starting full database wipe & indexing reset...');
    connection = await pool.getConnection();
    
    // 1. Disable foreign key checks so we can truncate tables containing foreign keys safely
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // 2. Fetch all table names dynamically from the current connected database
    const [rows] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    
    // 3. Loop through and TRUNCATE each table 
    // TRUNCATE is significantly faster than DELETE and critically resets AUTO_INCREMENT back to 1
    for (const row of rows) {
        const tableName = row.TABLE_NAME || row.table_name;
        console.log(`Truncating table: ${tableName}...`);
        await connection.query(`TRUNCATE TABLE \`${tableName}\``);
    }
    
    // 4. Re-enable foreign key checks to restore database integrity rules
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✅ Database wipe complete. All tables are empty and ID counters have been reset to 1.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error wiping database:', error);
    if (connection) {
        try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } 
        catch (e) { /* ignore */ }
    }
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

wipeDatabase();
