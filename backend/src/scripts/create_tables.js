import db from '../config/db.js';

async function createTables() {
  const connection = await db.getConnection();
  try {
    console.log('Creating users table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username    VARCHAR(100) NOT NULL,
        email       VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name   VARCHAR(200) NOT NULL DEFAULT '',
        role        ENUM('admin','user') NOT NULL DEFAULT 'user',
        permissions JSON NULL,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_username (username),
        UNIQUE KEY uq_user_email (email)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
    `);

    console.log('Creating audit_logs table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id     INT UNSIGNED NULL,
        action      ENUM('create','update','delete','login') NOT NULL,
        module      VARCHAR(60) NOT NULL,
        target_id   VARCHAR(100) NULL,
        details     JSON NULL,
        ip_address  VARCHAR(45) NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_audit_user (user_id),
        KEY idx_audit_module (module),
        KEY idx_audit_created (created_at),
        CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
    `);

    console.log('✅ Tables created successfully');
  } catch (err) {
    console.error('❌ Failed to create tables:', err.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

createTables();
