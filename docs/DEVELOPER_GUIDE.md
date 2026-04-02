# Developer Guide & Project Study

This document serves as a "quick study" for both human developers and future AI assistants to understand the architecture, data flow, and maintenance patterns of the **Ahmed Al Maghribi – Centralized Product Platform**.

---

## 1. Project Overview
The **Centralized Product Platform** is a multi-tenant (multi-country) management system for beauty products (fragrances, etc.). It centralizes product data, pricing, media, and marketing campaigns across several countries (UAE, KSA, Qatar, Bahrain, Kuwait, Oman).

### Core Features
- **Product Management**: Multi-country visibility, pricing, and media overrides.
- **Campaign Engine**: Supports Discount Rules, BXGY (Buy X Get Y), and FOC (Free of Charge) promotions.
- **Audit Logging**: Every administrative action (Create, Update, Delete) is tracked for accountability.
- **Soft-Delete (Recycle Bin)**: Global `deleted_status` mechanism to prevent accidental data loss.

---

## 2. Technical Stack
- **Backend**: Node.js with [Express](https://expressjs.com/).
- **Database**: [MySQL](https://www.mysql.com/) (using `mysql2/promise`).
- **Security**: 
  - [Bcrypt](https://www.npmjs.com/package/bcrypt) for secure password hashing.
  - [JSON Web Tokens (JWT)](https://jwt.io/) for stateless session management.
- **Middleware**: Custom `authorize` middleware handles role-based and permission-based routing.

---

## 3. Database Architecture
The schema is designed to handle per-country complexity while maintaining a single product source of truth.

### Key Relationships
- **Products**: The central entity. Linked to `category_id` and `subcategory_id`.
- **Country-Specifics**: 
  - `product_country`: Controls visibility and SEO overrides per store.
  - `product_prices`: Holds `regular_price` for each country/currency pair.
- **Campaigns**: Highly flexible rules. Linked to countries via `campaign_countries` and to scope (All/Category/Product) via `campaign_scope`.

**Reference File**: [DATABASE_SCHEMA.sql](file:///d:/ahmed-admin-centralized/docs/DATABASE_SCHEMA.sql) (Consolidated Master Schema).

---

## 4. Instructions for Future AI Assistants
To maintain consistency and avoid "hallucinations" or architectural drift, follow these rules:

### A. Maintain the Master Schema
> [!IMPORTANT]
> Whenever you add a new table, column, or relationship via a migration in `backend/src/db/migrations/`, you **MUST** also update the consolidated [DATABASE_SCHEMA.sql](file:///d:/ahmed-admin-centralized/docs/DATABASE_SCHEMA.sql) file. This ensures the master schema remains a valid reference for the *entire* current state of the database.

### B. Security Patterns
- **Password Hashing**: Always use `bcrypt.hash(password, 10)` for storage and `bcrypt.compare()` for verification.
- **Authorization**: Protected routes should use the `authorize('module_name')` middleware found in `backend/src/middleware/auth.js`.

### C. Soft-Deletion (Recycle Bin)
- Do **not** hard-delete items unless specifically requested (or on the Superadmin-only `hard` delete routes).
- Use the `deleted_status` column:
  - `active`: Live data.
  - `bin`: In the recycle bin (recoverable).
  - `permanent`: Marked for future cleanup (non-functional for the user).

### D. Audit Logging
- Every `POST`, `PUT`, and `DELETE` operation should ideally trigger a `logAudit(req, { ... })` call to record who did what and when.

---

## 5. Directory Structure
```text
/backend
  /src
    /config      - DB and environment configs
    /db          - Migrations and seeding scripts
    /middleware  - Auth, Error handling, and Auditing
    /routes      - API endpoints (Admin & Storefront)
/docs
  - DATABASE_SCHEMA.sql - Master Table Definitions
  - DEVELOPER_GUIDE.md  - This file.
```
