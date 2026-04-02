-- ============================================================
-- Ahmed Al Maghribi – Centralized Product Platform
-- Consolidated Master Schema (Ref: docs/DATABASE_SCHEMA.sql)
-- ============================================================

CREATE DATABASE IF NOT EXISTS centralized_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE centralized_db;

-- ── 1. CURRENCIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currencies (
    id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code CHAR(3) NOT NULL,
    symbol_en VARCHAR(10) NOT NULL,
    symbol_ar VARCHAR(10) NOT NULL,
    decimal_places TINYINT NOT NULL DEFAULT 2,
    PRIMARY KEY (id),
    UNIQUE KEY uq_currency_code (code)
) ENGINE = InnoDB;

-- Insert currencies
INSERT INTO currencies (id, code, symbol_en, symbol_ar, decimal_places)
VALUES (1, 'AED', 'AED', 'د.إ', 2), (2, 'SAR', 'SAR', 'ر.س', 2), (3, 'QAR', 'QAR', 'ر.ق', 2), (4, 'BHD', 'BHD', 'د.ب', 3), (5, 'KWD', 'KWD', 'د.ك', 3), (6, 'OMR', 'OMR', 'ر.ع', 3);

-- ── 2. COUNTRIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS countries (
    id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code CHAR(2) NOT NULL,
    name_en VARCHAR(60) NOT NULL,
    name_ar VARCHAR(60) NOT NULL,
    currency_id TINYINT UNSIGNED NOT NULL,
    domain_prefix VARCHAR(5) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_country_code (code),
    CONSTRAINT fk_country_currency FOREIGN KEY (currency_id) REFERENCES currencies (id)
) ENGINE = InnoDB;

-- Insert countries
INSERT INTO countries (id, code, name_en, name_ar, currency_id, domain_prefix, is_active)
VALUES (1, 'AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 1, 'ae', 1), (2, 'SA', 'Saudi Arabia', 'المملكة العربية السعودية', 2, 'sa', 1), (3, 'QA', 'Qatar', 'قطر', 3, 'qa', 1), (4, 'BH', 'Bahrain', 'البحرين', 4, 'bh', 1), (5, 'KW', 'Kuwait', 'الكويت', 5, 'kw', 1), (6, 'OM', 'Oman', 'سلطنة عُمان', 6, 'om', 1);

-- ── 3. CATEGORIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(120) NOT NULL,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    image_url VARCHAR(700) NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_category_slug (slug)
) ENGINE = InnoDB;

-- ── 4. SUBCATEGORIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcategories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id INT UNSIGNED NOT NULL,
    slug VARCHAR(120) NOT NULL,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    image_url VARCHAR(700) NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_subcategory_slug (slug),
    CONSTRAINT fk_sub_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ── 5. CATEGORY ↔ COUNTRY VISIBILITY ─────────────────────────
CREATE TABLE IF NOT EXISTS category_country (
    category_id INT UNSIGNED NOT NULL,
    country_id TINYINT UNSIGNED NOT NULL,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (category_id, country_id),
    CONSTRAINT fk_cc_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_country FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ── 6. PRODUCTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    fgd VARCHAR(100) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    description_en TEXT NULL,
    description_ar TEXT NULL,
    category_id INT UNSIGNED NOT NULL,
    subcategory_id INT UNSIGNED NULL,
    brand VARCHAR(100) NULL,
    weight_grams SMALLINT UNSIGNED NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active',
    tags JSON NULL,
    attributes JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_fgd (fgd),
    UNIQUE KEY uq_product_slug (slug),
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories (id),
    CONSTRAINT fk_product_subcategory FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
) ENGINE = InnoDB AUTO_INCREMENT = 1001;

-- ── 7. FRAGRANCE NOTES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS fragrance_notes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    note_type ENUM('top', 'heart', 'base') NOT NULL,
    ingredients JSON NOT NULL,
    description_en TEXT NULL,
    description_ar TEXT NULL,
    image_url VARCHAR(700) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_note_type (product_id, note_type),
    CONSTRAINT fk_note_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ── 8. PRODUCT SIZES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_sizes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    label_en VARCHAR(60) NOT NULL,
    label_ar VARCHAR(60) NOT NULL,
    value_ml SMALLINT UNSIGNED NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_size_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ── 9. PRODUCT ↔ COUNTRY CONFIG ───────────────────────────────
CREATE TABLE IF NOT EXISTS product_country (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    country_id TINYINT UNSIGNED NOT NULL,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    slug_override VARCHAR(220) NULL,
    meta_title_en VARCHAR(255) NULL,
    meta_title_ar VARCHAR(255) NULL,
    meta_desc_en VARCHAR(500) NULL,
    meta_desc_ar VARCHAR(500) NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_country (product_id, country_id),
    CONSTRAINT fk_pc_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT fk_pc_country FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ── 10. PRODUCT PRICES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_prices (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    country_id TINYINT UNSIGNED NOT NULL,
    currency_id TINYINT UNSIGNED NOT NULL,
    regular_price DECIMAL(12, 3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_price_product_country (product_id, country_id),
    CONSTRAINT fk_price_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT fk_price_country FOREIGN KEY (country_id) REFERENCES countries (id),
    CONSTRAINT fk_price_currency FOREIGN KEY (currency_id) REFERENCES currencies (id)
) ENGINE = InnoDB;

-- ── 11. PRODUCT MEDIA ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_media (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    size_id INT UNSIGNED NULL,
    url VARCHAR(700) NOT NULL,
    alt_en VARCHAR(255) NULL,
    alt_ar VARCHAR(255) NULL,
    media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_media_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT fk_media_size FOREIGN KEY (size_id) REFERENCES product_sizes (id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ── 12. PRODUCT SALES LOG ────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_sales_log (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    country_id TINYINT UNSIGNED NOT NULL,
    qty_sold SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 3) NULL,
    currency_id TINYINT UNSIGNED NULL,
    sold_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_ref VARCHAR(100) NULL,
    PRIMARY KEY (id),
    KEY idx_sales_product (product_id),
    KEY idx_sales_country (country_id),
    KEY idx_sales_sold_at (sold_at),
    CONSTRAINT fk_sales_product FOREIGN KEY (product_id) REFERENCES products (id),
    CONSTRAINT fk_sales_country FOREIGN KEY (country_id) REFERENCES countries (id),
    CONSTRAINT fk_sales_currency FOREIGN KEY (currency_id) REFERENCES currencies (id)
) ENGINE = InnoDB;

-- ── 13. BUNDLES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundles (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bundle_product (product_id),
    CONSTRAINT fk_bundle_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ── 14. BUNDLE ITEMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundle_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    bundle_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NULL,
    component_name_en VARCHAR(255) NULL,
    component_name_ar VARCHAR(255) NULL,
    component_image_url VARCHAR(700) NULL,
    qty TINYINT UNSIGNED NOT NULL DEFAULT 1,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_bitem_bundle FOREIGN KEY (bundle_id) REFERENCES bundles (id) ON DELETE CASCADE,
    CONSTRAINT fk_bitem_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ── 15. CAMPAIGNS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name_en         VARCHAR(255) NOT NULL,
    name_ar         VARCHAR(255) NULL,
    type            ENUM('discount','bxgy','foc') NOT NULL,
    status          ENUM('draft','scheduled','active','paused','expired','archived') NOT NULL DEFAULT 'draft',
    priority        SMALLINT NOT NULL DEFAULT 100,
    start_at        DATETIME NOT NULL,
    end_at          DATETIME NOT NULL,
    is_stackable    TINYINT(1) NOT NULL DEFAULT 0,
    max_uses        INT UNSIGNED NULL,
    current_uses    INT UNSIGNED NOT NULL DEFAULT 0,
    created_by      VARCHAR(100) NULL,
    notes           TEXT NULL,
    deleted_status ENUM('active', 'bin', 'permanent') DEFAULT 'active',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_campaign_status (status),
    KEY idx_campaign_dates (start_at, end_at),
    KEY idx_campaign_type (type)
) ENGINE=InnoDB;

-- ── 16. CAMPAIGN ↔ COUNTRY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_countries (
    campaign_id     INT UNSIGNED NOT NULL,
    country_id      TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (campaign_id, country_id),
    CONSTRAINT fk_cc2_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_cc2_country  FOREIGN KEY (country_id)  REFERENCES countries(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 17. CAMPAIGN SCOPE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_scope (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    scope_type      ENUM('all','category','subcategory','product') NOT NULL,
    scope_ref_id    INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_scope_campaign (campaign_id),
    CONSTRAINT fk_scope_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 18. DISCOUNT RULES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_discount_rules (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    discount_type   ENUM('percentage','fixed') NOT NULL,
    discount_value  DECIMAL(12,3) NOT NULL,
    min_price       DECIMAL(12,3) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_discount_campaign (campaign_id),
    CONSTRAINT fk_dr_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 19. PER-PRODUCT DISCOUNT OVERRIDES ────────────────────────
CREATE TABLE IF NOT EXISTS campaign_product_overrides (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    discount_type   ENUM('percentage','fixed') NOT NULL,
    discount_value  DECIMAL(12,3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_override (campaign_id, product_id),
    CONSTRAINT fk_po_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 20. BXGY RULES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_bxgy_rules (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id         INT UNSIGNED NOT NULL,
    buy_qty             SMALLINT UNSIGNED NOT NULL,
    get_qty             SMALLINT UNSIGNED NOT NULL,
    get_discount_type   ENUM('free','percentage','fixed') NOT NULL DEFAULT 'free',
    get_discount_value  DECIMAL(12,3) NOT NULL DEFAULT 0,
    is_repeatable       TINYINT(1) NOT NULL DEFAULT 0,
    max_repeats         SMALLINT UNSIGNED NULL,
    allow_overlap       TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bxgy_campaign (campaign_id),
    CONSTRAINT fk_bxgy_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 21. BXGY PRODUCT LISTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_bxgy_products (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    list_type       ENUM('buy','get') NOT NULL,
    PRIMARY KEY (id),
    KEY idx_bxgy_campaign (campaign_id, list_type),
    CONSTRAINT fk_bxgyp_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_bxgyp_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 22. FOC RULES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_foc_rules (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id         INT UNSIGNED NOT NULL,
    cart_min            DECIMAL(12,3) NOT NULL,
    cart_max            DECIMAL(12,3) NULL,
    selection_mode      ENUM('auto','choose') NOT NULL DEFAULT 'auto',
    max_free_items      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_foc_campaign (campaign_id),
    CONSTRAINT fk_foc_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 23. FOC PRODUCT LIST ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_foc_products (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    KEY idx_foc_campaign (campaign_id),
    CONSTRAINT fk_focp_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_focp_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 24. CAMPAIGN HISTORY LOG ──────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_history (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    action          ENUM('created','updated','activated','paused','expired','archived') NOT NULL,
    changed_by      VARCHAR(100) NULL,
    details         JSON NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_history_campaign (campaign_id),
    CONSTRAINT fk_hist_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 25. USERS ────────────────────────────────────────────────────
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
) ENGINE = InnoDB;

-- ── 26. AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NULL,
    action      ENUM('create','update','delete') NOT NULL,
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
) ENGINE = InnoDB;
