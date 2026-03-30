ALTER TABLE products ADD COLUMN deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active';
ALTER TABLE categories ADD COLUMN deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active';
ALTER TABLE subcategories ADD COLUMN deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active';
ALTER TABLE campaigns ADD COLUMN deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active';
