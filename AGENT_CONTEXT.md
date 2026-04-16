# Agent Context — `ahmed-admin-centralized`

> **Purpose:** This file is the single source of truth for AI agents working on this codebase.
> It covers the database schema, every available admin API endpoint, and the frontend API utility layer.
> All routes live under `/api/` and are **JWT-authenticated**. The token is sent as a `Bearer` header.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express (ESM) |
| Database | MySQL (MariaDB — `centralized_db`) |
| Frontend | React + Vite |
| HTTP Client | Axios (`frontend/src/api/client.js`) → base URL `/api` |
| Auth | JWT — all routes require `Authorization: Bearer <token>` |

---

## 2. Database Schema

### 2.1 Reference Tables (rarely change)

#### `countries`
| Column | Type | Notes |
|---|---|---|
| `id` | tinyint UNSIGNED PK | 1=AE, 2=SA, 3=QA, 4=BH, 5=KW, 6=OM |
| `code` | char(2) | `AE`, `SA`, `QA`, `BH`, `KW`, `OM` |
| `name_en` / `name_ar` | varchar(60) | |
| `currency_id` | tinyint FK → `currencies.id` | |
| `domain_prefix` | varchar(5) | `ae`, `sa`, etc. |
| `is_active` | tinyint(1) | |

#### `currencies`
| Column | Type | Notes |
|---|---|---|
| `id` | tinyint UNSIGNED PK | 1=AED, 2=SAR, 3=QAR, 4=BHD, 5=KWD, 6=OMR |
| `code` | char(3) | |
| `symbol_en` / `symbol_ar` | varchar(10) | |
| `decimal_places` | tinyint | 2 for AED/SAR/QAR, 3 for BHD/KWD/OMR |

#### `product_sizes`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK | Seeded: 1=15ML … 8=200ML |
| `label_en` / `label_ar` | varchar(60) | |
| `value_ml` | smallint | numeric ml value |
| `sort_order` | smallint | |

#### `product_labels`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK | Seeded: 1=Hot, 2=New, 3=Sale |
| `name_en` / `name_ar` | varchar(100) | |
| `image_url` | varchar(255) | filename only (e.g. `hot-selling-1.png`) |
| `sort_order` | smallint | |

---

### 2.2 Core Content Tables

#### `categories`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `slug` | varchar(120) UNIQUE | |
| `name_en` / `name_ar` | varchar(120) | |
| `description_en` / `description_ar` | text | |
| `image_url`, `icon_image`, `menu_image2`, `mobile_image`, `video` | varchar(700) | media fields |
| `meta_title_en/ar`, `meta_desc_en/ar` | varchar | SEO fields |
| `sort_order` | smallint | |
| `is_active` | tinyint(1) | |
| `deleted_status` | enum(`active`,`bin`,`permanent`) | [DEPRECATED] System now performs hard DELETEs. |
| `created_at`, `updated_at` | timestamp | |

#### `subcategories`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `category_id` | int FK → `categories.id` | |
| `slug` | varchar(120) UNIQUE | |
| `name_en` / `name_ar` | varchar(120) | |
| `description_en/ar`, `image_url`, `mobile_image`, `video` | | |
| `meta_title_en/ar`, `meta_desc_en/ar` | varchar | SEO |
| `sort_order`, `is_active` | | |
| `deleted_status` | enum(`active`,`bin`,`permanent`) | [DEPRECATED] Subcategories are hard deleted with category. |

#### `category_country`
| Column | Type | Notes |
|---|---|---|
| `category_id` | int FK → `categories.id` | PK composite |
| `country_id` | tinyint FK → `countries.id` | PK composite |
| `is_visible` | tinyint(1) | controls storefront visibility per country |

---

### 2.3 Product Tables

#### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `fgd` | varchar(100) UNIQUE | internal product code / SKU |
| `barcode` | varchar(100) nullable | |
| `slug` | varchar(220) UNIQUE | |
| `name_en` / `name_ar` | varchar(255) | |
| `description_en` / `description_ar` | text | |
| `category_id` | int FK → `categories.id` | required |
| `subcategory_id` | int FK → `subcategories.id` | nullable |
| `is_active` | tinyint(1) default 1 | global active flag |
| `is_featured` | tinyint(1) default 0 | |
| `tags` | JSON (longtext) | array of strings |
| `attributes` | JSON (longtext) | key-value object |
| `size_id` | int FK → `product_sizes.id` nullable | |
| `label_id` | int FK → `product_labels.id` nullable | |
| `maximum_order_quantity` | int(10) UNSIGNED | Max items per order (0=unlimited) |
| `media_url` | varchar(255) | legacy/primary image field |
| `deleted_status` | enum(`active`,`bin`,`permanent`) | [DEPRECATED] System performs hard DELETEs in transactions. |
| `created_at`, `updated_at` | timestamp | |

#### `product_country`
Per-country visibility and SEO overrides for a product.
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `product_id` | int FK → `products.id` | UNIQUE with `country_id` |
| `country_id` | tinyint FK → `countries.id` | |
| `is_visible` | tinyint(1) default 1 | per-country visibility toggle |
| `slug_override` | varchar(220) | country-specific URL slug |
| `meta_title_en/ar` | varchar(255) | |
| `meta_desc_en/ar` | varchar(500) | |
| `sort_order` | smallint | |

#### `product_prices`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `product_id` | int FK → `products.id` | UNIQUE with `country_id` |
| `country_id` | tinyint FK → `countries.id` | |
| `currency_id` | tinyint FK → `currencies.id` | |
| `regular_price` | decimal(12,3) | |

#### `product_media`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `product_id` | int FK → `products.id` | |
| `size_id` | int FK → `product_sizes.id` nullable | size-specific image |
| `url` | varchar(700) | relative path e.g. `/uploads/products/1/img.jpg` |
| `alt_en` / `alt_ar` | varchar(255) | |
| `media_type` | enum(`image`,`video`) | |
| `is_primary` | tinyint(1) | only one should be 1 per product |
| `sort_order` | smallint | |
| `created_at` | timestamp | |

#### `product_stock`
| Column | Type | Notes |
|---|---|---|
| `product_id` | int FK → `products.id` | PK composite |
| `country_id` | tinyint FK → `countries.id` | PK composite |
| `quantity` | int default 0 | |
| `updated_at` | timestamp | |

#### `product_sales_log`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `product_id` | int FK → `products.id` | |
| `country_id` | tinyint FK → `countries.id` | |
| `qty_sold` | smallint default 1 | |
| `unit_price` | decimal(12,3) nullable | |
| `currency_id` | tinyint FK → `currencies.id` nullable | |
| `sold_at` | timestamp | |
| `order_ref` | varchar(100) nullable | external order reference |

#### `fragrance_notes`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `product_id` | int FK → `products.id` | UNIQUE with `note_type` |
| `note_type` | enum(`top`,`heart`,`base`) | |
| `ingredients_en` / `ingredients_ar` | JSON (longtext) | array of ingredient strings |
| `description_en` / `description_ar` | text | |
| `image_url` | varchar(700) | |

#### `related_products`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT | |
| `product_id` | int FK → `products.id` | Base product |
| `related_product_id` | int FK → `products.id` | Target related product |
| `sort_order` | smallint | |

---

### 2.4 Bundle Tables

#### `bundles`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `product_id` | int FK → `products.id` UNIQUE | the parent bundle product |

#### `bundle_items`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `bundle_id` | int FK → `bundles.id` | |
| `product_id` | int FK → `products.id` nullable | linked product (null = standalone) |
| `component_name_en` / `component_name_ar` | varchar(255) | used when standalone |
| `component_image_url` | varchar(700) | standalone image |
| `qty` | tinyint default 1 | |
| `sort_order` | smallint | |

---

### 2.5 Campaign Tables

#### `campaigns`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `name_en` / `name_ar` | varchar(255) | |
| `type` | enum(`discount`,`bxgy`,`foc`) | discount type |
| `status` | enum(`draft`,`scheduled`,`active`,`paused`,`expired`,`archived`) | |
| `priority` | smallint default 100 | lower = higher priority |
| `start_at` / `end_at` | datetime | |
| `is_all_products` | tinyint(1) | apply to all active products |
| `is_stackable` | tinyint(1) | can stack with other campaigns |
| `notes` | text | |
| `created_at`, `updated_at` | timestamp | |

> **Computed `effective_status`** (not stored, calculated at query time):
> `archived` → `draft` → `scheduled` (future) → `expired` (past end_at) → `active`

#### `campaign_countries`
| Column | Type | Notes |
|---|---|---|
| `campaign_id` | int FK → `campaigns.id` | PK composite |
| `country_id` | tinyint FK → `countries.id` | PK composite |

#### `campaign_discounts`
One-to-one with campaign. The base discount rule.
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `campaign_id` | int FK → `campaigns.id` UNIQUE | |
| `discount_type` | enum(`percentage`,`fixed`) | |
| `discount_value` | decimal(12,3) | |
| `min_price_floor` | decimal(12,3) default 0 | minimum price after discount |

#### `campaign_items`
Per-product overrides or exclusions within a campaign.
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `campaign_id` | int FK → `campaigns.id` | UNIQUE with `product_id` |
| `product_id` | int FK → `products.id` | |
| `discount_type` | enum(`percentage`,`fixed`) nullable | overrides base if set |
| `discount_value` | decimal(12,3) nullable | |
| `is_excluded` | tinyint(1) default 0 | exclude this product from campaign |

---

### 2.6 System Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `username` | varchar(100) UNIQUE | |
| `email` | varchar(255) UNIQUE | |
| `password_hash` | varchar(255) | bcrypt hashed |
| `full_name` | varchar(200) | |
| `role` | enum(`admin`,`user`) | `admin` = superadmin |
| `permissions` | JSON array | module keys e.g. `["products","categories","campaigns"]` |
| `is_active` | tinyint(1) | |
| `created_at`, `updated_at` | timestamp | |

> **Permission keys:** `users`, `audit_logs`, `categories`, `products`, `pricing`,
> `media`, `bundles`, `sales`, `gallery`, `analytics`, `campaigns`

#### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | int UNSIGNED PK AUTO_INCREMENT |  |
| `user_id` | int FK → `users.id` SET NULL on delete | nullable (system actions) |
| `action` | enum(`create`,`update`,`delete`,`login`,`logout`) | |
| `module` | varchar(60) | e.g. `products`, `categories`, `users` |
| `target_id` | varchar(100) | ID of the affected record |
| `details` | JSON (longtext) | arbitrary change details |
| `ip_address` | varchar(45) | client IP |
| `created_at` | timestamp | |

---

## 3. Admin API Reference

**Base URL:** `http://localhost:<PORT>/api`  
**Auth:** All routes require `Authorization: Bearer <jwt_token>`  
**Response envelope:** Most endpoints return `{ data: ... }` or `{ data: ..., meta: ... }` or `{ message: "..." }`

> **Permission guard:** Each module route uses `authorize('<permission_key>')`. Users must have the key in their `permissions` JSON array, or be `role=admin` (superadmin bypasses all).

---

### 3.1 Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Login with `{ username, password }` → returns JWT token |
| `GET` | `/auth/me` | Returns current user info from JWT |

---

### 3.2 Users — `authorize('users')`

| Method | Path | Body / Params | Response |
|---|---|---|---|
| `GET` | `/users` | — | `{ data: User[] }` — includes parsed `permissions` array |
| `GET` | `/users/:id` | — | `{ data: User }` |
| `POST` | `/users` | `{ username, email, password, full_name?, role?, permissions? }` | `{ data: { id }, message }` |
| `PUT` | `/users/:id` | `{ username, email, full_name?, role?, permissions?, is_active? }` | `{ message }` |
| `PUT` | `/users/:id/password` | `{ password }` (min 6 chars) | `{ message }` |
| `DELETE` | `/users/:id` | — | Soft-delete (sets `is_active=0`). Cannot deactivate self. |
| `DELETE` | `/users/:id/hard` | — | Hard-delete. Only `role=admin` can do this. Cannot delete self. |

---

### 3.3 Audit Logs — `authorize('audit_logs')`

| Method | Path | Query Params | Response |
|---|---|---|---|
| `GET` | `/audit-logs` | `page`, `limit`, `user_id`, `module`, `action`, `from` (date), `to` (date) | `{ data: Log[], pagination: { page, limit, total, totalPages } }` |

---

### 3.4 Countries (no module guard — any authenticated user)

| Method | Path | Response |
|---|---|---|
| `GET` | `/countries` | `{ data: Country[] }` — includes `currency_code`, `symbol_en/ar`, `decimal_places` |
| `GET` | `/countries/:id` | `{ data: Country }` |

---

### 3.5 Categories — `authorize('categories')`

| Method | Path | Query / Body | Response |
|---|---|---|---|
| `GET` | `/categories` | `?country=AE&admin=1&status=active\|bin` | `{ data: Category[] }`. With `admin=1`, each category has `.subcategories[]` |
| `GET` | `/categories/:id` | — | `{ data: { ...category, subcategories[] } }` |
| `POST` | `/categories` | `{ slug, name_en, name_ar, description_en?, description_ar?, image_url?, sort_order?, is_active? }` | `{ data: { id } }` |
| `PUT` | `/categories/reorder` | `{ items: [{ id, sort_order }] }` | `{ message }` |
| `PUT` | `/categories/:id` | Same fields as POST | `{ message }` |
| `DELETE` | `/categories/:id` | — | **Permanent delete** category and its subcategories using a transaction. |
| `GET` | `/categories/template` | — | Downloads `.xlsx` import template |
| `POST` | `/categories/import?dry_run=true\|false` | `multipart/form-data` with `file` (`.xlsx`) | `{ dry_run, summary: { inserted, skipped, errors }, results[] }` |

**Subcategory routes (under `/categories`):**

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/categories/:id/subcategories` | `{ slug, name_en, name_ar, description_en?, description_ar?, image_url?, sort_order? }` | `{ data: { id } }` |
| `PUT` | `/categories/subcategories/reorder` | `{ items: [{ id, sort_order, category_id }] }` | `{ message }` |
| `PUT` | `/categories/subcategories/:subId` | `{ slug, name_en, name_ar, ..., is_active? }` | `{ message }` |
| `DELETE` | `/categories/subcategories/:subId` | — | **Permanent delete** subcategory. |

---

### 3.6 Products — `authorize('products')`

**List endpoint response shape:**
```json
{
  "data": [ Product ],
  "meta": { "total": 0, "page": 1, "limit": 20, "pages": 1 }
}
```

**Single product response shape** (from `buildProduct()`):
```json
{
  "id": 1, "fgd": "SKU001", "slug": "...", "name_en": "...", "name_ar": "...",
  "category_id": 1, "category_name_en": "...", "category_name_ar": "...",
  "subcategory_id": null, "sub_name_en": null, "sub_name_ar": null,
  "size_id": 3, "size_label_en": "50ML", "size_label_ar": "...",
  "label_id": 1, "label_name_en": "Hot", "label_name_ar": "...", "label_image_url": "...",
  "is_active": 1, "is_featured": 0, "tags": [], "attributes": {},
  "deleted_status": "active",
  "fragrance_notes": [ { "note_type": "top", "ingredients_en": [], "ingredients_ar": [], ... } ],
  "price": { "regular_price": "...", "currency_code": "AED", "symbol_en": "AED", ... },
  "media": [ { "id": 1, "url": "...", "is_primary": 1, "media_type": "image", ... } ],
  "stock": [ { "country_id": 1, "country_code": "AE", "quantity": 100 } ],
  "country_visibility": 1,
  "country_slug": null,
  "related_products": []
}
```

| Method | Path | Query / Body | Response |
|---|---|---|---|
| `GET` | `/products` | `?country=AE&category=1&subcategory=2&featured=1&search=xyz&page=1&limit=20&sort=id&order=DESC&admin=1&status=active\|bin` | `{ data: Product[], meta }` |
| `GET` | `/products/:id` | `?country=AE` | `{ data: Product }` |
| `POST` | `/products` | `{ fgd, slug, name_en, name_ar, description_en?, description_ar?, category_id, subcategory_id?, barcode?, is_active?, is_featured?, tags?, attributes?, size_id?, label_id?, fragrance_notes?, country_configs?, prices?, stock? }` | `{ data: { id } }` |
| `PUT` | `/products/:id` | Same scalar fields as POST (not notes/prices/stock — use sub-routes) | `{ message }` |
| `PATCH` | `/products/:id/toggle` | `?country=AE` (optional) | Toggles `is_active` globally, or `is_visible` for the country |
| `DELETE` | `/products/:id` | — | **Permanent delete** product. Transactionally cleans up `bundle_items`, `product_sales_log`, media, and notes. |

**Product sub-routes:**

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/products/:id/notes` | — | `{ data: FragranceNote[] }` ordered top→heart→base |
| `PUT` | `/products/:id/notes` | `{ notes: [{ note_type, ingredients_en, ingredients_ar, description_en?, description_ar?, image_url? }] }` | `{ message }` — upserts all 3 |
| `GET` | `/products/:id/countries` | — | `{ data: ProductCountry[] }` with `country_code`, `country_name` |
| `PUT` | `/products/:id/visibility` | `{ visibility: [{ country_id, is_visible }] }` | `{ message }` |
| `PUT` | `/products/:id/seo` | `{ seo: [{ country_id, slug_override?, meta_title_en?, meta_title_ar?, meta_desc_en?, meta_desc_ar?, sort_order? }] }` | `{ message }` |
| `GET` | `/products/:id/stock` | — | `{ data: Stock[] }` with `country_code`, `country_name` |
| `PUT` | `/products/:id/stock` | `{ stocks: [{ country_id, quantity }] }` | `{ message }` |
| `PUT` | `/products/:id/related` | `{ related_products: [{ related_product_id }] }` | `{ message }` — replaces all |

---

### 3.7 Pricing — `authorize('pricing')`

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/pricing/:productId` | — | `{ data: Price[] }` — includes `country_code`, `currency_code`, `symbol_en`, `decimal_places` |
| `PUT` | `/pricing/:productId` | `{ prices: [{ country_id, currency_id, regular_price }] }` | `{ message }` — upserts all at once |
| `PATCH` | `/pricing/:productId/country/:countryId` | `{ currency_id, regular_price }` | `{ message }` — single country update |

---

### 3.8 Media — `authorize('products')`

| Method | Path | Query / Body | Response |
|---|---|---|---|
| `GET` | `/media/:productId` | — | `{ data: Media[] }` ordered by `is_primary DESC, sort_order` |
| `POST` | `/media/upload` | `?type=product&product_id=1` + `multipart/form-data` with `file` (jpeg/png/webp/gif/mp4, max 10MB). Optional body: `size_id, alt_en, alt_ar, is_primary, sort_order` | `{ data: { id, url } }` |
| `POST` | `/media/link` | `{ product_id, url, size_id?, alt_en?, alt_ar?, is_primary?, sort_order? }` | `{ data: { id, url } }` — links existing gallery image |
| `DELETE` | `/media/:mediaId` | — | `{ message }` — removes DB record only (file kept on disk) |
| `PATCH` | `/media/:mediaId/sort` | `{ sort_order, is_primary }` | `{ message }` |
| `PATCH` | `/media/:mediaId/primary` | — | Sets this media as primary; clears others for same product |

---

### 3.9 Product Sizes — `authorize('products')`

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/sizes` | — | `{ data: Size[] }` — `{ id, label_en, label_ar, value_ml, sort_order }` |
| `POST` | `/sizes` | `{ label_en, label_ar?, value_ml?, sort_order? }` | `{ data: { id, label_en, label_ar, value_ml, sort_order } }` |

---

### 3.10 Product Labels — `authorize('products')`

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/labels` | — | `{ data: Label[] }` — `{ id, name_en, name_ar, image_url, sort_order }` |
| `POST` | `/labels` | `{ name_en, name_ar, image_url?, sort_order? }` | `{ data: { id, name_en, name_ar, image_url, sort_order } }` |

---

### 3.11 Bundles — `authorize('bundles')`

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/bundles` | — | `{ data: Bundle[] }` — each bundle has `.items[]` |
| `GET` | `/bundles/:productId` | — | `{ data: { bundle_id, ...product, items[] } }` |
| `POST` | `/bundles` | `{ product_id, items: [{ product_id?, component_name_en?, component_name_ar?, component_image_url?, qty?, sort_order? }] }` | `{ data: { bundle_id } }` |
| `PUT` | `/bundles/:bundleId/items` | `{ items: [...] }` | `{ message }` — replaces all items |
| `DELETE` | `/bundles/:productId` | — | `{ message }` — removes bundle |

> **Bundle item types:**
> - **Linked:** `product_id` is set, names/image may be null (pulled from products table)
> - **Standalone:** `product_id` is null, `component_name_en/ar` and `component_image_url` required

---

### 3.12 Sales — `authorize('sales')`

| Method | Path | Body / Params | Response |
|---|---|---|---|
| `POST` | `/sales/log` | `{ product_id, country_id, qty_sold?, unit_price?, currency_id?, sold_at?, order_ref? }` | `{ message }` |
| `POST` | `/sales/log/bulk` | `{ records: [{ product_id, country_id, qty_sold?, unit_price?, currency_id?, sold_at?, order_ref? }] }` | `{ message }` |
| `GET` | `/sales/report` | `?country=AE&product_id=1&from=2025-01-01&to=2025-12-31` | `{ data: SalesReport[] }` — grouped by product+country |

---

### 3.13 Analytics — `authorize('analytics')`

All analytics endpoints read from `ec_orders` and `ec_order_product` tables (external e-commerce DB).
Date range params: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD).

| Method | Path | Params | Response shape |
|---|---|---|---|
| `GET` | `/analytics/summary` | `from, to` | `{ data: { total_orders, total_revenue, total_tax, avg_order_value, total_customers } }` |
| `GET` | `/analytics/monthly-sales` | `from, to, year` | `{ data: [{ month, order_count, revenue }] }` |
| `GET` | `/analytics/order-status` | `from, to` | `{ data: [{ status, count }] }` |
| `GET` | `/analytics/delivery-performance` | `from, to` | `{ data: { avg_completion_days, completed_count, total_count } }` |
| `GET` | `/analytics/recent-orders` | `from, to, status, limit` | `{ data: Order[] }` with customer info |
| `GET` | `/analytics/top-products` | `from, to, limit, category` | `{ data: [{ product_id, product_name, total_qty, total_revenue }] }` |
| `GET` | `/analytics/least-products` | `from, to, limit, category` | `{ data: [...] }` same shape, ascending sort |
| `GET` | `/analytics/category-sales` | `from, to` | `{ data: [{ category, order_count, total_qty, total_revenue }] }` |
| `GET` | `/analytics/subcategory-sales` | `from, to, category` | `{ data: [{ category, subcategory, order_count, total_qty, total_revenue }] }` |
| `GET` | `/analytics/category-monthly` | `from, to` | `{ data: [{ month, category, total_qty, total_revenue }] }` |
| `GET` | `/analytics/categories` | — | `{ data: string[] }` — list of distinct category names |
| `GET` | `/analytics/product-search` | `q, limit` | `{ data: [{ product_id, product_name, product_category }] }` |
| `GET` | `/analytics/product-monthly` | `product_id (required), from, to` | `{ data: [{ month, total_qty, total_revenue }] }` |

---

### 3.14 Campaigns — `authorize('campaigns')`

| Method | Path | Query / Body | Response |
|---|---|---|---|
| `GET` | `/campaigns` | `?status=active&effective_status=expired&type=discount&search=xyz&country_id=1&sortBy=created_at&sortOrder=DESC` | `{ data: Campaign[] }` — includes `effective_status`, `country_codes` CSV |
| `GET` | `/campaigns/:id` | — | `{ data: { ...campaign, effective_status, countries: [country_id], base_discount, items[] } }` |
| `POST` | `/campaigns` | `{ name_en, name_ar?, type?, start_at, end_at, is_all_products?, is_stackable?, priority?, notes?, countries: [id], base_discount?: { discount_type, discount_value, min_price_floor? }, items?: [...], activate?: bool }` | `{ id, message }` |
| `PUT` | `/campaigns/:id` | Same as POST (replaces countries, discount, items atomically) | `{ message }` |
| `DELETE` | `/campaigns/:id` | — | Archives campaign (sets `status='archived'`) |
| `PATCH` | `/campaigns/:id/status` | `{ status }` | `{ message }` |
| `PATCH` | `/campaigns/:id/restore` | — | Unarchive |
| `DELETE` | `/campaigns/:id/permanent` | — | Permanent delete |
| `POST` | `/campaigns/validate` | campaign data | Validation check |
| `POST` | `/campaigns/preview` | `{ countries: [id], is_all_products, base_discount, items: [...] }` | `{ data: [{ product_id, product_name, fgd, country_code, currency_symbol, original_price, discounted_price, discount_label, is_excluded }] }` |
| `GET` | `/campaigns/products/search` | `?q=oud&limit=30` | `{ data: [{ id, fgd, name_en, name_ar, active_campaign_name }] }` |

**Campaign item object:**
```json
{
  "product_id": 1,
  "discount_type": "percentage",   // overrides base_discount; null to inherit
  "discount_value": 10,
  "is_excluded": false              // true = exclude from this campaign
}
```

---

## 4. Frontend API Functions (`frontend/src/api/index.js`)

All functions return the **raw Axios response**. To access data, destructure **the first `data`** from the response:

```js
// Pattern:
const { data } = await getProducts();
// data = { data: Product[], meta: {...} }  ← server response envelope
const products = data.data;
const meta = data.meta;

// For single items:
const { data } = await getProduct(id);
const product = data.data;

// For paginated audit logs:
const { data } = await getAuditLogs({ page: 1, limit: 50 });
const logs = data.data;
const pagination = data.pagination;
```

### 4.1 Auth
```js
login({ username, password })          // POST /auth/login
getMe()                                 // GET  /auth/me
```

### 4.2 Users
```js
getUsers()                              // GET  /users
getUser(id)                             // GET  /users/{id}
createUser(data)                        // POST /users
updateUser(id, data)                    // PUT  /users/{id}
resetUserPassword(id, password)         // PUT  /users/{id}/password  → body { password }
deleteUser(id)                          // DELETE /users/{id}         (soft)
hardDeleteUser(id)                      // DELETE /users/{id}/hard    (hard, admin only)
```

### 4.3 Audit Logs
```js
getAuditLogs(params)
// params: { page, limit, user_id, module, action, from, to }
// response: { data: Log[], pagination }
```

### 4.4 Products
```js
getProducts(params)
// params: { country, category, subcategory, featured, search, page, limit, sort, order, admin, status }
// response: { data: Product[], meta: { total, page, limit, pages } }

getProduct(id)
// ?country=AE supported via params arg if needed
// response: { data: Product }

createProduct(data)                     // POST /products
updateProduct(id, data)                 // PUT  /products/{id}
toggleProduct(id, country?)             // PATCH /products/{id}/toggle[?country=AE]
deleteProduct(id)                       // DELETE /products/{id}      (Permanent)
```

### 4.5 Product Sub-resources
```js
getFragranceNotes(productId)            // GET  /products/{id}/notes
upsertFragranceNote(productId, data)    // PUT  /products/{id}/notes   data: { notes: [...] }

getSizes(productId)                     // GET  /products/{id}/sizes  ← NOTE: hits /sizes directly
setSizes(productId, sizes)             // PUT  /products/{id}/sizes

getCountryConfigs(productId)           // GET  /products/{id}/countries
updateVisibility(productId, visibility) // PUT  /products/{id}/visibility  { visibility: [...] }
updateSEO(productId, seo)              // PUT  /products/{id}/seo          { seo: [...] }

getProductStock(productId)             // GET  /products/{id}/stock
updateProductStock(productId, stocks)  // PUT  /products/{id}/stock        { stocks: [...] }
```

### 4.6 Categories
```js
getCategories(params)
// params: { country, admin, status }
// With admin=1: each category has .subcategories[]

getCategory(id)                         // GET  /categories/{id}
createCategory(data)                    // POST /categories
updateCategory(id, data)               // PUT  /categories/{id}
deleteCategory(id)                      // DELETE /categories/{id}    (Permanent)
importCategories(formData, dryRun)     // POST /categories/import?dry_run=true|false
reorderCategories(items)               // PUT  /categories/reorder      { items: [{id, sort_order}] }

createSubcategory(catId, data)         // POST /categories/{catId}/subcategories
updateSubcategory(subId, data)         // PUT  /categories/subcategories/{subId}
deleteSubcategory(id)                  // DELETE /subcategories/{id} (Permanent)
reorderSubcategories(items)            // PUT  /categories/subcategories/reorder
```

### 4.7 Countries
```js
getCountries()                          // GET /countries
// response: { data: [{ id, code, name_en, name_ar, currency_id, currency_code, symbol_en, symbol_ar, decimal_places, is_active }] }
```

### 4.8 Pricing
```js
getPricing(productId)                   // GET  /pricing/{productId}
updateAllPrices(productId, prices)     // PUT  /pricing/{productId}     { prices: [{country_id, currency_id, regular_price}] }
updateOnePrice(productId, countryId, data) // PATCH /pricing/{productId}/country/{countryId}
```

### 4.9 Media
```js
getMedia(productId)                     // GET  /media/{productId}
uploadMedia(formData, productId)        // POST /media/upload?type=product&product_id={id}  multipart
deleteMedia(mediaId)                    // DELETE /media/{mediaId}
setPrimaryMedia(mediaId)               // PATCH /media/{mediaId}/primary
```

### 4.10 Sizes & Labels
```js
// Note: no dedicated frontend helper for sizes/labels — call directly:
// api.get('/sizes')   → { data: Size[] }
// api.get('/labels')  → { data: Label[] }
```

### 4.11 Bundles
```js
getBundles()                            // GET  /bundles
getBundle(productId)                    // GET  /bundles/{productId}
createBundle(data)                      // POST /bundles    { product_id, items: [...] }
updateBundle(bundleId, items)          // PUT  /bundles/{bundleId}/items  { items: [...] }
deleteBundle(productId)                 // DELETE /bundles/{productId}
```

### 4.12 Sales
```js
logSale(data)                           // POST /sales/log
logBulkSales(records)                  // POST /sales/log/bulk
getSalesReport(params)                 // GET  /sales/report
```

### 4.13 Analytics
```js
getAnalyticsSummary(params)            // GET /analytics/summary
getMonthlySales(params)                // GET /analytics/monthly-sales
getTopProducts(params)                 // GET /analytics/top-products
getLeastProducts(params)               // GET /analytics/least-products
getOrderStatus(params)                 // GET /analytics/order-status
getRecentOrders(params)                // GET /analytics/recent-orders
getDeliveryPerformance(params)         // GET /analytics/delivery-performance
getCategorySales(params)               // GET /analytics/category-sales
getSubcategorySales(params)            // GET /analytics/subcategory-sales
getCategoryMonthly(params)             // GET /analytics/category-monthly
getAnalyticsCategories()               // GET /analytics/categories
searchProducts(params)                 // GET /analytics/product-search
getProductMonthlySales(params)         // GET /analytics/product-monthly
```

### 4.14 Campaigns
```js
getCampaigns(params)                    // GET  /campaigns
getCampaign(id)                         // GET  /campaigns/{id}
createCampaign(data)                    // POST /campaigns
updateCampaign(id, data)               // PUT  /campaigns/{id}
deleteCampaign(id)                      // DELETE /campaigns/{id}   (archives)
restoreCampaign(id)                     // PATCH /campaigns/{id}/restore
hardDeleteCampaign(id)                  // DELETE /campaigns/{id}/permanent
updateCampaignStatus(id, status)       // PATCH /campaigns/{id}/status
validateCampaign(data)                 // POST /campaigns/validate
previewCampaign(data)                  // POST /campaigns/preview
searchCampaignProducts(params)         // GET  /campaigns/products/search
```

---

## 4.15 Storefront API (Public)
Public-facing endpoints for the storefront application. Registration: `/api/storefront`.

```js
// Products
// GET  /storefront/products/{idOrSlug}?country=AE
// Response: Detailed product info including attributes, fragrance notes, and related products.

// Subcategories
// GET  /storefront/subcategories/{idOrSlug}?country=AE
// Response: { id, name, image, mobile_image, description, description_ar, products: [ EnrichedProduct ] }

// Categories
// GET  /storefront/categories/{idOrSlug}?country=AE
// Response: { id, name, image, mobile_image, description, description_ar, productSubCategories: [ { id, name, image, mobile_image, video, products: [ EnrichedProduct ] } ] }

```

---

## 5. Key Patterns & Conventions

### Permanent Deletion Workflow
- All major entities (`products`, `categories`, `subcategories`) are now deleted permanently from the database and UI.
- **Cascade Cleanup:** Deletion uses SQL transactions to clean up relational tables (e.g., deleting a product removes it from bundles and sales logs; deleting a category removes all its subcategories).
- **No Bin:** The Recycle Bin functionality has been removed. Deletions are irreversible.
- **History:** A record of the deletion is preserved in the `audit_logs` table.

> **Audit Log Detail:** `action='delete'` with `details` containing the ID and key metadata before erasure.

### Multi-language
Every user-facing text field exists in two variants: `_en` (English) and `_ar` (Arabic). Always populate both.

### Country-scoped Data
Products, categories, prices, and campaigns are all country-aware:
- **Products:** `product_country` controls visibility and SEO per country. `product_prices` holds the price per country.
- **Categories:** `category_country` controls per-country visibility.
- **Campaigns:** `campaign_countries` links campaigns to specific GCC markets.

### JSON Fields
`products.tags`, `products.attributes`, `users.permissions`, `fragrance_notes.ingredients_en/ar`, `audit_logs.details` are stored as JSON strings in MySQL but are parsed to JS objects/arrays before being returned by the API.

### GCC Countries Reference
| ID | Code | Name | Currency |
|---|---|---|---|
| 1 | AE | UAE | AED (2 decimals) |
| 2 | SA | Saudi Arabia | SAR (2 decimals) |
| 3 | QA | Qatar | QAR (2 decimals) |
| 4 | BH | Bahrain | BHD (3 decimals) |
| 5 | KW | Kuwait | KWD (3 decimals) |
| 6 | OM | Oman | OMR (3 decimals) |
