-- ============================================================
-- Ahmed Al Maghribi – Centralized Product Platform
-- Schema v1.1  |  Campaign Management Module
-- ============================================================

USE centralized_db;

-- ── 15. CAMPAIGNS ─────────────────────────────────────────────
-- Master campaign record — one per promotion
CREATE TABLE campaigns (
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
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_campaign_status (status),
    KEY idx_campaign_dates (start_at, end_at),
    KEY idx_campaign_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 16. CAMPAIGN ↔ COUNTRY ────────────────────────────────────
CREATE TABLE campaign_countries (
    campaign_id     INT UNSIGNED NOT NULL,
    country_id      TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (campaign_id, country_id),
    CONSTRAINT fk_cc2_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_cc2_country  FOREIGN KEY (country_id)  REFERENCES countries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 17. CAMPAIGN SCOPE ────────────────────────────────────────
-- Defines WHAT the campaign applies to
CREATE TABLE campaign_scope (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    scope_type      ENUM('all','category','subcategory','product') NOT NULL,
    scope_ref_id    INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_scope_campaign (campaign_id),
    CONSTRAINT fk_scope_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 18. DISCOUNT RULES ────────────────────────────────────────
CREATE TABLE campaign_discount_rules (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    discount_type   ENUM('percentage','fixed') NOT NULL,
    discount_value  DECIMAL(12,3) NOT NULL,
    min_price       DECIMAL(12,3) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_discount_campaign (campaign_id),
    CONSTRAINT fk_dr_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 19. PER-PRODUCT DISCOUNT OVERRIDES ────────────────────────
CREATE TABLE campaign_product_overrides (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    discount_type   ENUM('percentage','fixed') NOT NULL,
    discount_value  DECIMAL(12,3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_override (campaign_id, product_id),
    CONSTRAINT fk_po_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 20. BXGY RULES ────────────────────────────────────────────
CREATE TABLE campaign_bxgy_rules (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 21. BXGY PRODUCT LISTS ────────────────────────────────────
CREATE TABLE campaign_bxgy_products (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    list_type       ENUM('buy','get') NOT NULL,
    PRIMARY KEY (id),
    KEY idx_bxgy_campaign (campaign_id, list_type),
    CONSTRAINT fk_bxgyp_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_bxgyp_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 22. FOC RULES ─────────────────────────────────────────────
CREATE TABLE campaign_foc_rules (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id         INT UNSIGNED NOT NULL,
    cart_min            DECIMAL(12,3) NOT NULL,
    cart_max            DECIMAL(12,3) NULL,
    selection_mode      ENUM('auto','choose') NOT NULL DEFAULT 'auto',
    max_free_items      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_foc_campaign (campaign_id),
    CONSTRAINT fk_foc_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 23. FOC PRODUCT LIST ──────────────────────────────────────
CREATE TABLE campaign_foc_products (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    KEY idx_foc_campaign (campaign_id),
    CONSTRAINT fk_focp_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_focp_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 24. CAMPAIGN HISTORY LOG ──────────────────────────────────
CREATE TABLE campaign_history (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id     INT UNSIGNED NOT NULL,
    action          ENUM('created','updated','activated','paused','expired','archived') NOT NULL,
    changed_by      VARCHAR(100) NULL,
    details         JSON NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_history_campaign (campaign_id),
    CONSTRAINT fk_hist_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
