-- SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Database: `centralized_db`
--

-- --------------------------------------------------------
-- Drop existing tables in reverse order of dependency
-- --------------------------------------------------------

DROP TABLE IF EXISTS `product_stock`;
DROP TABLE IF EXISTS `related_products`;
DROP TABLE IF EXISTS `product_sales_log`;
DROP TABLE IF EXISTS `product_prices`;
DROP TABLE IF EXISTS `product_media`;
DROP TABLE IF EXISTS `product_country`;
DROP TABLE IF EXISTS `fragrance_notes`;
DROP TABLE IF EXISTS `campaign_items`;
DROP TABLE IF EXISTS `bundle_items`;
DROP TABLE IF EXISTS `bundles`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `campaign_discounts`;
DROP TABLE IF EXISTS `campaign_countries`;
DROP TABLE IF EXISTS `category_country`;
DROP TABLE IF EXISTS `subcategories`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `product_labels`;
DROP TABLE IF EXISTS `product_sizes`;
DROP TABLE IF EXISTS `campaigns`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `countries`;
DROP TABLE IF EXISTS `currencies`;
DROP TABLE IF EXISTS `categories`;

-- --------------------------------------------------------
-- Table structure for table `currencies`
-- --------------------------------------------------------

CREATE TABLE `currencies` (
  `id` tinyint(3) UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` char(3) NOT NULL,
  `symbol_en` varchar(10) NOT NULL,
  `symbol_ar` varchar(10) NOT NULL,
  `decimal_places` tinyint(4) NOT NULL DEFAULT 2,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_currency_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=7;

-- --------------------------------------------------------
-- Table structure for table `countries`
-- --------------------------------------------------------

CREATE TABLE `countries` (
  `id` tinyint(3) UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` char(2) NOT NULL,
  `name_en` varchar(60) NOT NULL,
  `name_ar` varchar(60) NOT NULL,
  `currency_id` tinyint(3) UNSIGNED NOT NULL,
  `domain_prefix` varchar(5) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_country_code` (`code`),
  KEY `fk_country_currency` (`currency_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=7;

-- --------------------------------------------------------
-- Table structure for table `categories`
-- --------------------------------------------------------

CREATE TABLE `categories` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` varchar(120) NOT NULL,
  `name_en` varchar(120) NOT NULL,
  `name_ar` varchar(120) NOT NULL,
  `description_en` text DEFAULT NULL,
  `description_ar` text DEFAULT NULL,
  `image_url` varchar(700) DEFAULT NULL,
  `meta_title_en` varchar(255) DEFAULT NULL,
  `meta_title_ar` varchar(255) DEFAULT NULL,
  `meta_desc_en` varchar(500) DEFAULT NULL,
  `meta_desc_ar` varchar(500) DEFAULT NULL,
  `icon_image` varchar(700) DEFAULT NULL,
  `menu_image2` varchar(700) DEFAULT NULL,
  `mobile_image` varchar(700) DEFAULT NULL,
  `video` varchar(700) DEFAULT NULL,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `deleted_status` enum('active','bin','permanent') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_category_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=33;

-- --------------------------------------------------------
-- Table structure for table `subcategories`
-- --------------------------------------------------------

CREATE TABLE `subcategories` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` int(10) UNSIGNED NOT NULL,
  `slug` varchar(120) NOT NULL,
  `name_en` varchar(120) NOT NULL,
  `name_ar` varchar(120) NOT NULL,
  `image_url` varchar(700) DEFAULT NULL,
  `meta_title_en` varchar(255) DEFAULT NULL,
  `meta_title_ar` varchar(255) DEFAULT NULL,
  `meta_desc_en` varchar(500) DEFAULT NULL,
  `meta_desc_ar` varchar(500) DEFAULT NULL,
  `mobile_image` varchar(700) DEFAULT NULL,
  `video` varchar(700) DEFAULT NULL,
  `description_en` text DEFAULT NULL,
  `description_ar` text DEFAULT NULL,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `deleted_status` enum('active','bin','permanent') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subcategory_slug` (`slug`),
  KEY `fk_sub_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=12;

-- --------------------------------------------------------
-- Table structure for table `users`
-- --------------------------------------------------------

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(200) NOT NULL DEFAULT '',
  `role` enum('admin','user') NOT NULL DEFAULT 'user',
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_username` (`username`),
  UNIQUE KEY `uq_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=6;

-- --------------------------------------------------------
-- Table structure for table `product_labels`
-- --------------------------------------------------------

CREATE TABLE `product_labels` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name_en` varchar(100) NOT NULL,
  `name_ar` varchar(100) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `product_sizes`
-- --------------------------------------------------------

CREATE TABLE `product_sizes` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `label_en` varchar(60) NOT NULL,
  `label_ar` varchar(60) NOT NULL,
  `value_ml` smallint(5) UNSIGNED DEFAULT NULL,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=20;

-- --------------------------------------------------------
-- Table structure for table `products`
-- --------------------------------------------------------

CREATE TABLE `products` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `fgd` varchar(100) NOT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `slug` varchar(220) NOT NULL,
  `name_en` varchar(255) NOT NULL,
  `name_ar` varchar(255) NOT NULL,
  `description_en` text DEFAULT NULL,
  `description_ar` text DEFAULT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `subcategory_id` int(10) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `size_id` int(10) UNSIGNED DEFAULT NULL,
  `label_id` int(10) UNSIGNED DEFAULT NULL,
  `media_url` varchar(255) DEFAULT NULL,
  `maximum_order_quantity` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `deleted_status` enum('active','bin','permanent') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_fgd` (`fgd`),
  UNIQUE KEY `uq_product_slug` (`slug`),
  KEY `fk_product_category` (`category_id`),
  KEY `fk_product_subcategory` (`subcategory_id`),
  KEY `fk_product_size` (`size_id`),
  KEY `fk_product_label` (`label_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=219;

-- --------------------------------------------------------
-- Table structure for table `audit_logs`
-- --------------------------------------------------------

CREATE TABLE `audit_logs` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `action` enum('create','update','delete','login','logout') NOT NULL,
  `module` varchar(60) NOT NULL,
  `target_id` varchar(100) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_module` (`module`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=165;

-- --------------------------------------------------------
-- Table structure for table `bundles`
-- --------------------------------------------------------

CREATE TABLE `bundles` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` int(10) UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bundle_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2;

-- --------------------------------------------------------
-- Table structure for table `bundle_items`
-- --------------------------------------------------------

CREATE TABLE `bundle_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `bundle_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED DEFAULT NULL,
  `component_name_en` varchar(255) DEFAULT NULL,
  `component_name_ar` varchar(255) DEFAULT NULL,
  `component_image_url` varchar(700) DEFAULT NULL,
  `qty` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `fk_bitem_bundle` (`bundle_id`),
  KEY `fk_bitem_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=4;

-- --------------------------------------------------------
-- Table structure for table `campaigns`
-- --------------------------------------------------------

CREATE TABLE `campaigns` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name_en` varchar(255) NOT NULL,
  `name_ar` varchar(255) DEFAULT NULL,
  `type` enum('discount','bxgy','foc') NOT NULL DEFAULT 'discount',
  `status` enum('draft','scheduled','active','paused','expired','archived') NOT NULL DEFAULT 'draft',
  `priority` smallint(6) NOT NULL DEFAULT 100,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `is_all_products` tinyint(1) NOT NULL DEFAULT 0,
  `is_stackable` tinyint(1) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_campaign_status` (`status`),
  KEY `idx_campaign_dates` (`start_at`,`end_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=3;

-- --------------------------------------------------------
-- Table structure for table `campaign_countries`
-- --------------------------------------------------------

CREATE TABLE `campaign_countries` (
  `campaign_id` int(10) UNSIGNED NOT NULL,
  `country_id` tinyint(3) UNSIGNED NOT NULL,
  PRIMARY KEY (`campaign_id`,`country_id`),
  KEY `fk_cc_v2_country` (`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `campaign_discounts`
-- --------------------------------------------------------

CREATE TABLE `campaign_discounts` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id` int(10) UNSIGNED NOT NULL,
  `discount_type` enum('percentage','fixed') NOT NULL,
  `discount_value` decimal(12,3) NOT NULL,
  `min_price_floor` decimal(12,3) NOT NULL DEFAULT 0.000,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cd_v2_campaign` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=6;

-- --------------------------------------------------------
-- Table structure for table `campaign_items`
-- --------------------------------------------------------

CREATE TABLE `campaign_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `discount_type` enum('percentage','fixed') DEFAULT NULL,
  `discount_value` decimal(12,3) DEFAULT NULL,
  `is_excluded` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ci_v2_campaign_product` (`campaign_id`,`product_id`),
  KEY `fk_ci_v2_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=17;

-- --------------------------------------------------------
-- Table structure for table `category_country`
-- --------------------------------------------------------

CREATE TABLE `category_country` (
  `category_id` int(10) UNSIGNED NOT NULL,
  `country_id` tinyint(3) UNSIGNED NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`category_id`,`country_id`),
  KEY `fk_cc_country` (`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `fragrance_notes`
-- --------------------------------------------------------

CREATE TABLE `fragrance_notes` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` int(10) UNSIGNED NOT NULL,
  `note_type` enum('top','heart','base') NOT NULL,
  `ingredients_en` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ingredients_en`)),
  `ingredients_ar` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ingredients_ar`)),
  `description_en` text DEFAULT NULL,
  `description_ar` text DEFAULT NULL,
  `image_url` varchar(700) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_note_type` (`product_id`,`note_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=632;

-- --------------------------------------------------------
-- Table structure for table `product_country`
-- --------------------------------------------------------

CREATE TABLE `product_country` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` int(10) UNSIGNED NOT NULL,
  `country_id` tinyint(3) UNSIGNED NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `slug_override` varchar(220) DEFAULT NULL,
  `meta_title_en` varchar(255) DEFAULT NULL,
  `meta_title_ar` varchar(255) DEFAULT NULL,
  `meta_desc_en` varchar(500) DEFAULT NULL,
  `meta_desc_ar` varchar(500) DEFAULT NULL,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_country` (`product_id`,`country_id`),
  KEY `fk_pc_country` (`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1549;

-- --------------------------------------------------------
-- Table structure for table `product_media`
-- --------------------------------------------------------

CREATE TABLE `product_media` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` int(10) UNSIGNED NOT NULL,
  `size_id` int(10) UNSIGNED DEFAULT NULL,
  `url` varchar(700) NOT NULL,
  `alt_en` varchar(255) DEFAULT NULL,
  `alt_ar` varchar(255) DEFAULT NULL,
  `media_type` enum('image','video') NOT NULL DEFAULT 'image',
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_media_product` (`product_id`),
  KEY `fk_media_size` (`size_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `product_prices`
-- --------------------------------------------------------

CREATE TABLE `product_prices` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` int(10) UNSIGNED NOT NULL,
  `country_id` tinyint(3) UNSIGNED NOT NULL,
  `currency_id` tinyint(3) UNSIGNED NOT NULL,
  `regular_price` decimal(12,3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_price_product_country` (`product_id`,`country_id`),
  KEY `fk_price_country` (`country_id`),
  KEY `fk_price_currency` (`currency_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1411;

-- --------------------------------------------------------
-- Table structure for table `product_sales_log`
-- --------------------------------------------------------

CREATE TABLE `product_sales_log` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` int(10) UNSIGNED NOT NULL,
  `country_id` tinyint(3) UNSIGNED NOT NULL,
  `qty_sold` smallint(5) UNSIGNED NOT NULL DEFAULT 1,
  `unit_price` decimal(12,3) DEFAULT NULL,
  `currency_id` tinyint(3) UNSIGNED DEFAULT NULL,
  `sold_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `order_ref` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sales_product` (`product_id`),
  KEY `idx_sales_country` (`country_id`),
  KEY `idx_sales_sold_at` (`sold_at`),
  KEY `fk_sales_currency` (`currency_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `product_stock`
-- --------------------------------------------------------

CREATE TABLE `product_stock` (
  `product_id` int(10) UNSIGNED NOT NULL,
  `country_id` tinyint(3) UNSIGNED NOT NULL,
  `quantity` int(11) DEFAULT 0,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`product_id`,`country_id`),
  KEY `idx_stock_country` (`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `related_products`
-- --------------------------------------------------------

CREATE TABLE `related_products` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` int(10) UNSIGNED NOT NULL,
  `related_product_id` int(10) UNSIGNED NOT NULL,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_related_product` (`product_id`,`related_product_id`),
  KEY `idx_related_target` (`related_product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Dumping data for lookup tables
-- --------------------------------------------------------

INSERT INTO `currencies` (`id`, `code`, `symbol_en`, `symbol_ar`, `decimal_places`) VALUES
(1, 'AED', 'AED', 'د.إ', 2),
(2, 'SAR', 'SAR', 'ر.س', 2),
(3, 'QAR', 'QAR', 'ر.ق', 2),
(4, 'BHD', 'BHD', 'د.ب', 3),
(5, 'KWD', 'KWD', 'د.ك', 3),
(6, 'OMR', 'OMR', 'ر.ع', 3);

INSERT INTO `countries` (`id`, `code`, `name_en`, `name_ar`, `currency_id`, `domain_prefix`, `is_active`) VALUES
(1, 'AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 1, 'ae', 1),
(2, 'SA', 'Saudi Arabia', 'المملكة العربية السعودية', 2, 'sa', 1),
(3, 'QA', 'Qatar', 'قطر', 3, 'qa', 1),
(4, 'BH', 'Bahrain', 'البحرين', 4, 'bh', 1),
(5, 'KW', 'Kuwait', 'الكويت', 5, 'kw', 1),
(6, 'OM', 'Oman', 'سلطنة عُمان', 6, 'om', 1);

INSERT INTO `product_labels` (`id`, `name_en`, `name_ar`, `image_url`, `sort_order`) VALUES
(1, 'Hot', 'حار مبيعاً', 'hot-selling-1.png', 1),
(2, 'New', 'جديد', 'new-arrival.png', 2),
(3, 'Sale', 'تخفيضات', 'sale.png', 3);

INSERT INTO `product_sizes` (`id`, `label_en`, `label_ar`, `value_ml`, `sort_order`) VALUES
(1, '15ML', '١٥ مل', 15, 1),
(2, '30ML', '٣٠ مل', 30, 2),
(3, '50ML', '٥٠ مل', 50, 3),
(4, '60ML', '٦٠ مل', 60, 4),
(5, '75ML', '٧٥ مل', 75, 5),
(6, '100ML', '١٠٠ مل', 100, 6),
(7, '150ML', '١٥٠ مل', 150, 7),
(8, '200ML', '٢٠٠ مل', 200, 8);

-- --------------------------------------------------------
-- Constraints for all tables
-- --------------------------------------------------------

-- audit_logs
ALTER TABLE `audit_logs` ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- bundles
ALTER TABLE `bundles` ADD CONSTRAINT `fk_bundle_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

-- bundle_items
ALTER TABLE `bundle_items` 
  ADD CONSTRAINT `fk_bitem_bundle` FOREIGN KEY (`bundle_id`) REFERENCES `bundles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bitem_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;

-- campaigns
ALTER TABLE `campaign_countries` 
  ADD CONSTRAINT `fk_cc_v2_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cc_v2_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE;

ALTER TABLE `campaign_discounts` ADD CONSTRAINT `fk_cd_v2_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE;

ALTER TABLE `campaign_items` 
  ADD CONSTRAINT `fk_ci_v2_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ci_v2_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

-- categories/subcategories/countries
ALTER TABLE `category_country` 
  ADD CONSTRAINT `fk_cc_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cc_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE;

ALTER TABLE `subcategories` ADD CONSTRAINT `fk_sub_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);

ALTER TABLE `countries` ADD CONSTRAINT `fk_country_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`);

-- products
ALTER TABLE `products` 
  ADD CONSTRAINT `fk_product_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  ADD CONSTRAINT `fk_product_subcategory` FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories` (`id`),
  ADD CONSTRAINT `fk_product_size` FOREIGN KEY (`size_id`) REFERENCES `product_sizes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_product_label` FOREIGN KEY (`label_id`) REFERENCES `product_labels` (`id`) ON DELETE SET NULL;

ALTER TABLE `fragrance_notes` ADD CONSTRAINT `fk_note_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

ALTER TABLE `product_country` 
  ADD CONSTRAINT `fk_pc_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pc_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

ALTER TABLE `product_media` 
  ADD CONSTRAINT `fk_media_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_media_size` FOREIGN KEY (`size_id`) REFERENCES `product_sizes` (`id`) ON DELETE SET NULL;

ALTER TABLE `product_prices` 
  ADD CONSTRAINT `fk_price_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`),
  ADD CONSTRAINT `fk_price_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`),
  ADD CONSTRAINT `fk_price_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

ALTER TABLE `product_sales_log` 
  ADD CONSTRAINT `fk_sales_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`),
  ADD CONSTRAINT `fk_sales_currency` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`),
  ADD CONSTRAINT `fk_sales_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

ALTER TABLE `product_stock` 
  ADD CONSTRAINT `fk_stock_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_stock_country` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE;

-- related_products
ALTER TABLE `related_products`
  ADD CONSTRAINT `fk_related_base` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_related_target` FOREIGN KEY (`related_product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
