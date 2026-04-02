-- ============================================================
-- Ahmed Al Maghribi – Centralized Product Platform
-- Schema v1.0  |  Phase 1
-- ============================================================

CREATE DATABASE IF NOT EXISTS centralized_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE centralized_db;

-- ── 1. CURRENCIES ────────────────────────────────────────────
CREATE TABLE currencies (
    id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code CHAR(3) NOT NULL,
    symbol_en VARCHAR(10) NOT NULL,
    symbol_ar VARCHAR(10) NOT NULL,
    decimal_places TINYINT NOT NULL DEFAULT 2,
    PRIMARY KEY (id),
    UNIQUE KEY uq_currency_code (code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO
    currencies (
        id,
        code,
        symbol_en,
        symbol_ar,
        decimal_places
    )
VALUES (1, 'AED', 'AED', 'د.إ', 2),
    (2, 'SAR', 'SAR', 'ر.س', 2),
    (3, 'QAR', 'QAR', 'ر.ق', 2),
    (4, 'BHD', 'BHD', 'د.ب', 3),
    (5, 'KWD', 'KWD', 'د.ك', 3),
    (6, 'OMR', 'OMR', 'ر.ع', 3);

-- ── 2. COUNTRIES ─────────────────────────────────────────────
CREATE TABLE countries (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO
    countries (
        id,
        code,
        name_en,
        name_ar,
        currency_id,
        domain_prefix,
        is_active
    )
VALUES (
        1,
        'AE',
        'United Arab Emirates',
        'الإمارات العربية المتحدة',
        1,
        'ae',
        1
    ),
    (
        2,
        'SA',
        'Saudi Arabia',
        'المملكة العربية السعودية',
        2,
        'sa',
        1
    ),
    (
        3,
        'QA',
        'Qatar',
        'قطر',
        3,
        'qa',
        1
    ),
    (
        4,
        'BH',
        'Bahrain',
        'البحرين',
        4,
        'bh',
        1
    ),
    (
        5,
        'KW',
        'Kuwait',
        'الكويت',
        5,
        'kw',
        1
    ),
    (
        6,
        'OM',
        'Oman',
        'سلطنة عُمان',
        6,
        'om',
        1
    );

-- ── 3. CATEGORIES ────────────────────────────────────────────
CREATE TABLE categories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(120) NOT NULL,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    image_url VARCHAR(700) NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_category_slug (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 4. SUBCATEGORIES ─────────────────────────────────────────
CREATE TABLE subcategories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id INT UNSIGNED NOT NULL,
    slug VARCHAR(120) NOT NULL,
    name_en VARCHAR(120) NOT NULL,
    name_ar VARCHAR(120) NOT NULL,
    image_url VARCHAR(700) NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_subcategory_slug (slug),
    CONSTRAINT fk_sub_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 5. CATEGORY ↔ COUNTRY VISIBILITY ─────────────────────────
CREATE TABLE category_country (
    category_id INT UNSIGNED NOT NULL,
    country_id TINYINT UNSIGNED NOT NULL,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (category_id, country_id),
    CONSTRAINT fk_cc_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_country FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 6. PRODUCTS ──────────────────────────────────────────────
CREATE TABLE products (
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
    tags JSON NULL,
    attributes JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_fgd (fgd),
    UNIQUE KEY uq_product_slug (slug),
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories (id),
    CONSTRAINT fk_product_subcategory FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
) ENGINE = InnoDB AUTO_INCREMENT = 1001 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 7. FRAGRANCE NOTES ───────────────────────────────────────
-- One row per note tier (top / heart / base) per product.
-- Ingredients stored as JSON array; one description + one image per tier.
CREATE TABLE fragrance_notes (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 8. PRODUCT SIZES ─────────────────────────────────────────
-- For filtering/sorting only (e.g. 30ml, 50ml, 100ml).
-- Each product has multiple sizes; these are not separate products.
CREATE TABLE product_sizes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    label_en VARCHAR(60) NOT NULL,
    label_ar VARCHAR(60) NOT NULL,
    value_ml SMALLINT UNSIGNED NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_size_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 9. PRODUCT ↔ COUNTRY CONFIG ───────────────────────────────
-- Per-storefront visibility, SEO overrides, sort order.
CREATE TABLE product_country (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 10. PRODUCT PRICES ───────────────────────────────────────
-- Regular price per product per country. Independently admin-set.
-- Sale pricing is Phase 2.
CREATE TABLE product_prices (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 11. PRODUCT MEDIA ────────────────────────────────────────
-- Images/videos stored in /public/uploads/.
-- size_id = NULL means the media applies to all sizes.
CREATE TABLE product_media (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 12. PRODUCT SALES LOG ────────────────────────────────────
-- Analytics only. Pushed from external order system.
-- Used to report country-wise sales in admin dashboard.
CREATE TABLE product_sales_log (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 13. BUNDLES ──────────────────────────────────────────────
-- A bundle is itself a product. This table marks it as a bundle.
CREATE TABLE bundles (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bundle_product (product_id),
    CONSTRAINT fk_bundle_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ── 14. BUNDLE ITEMS ─────────────────────────────────────────
-- Each row is one component inside a bundle.
-- product_id = existing DB product OR NULL (standalone component).
CREATE TABLE bundle_items (
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;