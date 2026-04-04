-- ============================================================
-- Ahmed Al Maghribi – Centralized Product Platform
-- NEW Campaign Discounts Schema (v2.0)
-- ============================================================

USE centralized_db;

-- ── 1. CAMPAIGNS ─────────────────────────────────────────────
CREATE TABLE campaigns (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name_en         VARCHAR(255) NOT NULL,
    name_ar         VARCHAR(255) NULL,
    type            ENUM('discount','bxgy','foc') NOT NULL DEFAULT 'discount',
    status          ENUM('draft','scheduled','active','paused','expired','archived') NOT NULL DEFAULT 'draft',
    priority        SMALLINT NOT NULL DEFAULT 100,
    start_at        DATETIME NOT NULL,
    end_at          DATETIME NOT NULL,
    is_all_products TINYINT(1) NOT NULL DEFAULT 0,
    is_stackable    TINYINT(1) NOT NULL DEFAULT 0,
    notes           TEXT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_campaign_status (status),
    KEY idx_campaign_dates (start_at, end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. CAMPAIGN ↔ COUNTRY ────────────────────────────────────
CREATE TABLE campaign_countries (
    campaign_id     INT UNSIGNED NOT NULL,
    country_id      TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (campaign_id, country_id),
    CONSTRAINT fk_cc_v2_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_v2_country  FOREIGN KEY (country_id)  REFERENCES countries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. CAMPAIGN BASE DISCOUNTS ────────────────────────────────
-- Stores the default rule for 'discount' type campaigns
CREATE TABLE campaign_discounts (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    discount_type   ENUM('percentage','fixed') NOT NULL,
    discount_value  DECIMAL(12,3) NOT NULL,
    min_price_floor DECIMAL(12,3) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cd_v2_campaign (campaign_id),
    CONSTRAINT fk_cd_v2_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. CAMPAIGN ITEMS (Overrides/Exclusions/Selection) ────────
CREATE TABLE campaign_items (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    discount_type   ENUM('percentage','fixed') NULL,
    discount_value  DECIMAL(12,3) NULL,
    is_excluded     TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ci_v2_campaign_product (campaign_id, product_id),
    CONSTRAINT fk_ci_v2_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_v2_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
