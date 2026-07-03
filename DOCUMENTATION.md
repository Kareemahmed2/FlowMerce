# FlowMerce — Backend Documentation

**Cairo University Faculty of Computers & Information — Graduation Project 2025–2026**

FlowMerce is a smart e-commerce platform builder for SMEs. Its core differentiator is an AI-powered UX/UI advisor that guides merchants through store design decisions — filling the gap that Shopify, Salla, and WooCommerce leave for users who lack design expertise, particularly in the Egyptian market.

> A field-by-field, endpoint-by-endpoint reference (every controller, every Redis key, the full RabbitMQ event bus, SSE mechanics) lives in `Back end/BACKEND_REFERENCE.md`. This document is the narrative overview; that one is the exhaustive audit trail with file:line references.

---

## Table of Contents

1. [Team](#team)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Running Locally](#running-locally)
5. [Environment Variables](#environment-variables)
6. [API Conventions](#api-conventions)
7. [Modules](#modules)
   - [UserManagement](#1-usermanagement)
   - [Store Management](#2-store-management)
   - [ProductManagement](#3-productmanagement)
   - [InventoryManagement](#4-inventorymanagement)
   - [CartManagement & Wishlist](#5-cartmanagement--wishlist)
   - [OrderManagement](#6-ordermanagement)
   - [PaymentManagement](#7-paymentmanagement)
   - [NotificationManagement](#8-notificationmanagement)
   - [StorefrontCustomization](#9-storefrontcustomization)
   - [FileStorage](#10-filestorage)
   - [IntegrationManagement](#11-integrationmanagement)
   - [AI Assistant](#12-ai-assistant)
   - [Real-Time Events (SSE)](#13-real-time-events-sse)
8. [Database Schema](#database-schema)
9. [Event Bus (RabbitMQ)](#event-bus-rabbitmq)
10. [Key Design Decisions](#key-design-decisions)
11. [Performance & Caching Architecture](#performance--caching-architecture)
12. [Testing](#testing)
13. [Known Issues / Gaps](#known-issues--gaps)

---

## Team

| ID | Name |
|----|------|
| 20226179 | Kareem Ahmed Mahrous |
| 20226032 | Jana Mohamed Salem |
| 20226075 | Farah Mahmoud Hassaan |
| 20226163 | Bahaa Mohamed Akl |
| 20226162 | Hana Abdelbari Elsayed |

**Supervisors:** Prof. Khaled Wassif · Dr. Rasha ElBanna · TA. Menna Youssef

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 4.0 (Jackson 3) · Java 21 |
| Frontend | Next.js 14 · TypeScript |
| Database | PostgreSQL (Supabase, EU-West-1, via Supavisor session pooler) |
| Cache | Redis (`redis/redis-stack`) — accessed exclusively via `StringRedisTemplate`, no `@Cacheable`/Spring Cache abstraction |
| Message Queue | RabbitMQ (topic exchanges, JSON payloads via `Jackson2JsonMessageConverter`) |
| File Storage | MinIO (S3-compatible) — runs on its own host, decoupled from `compose.yaml` |
| Real-time push | Server-Sent Events (`SseEmitter`) — no WebSockets |
| AI | Groq API (planned — see [AI Assistant](#12-ai-assistant)) |
| Auth | JWT + refresh-token rotation + RBAC, plus Google/Facebook OAuth2 for merchants |
| Encryption | AES-256-GCM for per-store third-party credentials (IntegrationManagement) |
| Testing | JUnit 5 · Mockito · MockMvc standalone (see [Testing](#testing)) |

---

## Architecture Overview

```
[Next.js 14 Frontend]
        │
        ▼ REST (JSON)
[Spring Boot Backend]   ─── base path: /api/v1
        │
        ├── PostgreSQL (Supabase)   — persistent data
        ├── Redis                   — session cache, storefront cache, stock cache, idempotency keys
        ├── RabbitMQ                — async order/payment events → notifications
        ├── MinIO                   — product images, store logos, invoices (separate host)
        └── Groq API                — AI advisor (proxied, server-side — not yet implemented)
```

**Module structure:** All modules live in the same Spring Boot application under `com.example.flowmerceproject.*`. They communicate via:
- Direct service calls (synchronous, within the same JVM)
- Spring's in-process `ApplicationEventPublisher` (synchronous-within-request, e.g. `StockChangedEvent` → SSE)
- RabbitMQ exchanges (asynchronous, for order and payment events → notifications)

**Roles:** `ADMIN` · `MERCHANT` · `BUYER` (Spring Security role name for customers)

---

## Running Locally

### Prerequisites
- Java 21+
- Docker (for local RabbitMQ, Redis via `compose.yaml`; MinIO runs separately — see below)

### Steps

```bash
# 1. Clone and enter project
git clone <repo>
cd FlowMerceProject

# 2. Start infrastructure services
docker compose up -d

# 3. Set required env vars (see section below), then run
./mvnw spring-boot:run
```

The app starts on `http://localhost:8080`. All routes are prefixed with `/api/v1`.

### `compose.yaml` services

| Service | Image | Ports |
|---------|-------|-------|
| redis | `redis/redis-stack:latest` | 6379 (API) · 8001 (RedisInsight UI) |
| rabbitmq | `rabbitmq:3-management` | 5672 (AMQP) · 15672 (Management UI) |
| backend | Spring Boot (Dockerfile) | 8080 |
| frontend | Next.js (Dockerfile) | 3000 |

> The live application connects to **Supabase** (configured in `application.properties`). The compose stack does not include a local Postgres — use the Supabase connection string for all environments.
>
> **MinIO is not run by `compose.yaml`** — it runs on its own host/stack (a separate `docker-compose.yaml`, or a managed S3-compatible provider). Set `MINIO_URL` (internal endpoint the backend connects to) and `MINIO_PUBLIC_URL` (the HTTPS host browsers hit — files are served with a public-read bucket policy directly to the browser) plus `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`MINIO_BUCKET` in `Back end/.env`.

---

## Environment Variables

All values have defaults for local development except the ones marked **required** below. Override for production.

**Required — app refuses to start without these:**

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | HMAC signing key for JWTs — generate with `openssl rand -base64 48` |
| `DB_PASSWORD` | Supabase/Postgres password |
| `MAIL_PASSWORD` | Gmail app password (SMTP) |
| `INTEGRATION_ENCRYPTION_KEY` | AES-256 key encrypting per-store Paymob/DHL/Aramex/Bosta credentials at rest — generate with `openssl rand -base64 32` |

**Optional — sensible defaults:**

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRY` | `86400000` | JWT expiry in ms (24h) |
| `DB_URL` / `DB_USERNAME` | Supabase pooler URL / `postgres.<project-ref>` | Override to point at a different Postgres |
| `MAIL_USERNAME` | `ka.mahrous@gmail.com` | SMTP sender |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@flowmerce.com` / `ChangeMe!2026` | Seeded admin account — **must** override `ADMIN_PASSWORD` when `SPRING_PROFILES_ACTIVE=prod`, or the app refuses to boot |
| `BACKEND_URL` | `http://localhost:8080` | Base URL the backend uses for self-referencing links — `https://api.flowmerce.tech` in production |
| `FRONTEND_URL` | `http://localhost:3000` | Used in CORS and activation/reset email links |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis connection |
| `RABBITMQ_HOST` / `RABBITMQ_PORT` | `localhost` / `5672` | RabbitMQ connection |
| `RABBITMQ_USERNAME` / `RABBITMQ_PASSWORD` | `myuser` / `secret` | RabbitMQ credentials (dev throwaway — override in prod) |
| `MINIO_URL` | `http://minio:9000` | MinIO S3 API endpoint the backend connects to |
| `MINIO_PUBLIC_URL` | _(= `MINIO_URL`)_ | Public URL used when building links returned to the browser, if different from `MINIO_URL` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minioadmin` / `minioadmin` | MinIO credentials — must match `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` on the MinIO server |
| `MINIO_BUCKET` | `flowmerce` | Single bucket for all uploads (created automatically, public-read policy applied automatically) |
| `SF_CACHE_TTL_MINUTES` | `30` | Storefront Redis cache TTL |
| `SESSION_CACHE_TTL_SECONDS` / `SESSION_CACHE_ETAG_TTL_SECONDS` | `30` / `86400` | JWT session cache Tier-1 / Tier-2 TTLs |
| `INVENTORY_LOW_STOCK_THRESHOLD` | `5` | **Dead config** — not actually read anywhere; the effective threshold is the per-product `Inventory.lowStockThreshold` column (defaults to 10 at product creation) |
| `SHIPPING_FLAT_RATE` | `25.00` | Flat shipping cost (EGP), added unconditionally — there is no free-shipping threshold logic |
| `TAX_RATE` | `0.00` | Tax rate (0 for MVP) |
| `STRIPE_SECRET_KEY` | _(empty)_ | Activates the Stripe gateway stub |
| `FAWRY_MERCHANT_CODE` / `FAWRY_SECURITY_KEY` | _(empty)_ | Activates the Fawry gateway stub |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | _(empty)_ | Google OAuth2 (merchant social login) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` / `FACEBOOK_REDIRECT_URI` | _(empty)_ | Facebook OAuth2 (merchant social login) |
| `GROQ_API_KEY` | _(empty)_ | Frontend AI assistant |
| `SPRING_PROFILES_ACTIVE` | _(empty)_ | Set to `prod` to enable the admin-password guard |

**Paymob is not a global env var.** Unlike Stripe/Fawry, Paymob (and DHL/Aramex/Bosta shipping) credentials are configured **per store** by the merchant, under Settings → Integrations — see [IntegrationManagement](#11-integrationmanagement). FlowMerce never holds its own Paymob account.

---

## API Conventions

**Base URL:** `http://localhost:8080/api/v1` (dev) · `https://api.flowmerce.tech/api/v1` (production)

**Authentication:** `Authorization: Bearer <JWT>` header, or scoped httpOnly cookies (`merchant_access_token` / `customer_access_token`) set on login — disambiguated by an `X-Auth-Role` header when both could apply.

**Standard response envelope:**

```json
// Success
{ "success": true, "data": { ... }, "message": "..." }

// Error
{ "success": false, "error": "...", "code": "VALIDATION_ERROR", "status": 400, "details": { ... } }
```

**Error codes:** `VALIDATION_ERROR` · `NOT_FOUND` · `CONFLICT` · `FORBIDDEN` · `UNAUTHORIZED`

**Currency:** EGP (Egyptian Pound) throughout.

---

## Modules

### 1. UserManagement

Handles registration, login, email verification, password reset, JWT issuance, and profile management for three roles: Admin, Merchant, and Customer. Uses `@OncePerRequestFilter` (JwtAuthFilter) to validate tokens on every request. Sessions are persisted in the `sessions` table and can be revoked. Also hosts Google/Facebook OAuth2 login for merchants and the SSE gateway.

**Forgot password behaviour:** Returns `400 Bad Request` with the message `"No account found with this email address."` if the email is not registered. No email is sent and no token is created for unknown addresses.

**Role names:** The Spring Security role used in `@PreAuthorize` for customer-facing operations is `BUYER` (e.g. `hasRole('BUYER')`), not `CUSTOMER`.

**Key classes:**
- `AuthController` — merchant auth flows (`/auth/merchant/*`)
- `CustomerAuthController` — customer auth flows (`/auth/customer/*`)
- `SocialAuthController` — Google/Facebook OAuth2 (`/auth/social/*`)
- `UserController` — profile and password management (`/users/me`)
- `MerchantController` — merchant profile CRUD (`/merchants/me`)
- `AdminController` — admin operations (`/admin/*`)
- `SseController` — real-time event streams (`/stream/*`, see [Real-Time Events](#13-real-time-events-sse))
- `AuthService` — business logic, email dispatch, token generation
- `SessionCacheService` — two-tier Redis session cache (see [Performance & Caching](#performance--caching-architecture))
- `RateLimitFilter` — per-IP Redis-backed rate limiting, runs before `JwtAuthFilter`
- `SecurityConfig` — Spring Security filter chain, CORS, password encoder
- `JwtAuthFilter` / `JwtUtil` — token parsing and validation
- `CookieUtil` — scope-namespaced cookies so a merchant and customer session can coexist in one browser
- `GlobalExceptionHandler` — maps domain exceptions to HTTP responses

**Merchant auth endpoints** (`AuthController` at `/auth/merchant`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/merchant/register` | Public | Register merchant account |
| `GET`  | `/auth/merchant/activate?token=` | Public | Activate merchant account |
| `POST` | `/auth/merchant/login` | Public | Login, returns JWT + refresh token |
| `POST` | `/auth/merchant/refresh` | Public | Rotate refresh token (single-use), issue new access token |
| `POST` | `/auth/merchant/logout` | Public | Revoke session (Authorization header or cookie) |
| `GET`  | `/auth/merchant/me` | Authenticated | Get current merchant profile |
| `POST` | `/auth/merchant/forgot-password` | Public | Send password reset email |
| `POST` | `/auth/merchant/reset-password` | Public | Reset password with token |

**Customer auth endpoints** (`CustomerAuthController` at `/auth/customer`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/customer/register` | Public | Register customer account |
| `GET`  | `/auth/customer/activate?token=` | Public | Activate customer account |
| `POST` | `/auth/customer/login` | Public | Login, returns JWT + refresh token |
| `POST` | `/auth/customer/refresh` | Public | Rotate refresh token |
| `POST` | `/auth/customer/logout` | Public | Revoke session |
| `GET`  | `/auth/customer/me` | Authenticated | Get current customer profile |
| `POST` | `/auth/customer/forgot-password` | Public | Send password reset email |
| `POST` | `/auth/customer/reset-password` | Public | Reset password with token |
| `DELETE` | `/auth/customer/me` | Authenticated | Delete own customer account |

**Social login endpoints** (`SocialAuthController` at `/auth/social`, public):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/social/{provider}/redirect?state=` | `provider` = `google` or `facebook`; redirects to the provider's consent screen |
| `GET` | `/auth/social/{provider}/callback?code=&state=` | Exchanges the code, finds-or-creates a user, sets scoped cookies, redirects to the frontend with tokens in the query string |

Social login always creates/resolves a **MERCHANT** account — it never creates customers. Accounts are pre-verified (no activation email) and get an unusable password hash.

**User profile endpoints** (`UserController` at `/users`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/users/me` | Authenticated | Get own profile |
| `PUT`  | `/users/me` | Authenticated | Update profile |
| `PUT`  | `/users/me/change-password` | Authenticated | Change password |
| `DELETE` | `/users/me` | Authenticated | Delete own account (thinner cleanup than the admin delete path — see [Known Issues](#known-issues--gaps)) |

**Merchant profile endpoints** (`MerchantController` at `/merchants`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/merchants/me` | Authenticated | Create merchant profile |
| `GET`  | `/merchants/me` | Authenticated | Get own merchant profile |
| `DELETE` | `/merchants/me` | Authenticated | Delete merchant account |

**Admin endpoints** (`AdminController` at `/admin`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/admin/users` | ADMIN | List all users |
| `DELETE` | `/admin/users/{userId}` | ADMIN | Delete user by ID (cascades sessions, notifications, profile, customer/merchant, stores) |
| `GET`  | `/admin/merchants` | ADMIN | List all merchants |
| `PUT`  | `/admin/merchants/{merchantId}/verify` | ADMIN | Verify/approve merchant |
| `DELETE` | `/admin/merchants/{merchantId}` | ADMIN | Delete merchant by ID |
| `PUT`  | `/admin/users/{userId}/activate` | ADMIN | Force-activate a user, bypassing the email flow |
| `GET`  | `/admin/stores` | ADMIN | List all stores |

**Verification token types:** `ACTIVATION` (24h) · `PASSWORD_RESET` (1h)
Tokens are single-use, have an `expires_at`, and are stored in `verification_tokens`.

---

### 2. Store Management

A merchant can own multiple stores. Each store has an onboarding flow (steps 0–5), a publish/unpublish state, branding, and configurable settings (currency, timezone, language, shipping, tax).

**Key classes:**
- `StoreController` — CRUD + publish/unpublish
- `StoreService` — slug generation, step advancement (no Redis/RabbitMQ/SSE dependency — ownership checks here are plain uncached DB lookups, unlike the cached equivalent in StorefrontCustomization)
- `AdminController` — admin-level store/merchant management
- `MerchantController` / `MerchantService` — merchant profile

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores` | MERCHANT | Create store (rejects duplicate `storeUrl`) |
| `GET`  | `/stores/me` | MERCHANT | List own stores |
| `GET`  | `/stores/{storeId}` | MERCHANT (owner) | Get store by ID |
| `PUT`  | `/stores/{storeId}` | MERCHANT (owner) | Update store |
| `DELETE` | `/stores/{storeId}` | MERCHANT (owner) | Delete store |
| `GET`  | `/stores/slug/{slug}` | Public | Get store by URL slug (for storefront rendering) — 403 if the store is `PAUSED` |
| `POST` | `/stores/{storeId}/publish` | MERCHANT (owner) | Publish store |
| `POST` | `/stores/{storeId}/unpublish` | MERCHANT (owner) | Unpublish store |
| `PUT`  | `/stores/{storeId}/onboarding-step` | MERCHANT (owner) | Advance onboarding step (0–5) |
| `PUT`  | `/stores/{storeId}/brand` | MERCHANT (owner) | Update brand (name, logo) |
| `PUT`  | `/stores/{storeId}/payment-methods` | MERCHANT (owner) | Set accepted payment methods |
| `GET`  | `/stores/{storeId}/settings` | MERCHANT (owner) | Get store settings |
| `PUT`  | `/stores/{storeId}/settings` | MERCHANT (owner) | Update store settings |

**Store status values:** `DRAFT` · `PUBLISHED` · `PAUSED`
A store starts as `DRAFT`. `POST /stores/{storeId}/publish` transitions to `PUBLISHED`; `/unpublish` transitions to `PAUSED` (there is no separate `DEACTIVATED` state — unpublish and pause are the same status).

---

### 3. ProductManagement

Products belong to a store and optionally a category (global, admin-managed, or store-owned). Each product has a media gallery stored in MinIO and per-product inventory. Customers can leave one review per product (rating 1–5). A public catalog endpoint serves storefront customers.

**Key classes:**
- `ProductController` — product CRUD, media management
- `CategoryController` — global category CRUD (admin-managed)
- `StoreCategoryController` — store-owned category CRUD (merchant-managed; combines with global categories on read, de-duped by name)
- `ReviewController` / `ReviewService` — product reviews

**File storage:** product media is uploaded via `FileStorage`'s `FileUploadController` (see [FileStorage](#10-filestorage)), object key `PRODUCT_IMAGES/{storeId}/{productId}/{uuid}.{ext}` in the single `flowmerce` bucket, served back as a public-read MinIO URL.

**Product endpoints** (`ProductController` at `/stores/{storeId}/products`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores/{storeId}/products` | MERCHANT (owner) | Create product — also creates its `Inventory` row and warms the stock cache |
| `GET`  | `/stores/{storeId}/products` | MERCHANT (owner) | List all store products (incl. inactive) |
| `GET`  | `/stores/{storeId}/products/public` | Public | List active/published products |
| `GET`  | `/stores/{storeId}/products/search?keyword=` | Public | Search products by keyword, scoped to the store |
| `GET`  | `/stores/{storeId}/products/{productId}` | Public | Get product by ID |
| `PUT`  | `/stores/{storeId}/products/{productId}` | MERCHANT (owner) | Update product |
| `PATCH` | `/stores/{storeId}/products/{productId}/status` | MERCHANT (owner) | Toggle product active/inactive |
| `DELETE` | `/stores/{storeId}/products/{productId}` | MERCHANT (owner) | Delete product (Inventory row cascades) |
| `POST` | `/stores/{storeId}/products/{productId}/media` | MERCHANT (owner) | Add media (upload URL) |
| `DELETE` | `/stores/{storeId}/products/{productId}/media/{mediaId}` | MERCHANT (owner) | Delete media |

Default `lowStockThreshold` is **10** if not supplied at creation (see [InventoryManagement](#4-inventorymanagement)). Every product read calls into `InventoryService` to populate `availableQuantity`, swallowing lookup failures (shows `0` on error).

**Global category endpoints** (`CategoryController` at `/categories`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/categories` | Public | List all global categories |
| `GET`  | `/categories/{id}` | Public | Get category by ID |
| `POST` | `/categories` | ADMIN | Create category |
| `PUT`  | `/categories/{id}` | ADMIN | Update category |
| `DELETE` | `/categories/{id}` | ADMIN | Delete category |

**Store-owned category endpoints** (`StoreCategoryController` at `/stores/{storeId}/categories`, all `MERCHANT`):

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/stores/{storeId}/categories` | Store-owned + global categories combined, de-duped by name |
| `POST` | `/stores/{storeId}/categories` | Create a category owned by this store |
| `DELETE` | `/stores/{storeId}/categories/{categoryId}` | Delete a store-owned category (rejects deleting a global category) |

**Review endpoints** (`ReviewController` at `/products/{productId}/reviews`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/products/{productId}/reviews` | Public | Get reviews for product |
| `POST` | `/products/{productId}/reviews` | BUYER | Submit review (one per customer per product) |
| `PUT`  | `/products/{productId}/reviews` | BUYER | Edit own review (review identified by authenticated user) |
| `DELETE` | `/products/{productId}/reviews/{reviewId}` | BUYER or ADMIN* | Delete review |

\* The ADMIN branch of this `@PreAuthorize` is not actually functional in the service layer — see [Known Issues](#known-issues--gaps). `Product.rating` is recalculated (rounded to 1 decimal) after every submit/edit/delete.

> **Note:** The public catalog (categories + products for a storefront) is also served by `PublicStorefrontController` — see the StorefrontCustomization module.

---

### 4. InventoryManagement

Tracks stock per product with **optimistic locking** (`@Version` on the `inventory` table) to prevent overselling under concurrency, plus an atomic Redis counter for the hot path. Supports multiple deduction strategies via the Strategy pattern. A scheduler runs at 2 AM daily to release reserved stock from abandoned carts.

**Key classes:**
- `InventoryController` / `InventoryServiceImpl` — stock queries and adjustments
- `InventoryStrategyFactory` + `NormalStockStrategy` / `ReservedStockStrategy` / `FlashSaleStrategy` (`@Component("NORMAL"|"RESERVED"|"FLASH")`) — pluggable quantity math; `FLASH` caps at 2 units/customer
- `InventoryTransactionRepository` — audit log of all stock changes (`RESTOCK`/`SALE`/`RETURN`/`ADJUSTMENT`/`DAMAGE`)
- `StockChangedEvent` / `StockEventListener` — in-process Spring event (`ApplicationEventPublisher`, **not** RabbitMQ), consumed `@Async` to push `STOCK_ALERT` over SSE

**Endpoints** (`InventoryController`, absolute paths):

Spec-compliant:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `PATCH` | `/products/{productId}/stock` | MERCHANT | Adjust stock by a signed delta (NORMAL strategy) |
| `GET`  | `/stores/{storeId}/inventory` | MERCHANT or ADMIN | List all inventory for a store |
| `POST` | `/stores/{storeId}/inventory/{productId}/restock` | MERCHANT | Restock a product |
| `GET`  | `/stores/{storeId}/inventory/{productId}/history` | MERCHANT | Transaction history for a product |

Legacy (kept for backward compatibility):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/inventory/{productId}` | Authenticated | Get inventory details for a product |
| `GET`  | `/inventory/{productId}/check?qty=` | Authenticated | Check stock availability for a quantity |
| `POST` | `/inventory/adjust` | MERCHANT | Adjust stock with caller-specified strategy |
| `POST` | `/inventory/reserve` | BUYER | Reserve stock for checkout (internal) |
| `POST` | `/inventory/release` | BUYER or ADMIN | Release reserved stock (internal) |

**Low-stock threshold:** set **per product** at creation time (`Inventory.lowStockThreshold`, defaults to 10 via `ProductService.createProduct`). The global `INVENTORY_LOW_STOCK_THRESHOLD` env var is injected but never actually read — dead configuration.

**Redis:** `product:{productId}:stock` holds the available quantity as a plain string, no expiry, atomically `DECRBY`/`INCRBY`'d on reserve/release to prevent overselling under concurrency (rolled back if it would go negative).

---

### 5. CartManagement & Wishlist

One cart per `(customer, store)` pair — enforced by a unique constraint. Cart items snapshot the price at time of add. Abandoned carts expire after 7 days; the `CartCleanupScheduler` (daily 2am cron) deletes them and releases reserved inventory. Wishlists are per-customer and not store-scoped; a unique constraint on `(customer_id, product_id)` prevents duplicates.

**Key classes:**
- `CartController` — add/remove/update items, view cart (`/cart/*`)
- `WishlistController` — wishlist management (`/wishlist/*`)
- `CartService` — manages cart lifecycle and item quantities
- `WishlistService` — wishlist lifecycle and move-to-cart
- `CheckoutService` — validates cart → reserves stock → computes totals → (via `OrderService`) creates order and payment

**Cart endpoints** (`CartController` at `/cart`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/cart/{storeId}` | BUYER | Get/create cart for a specific store |
| `POST` | `/cart/items` | BUYER | Add item (storeId derived from product) |
| `PUT`  | `/cart/items/{cartItemId}` | BUYER | Update item quantity |
| `DELETE` | `/cart/items/{cartItemId}` | BUYER | Remove item |
| `DELETE` | `/cart/{storeId}` | BUYER | Clear cart for a specific store |
| `POST` | `/cart/checkout` | BUYER | Run checkout pricing/stock-reservation without creating an order |

**Wishlist endpoints** (`WishlistController` at `/wishlist`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/wishlist` | BUYER | Get own wishlist |
| `POST` | `/wishlist` | BUYER | Add product to wishlist (409 if already present) |
| `DELETE` | `/wishlist/{productId}` | BUYER | Remove product from wishlist |
| `POST` | `/wishlist/{productId}/move-to-cart` | BUYER | Add qty=1 to cart, remove from wishlist |

**Checkout total:**
```
total = subtotal + tax(app.tax.rate, default 0) + shipping(app.shipping.flat-rate, default 25 EGP)
```
Shipping is a flat rate added unconditionally — there is currently no free-shipping threshold logic.

---

### 6. OrderManagement

Orders are created by `CheckoutService` + `OrderService` as part of the `/orders/place` flow. Merchants update order status; customers can cancel `PENDING` orders only (auto-refunds if a `COMPLETED` payment already exists, e.g. wallet payments which settle synchronously). Each order auto-generates an invoice (`INV-{year}-{orderId, 7 digits}`).

**Key classes:**
- `OrderController` — order lifecycle endpoints
- `OrderService` — status transitions, cancellation logic, idempotent order placement
- `OrderEventPublisher` — publishes order status changes to RabbitMQ (see [Event Bus](#event-bus-rabbitmq))

**Status transitions:**
```
PENDING → CONFIRMED → SHIPPED → DELIVERED
PENDING → CANCELLED   (customer only, while still PENDING)
CONFIRMED → CANCELLED (merchant)
```
Any other transition throws a `400`. Marking `→ SHIPPED` with a carrier creates a real DHL/Aramex/Bosta shipment via `ShippingService` (see [IntegrationManagement](#11-integrationmanagement)) and stamps the tracking number. Stock is **not** auto-restored on cancellation — merchants restock manually.

**Endpoints** (`OrderController` at `/orders`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/orders/place` | BUYER | Place order: checkout + create order + initiate payment in one call (idempotent — see below) |
| `GET`  | `/orders/me` | BUYER | My order history |
| `GET`  | `/orders/{orderId}` | BUYER (owner) | Get order by ID |
| `POST` | `/orders/{orderId}/reorder` | BUYER | Re-add all items from a past order to the cart |
| `POST` | `/orders/{orderId}/cancel` | BUYER | Cancel PENDING order |
| `GET`  | `/orders/store/{storeId}` | MERCHANT | List all orders for a store |
| `GET`  | `/orders/store/{storeId}/customers` | MERCHANT | Distinct-customer summary for the store |
| `GET`  | `/orders/store/{storeId}/{orderId}` | MERCHANT (owner) | Get full order details |
| `PUT`  | `/orders/{orderId}/status` | MERCHANT | Update order status |
| `GET`  | `/orders/admin/all` | ADMIN | Paginated list of all orders (supports `?page=0&size=20&sort=orderDate,desc`) |

**Idempotent placement:** a client-supplied `idempotencyKey` is checked against Redis (`order:idempotency:{key}`, 24h TTL) before checkout runs; a cache hit replays the existing order+payment instead of double-charging. A lost race against the DB's unique constraint on `idempotencyKey` releases the losing attempt's reserved stock and returns the winner's order.

**Price snapshots:** both `cart_items.price_at_add` and `order_items.price` store the price at the moment of the transaction, so historical orders are unaffected by product price changes.

---

### 7. PaymentManagement

Implements the **Strategy Pattern** for payment gateways via the `PaymentGatewayAdapter` interface. Currently operational: `CashOnDeliveryAdapter`, `BankTransferAdapter`, `WalletSimulationAdapter`, and `PaymobAdapter` (the only gateway wired to **real, per-store** credentials — see [IntegrationManagement](#11-integrationmanagement)). Stub implementations exist for `FawryAdapter` and `StripeAdapter` — activated when their env var keys are set.

The wallet is a simulated payment method for demo purposes (new customer wallets seed with 100,000 EGP), not connected to a real financial network.

**Key classes:**
- `PaymentController` / `WalletController`
- `PaymentServiceImpl` — orchestrates gateway selection, idempotency, event publishing
- `PaymentEventPublisher` — publishes payment events to RabbitMQ
- `WalletService` — debit/credit wallet balance and transactions, writes an immutable `WalletTransaction` per change
- `PaymentRabbitMQConfig` — declares exchanges and queues for payment events

**Payment endpoints** (`PaymentController` at `/payments`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/payments/initiate` | BUYER | Start payment for an existing order |
| `POST` | `/payments/{paymentId}/confirm` | MERCHANT | Confirm COD or bank transfer payment |
| `GET`  | `/payments/{paymentId}` | Authenticated | Get payment status |
| `GET`  | `/payments/order/{orderId}` | Authenticated | Get payment by order ID |
| `GET`  | `/payments/store/{storeId}` | MERCHANT | List all payments for a store |
| `POST` | `/payments/{paymentId}/refund` | MERCHANT | Issue full/partial refund |

**Wallet endpoints** (`WalletController` at `/wallets`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/wallets/me` | BUYER | Get own wallet balance (auto-created on first access) |
| `POST` | `/wallets/me/topup` | BUYER | Top up wallet balance (simulation, min 1.00 EGP) |
| `GET`  | `/wallets/me/transactions` | BUYER | Own wallet transaction history |
| `GET`  | `/wallets/store/{storeId}` | MERCHANT (owner) | Get store wallet balance |
| `GET`  | `/wallets/store/{storeId}/transactions` | MERCHANT (owner) | Store wallet transaction history |

**Idempotency:** `payment:idempotency:{key}` in Redis (24h TTL, JSON `{paymentId, status}`) short-circuits duplicate gateway calls on retry, in front of the DB-level idempotency key.

---

### 8. NotificationManagement

Consumes RabbitMQ events from OrderManagement and PaymentManagement, then dispatches notifications (email + in-app + SSE). Stores notifications in the `notifications` table for an in-app inbox. No endpoint creates notifications directly — they only ever originate from the two consumers below.

**Key classes:**
- `OrderNotificationConsumer` — `@RabbitListener` on `order.notifications`, handles order status changes
- `PaymentNotificationConsumer` — `@RabbitListener` on `payment.notifications`, handles payment status changes
- `NotificationService` — creates `Notification` records
- `EmailService` — sends transactional emails (order confirmed/shipped/delivered/cancelled, payment confirmed)
- `NotificationController` — in-app inbox API
- `NotificationRabbitMQConfig` — declares the `flowmerce.order` exchange and `order.notifications` queue/binding

Both consumers reach directly into `OrderManagement`'s/`PaymentManagement`'s repositories to build email content (a cross-module coupling point, not a purely event-driven design).

**Endpoints** (`NotificationController` at `/notifications`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/notifications` | Authenticated | Paginated notification inbox (supports `?page=0&size=20`, default 20/page) |
| `GET`  | `/notifications/unread-count` | Authenticated | Count of unread notifications |
| `PUT`  | `/notifications/{notificationId}/read` | Authenticated | Mark single notification as read (403 if not owner) |
| `PUT`  | `/notifications/read-all` | Authenticated | Mark all notifications as read |

---

### 9. StorefrontCustomization

Manages the merchant's customer-facing store design: theme colors, pages, and page components. Uses **Redis cache-aside** for public reads, a separate **ownership cache** to skip repeat DB round-trips on merchant writes, and **write-behind** (async `@Async` DB writes) for design/theme updates to keep latency low.

**Cache keys:**
```
flowmerce:sf:{storeId}          → full storefront (theme + pages + components), TTL = SF_CACHE_TTL_MINUTES (default 30 min)
flowmerce:sf:design:{storeId}   → design/theme only, same TTL
flowmerce:own:{storeId}:{email} → merchant ID (ownership fast-path), fixed 60 s TTL, no explicit eviction — relies purely on expiry
```

**Entity hierarchy:**
```
StorefrontTemplate (1:1 Store)
  └── ThemeTemplate (6 hex colors: background, header, footer, accent, text, card)
  └── Page[]
        └── BaseComponent[]
              └── ComponentDecorator[] (priority-ordered, data as JSON text)
```

**`DecoratorComponent`** is an interface only — no concrete JPA implementations. Decorator behavior is stored in `component_decorators.data` as JSON text.

**Key classes:**
- `StorefrontCustomizationController` — all merchant-facing storefront endpoints
- `StorefrontCustomizationService` — business logic (most-connected node in the graph); every mutating endpoint evicts `flowmerce:sf:{storeId}` **except** media add/delete (a caching gap — see [Known Issues](#known-issues--gaps))
- `StorefrontWriteBehindService` — separate `@Async @Transactional` bean (must be a separate bean from the service so Spring AOP can proxy it) persisting design/theme writes to Postgres after the Redis write
- `RedisConfig` — `StringRedisTemplate` + Jackson `ObjectMapper` bean used for cache (de)serialization

**Merchant endpoints** (`StorefrontCustomizationController` at `/stores/{storeId}/storefront`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores/{storeId}/storefront/init` | MERCHANT (owner) | Create storefront (idempotent — returns the existing one if already created) |
| `GET`  | `/stores/{storeId}/storefront` | MERCHANT (owner) | Get full storefront (dashboard view, always a DB read) |
| `POST` | `/stores/{storeId}/storefront/publish` | MERCHANT (owner) | Publish, bump version, repopulate public cache |
| `POST` | `/stores/{storeId}/storefront/unpublish` | MERCHANT (owner) | Unpublish, evict public cache |
| `GET`  | `/stores/{storeId}/storefront/design` | MERCHANT (owner) | Get design data (cache-aside) |
| `PUT`  | `/stores/{storeId}/storefront/design` | MERCHANT (owner) | Save design data — 0-DB-query fast path if ownership+design both cached, else full DB path; write-behind persist |
| `GET`  | `/stores/{storeId}/storefront/colors` | MERCHANT (owner) | Get theme colors |
| `PUT`  | `/stores/{storeId}/storefront/colors` | MERCHANT (owner) | Update theme colors (same fast/slow-path pattern) |
| `GET`  | `/stores/{storeId}/storefront/pages` | MERCHANT (owner) | List pages |
| `POST` | `/stores/{storeId}/storefront/pages` | MERCHANT (owner) | Create page |
| `GET`  | `/stores/{storeId}/storefront/pages/{pageId}` | MERCHANT (owner) | Get page |
| `PUT`  | `/stores/{storeId}/storefront/pages/{pageId}` | MERCHANT (owner) | Update page |
| `DELETE` | `/stores/{storeId}/storefront/pages/{pageId}` | MERCHANT (owner) | Delete page (the "home" page can't be deleted) |
| `GET`  | `/stores/{storeId}/storefront/pages/{pageId}/components` | MERCHANT (owner) | List components on page |
| `POST` | `/stores/{storeId}/storefront/pages/{pageId}/components` | MERCHANT (owner) | Add component to page |
| `PUT`  | `/stores/{storeId}/storefront/pages/{pageId}/components/{componentId}` | MERCHANT (owner) | Update component |
| `DELETE` | `/stores/{storeId}/storefront/pages/{pageId}/components/{componentId}` | MERCHANT (owner) | Delete component |
| `PUT`  | `/stores/{storeId}/storefront/pages/{pageId}/components/reorder` | MERCHANT (owner) | Reorder components |
| `GET`  | `/stores/{storeId}/storefront/components/{componentId}/decorators` | MERCHANT (owner) | List decorators on component |
| `POST` | `/stores/{storeId}/storefront/components/{componentId}/decorators` | MERCHANT (owner) | Add decorator |
| `PUT`  | `/stores/{storeId}/storefront/components/{componentId}/decorators/{decoratorId}` | MERCHANT (owner) | Update decorator |
| `DELETE` | `/stores/{storeId}/storefront/components/{componentId}/decorators/{decoratorId}` | MERCHANT (owner) | Delete decorator |
| `GET`  | `/stores/{storeId}/storefront/media` | MERCHANT (owner) | List storefront media |
| `POST` | `/stores/{storeId}/storefront/media` | MERCHANT (owner) | Save media reference (does not evict the public cache) |
| `DELETE` | `/stores/{storeId}/storefront/media/{mediaId}` | MERCHANT (owner) | Delete media reference (does not evict the public cache) |

**Public endpoints** (`PublicStorefrontController` at `/public/storefront`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/public/storefront/{storeId}` | Public | Full storefront by store ID (cache-aside via `flowmerce:sf:{storeId}`) |
| `GET`  | `/public/storefront/{storeId}/categories` | Public | Public category list for storefront |
| `GET`  | `/public/storefront/{storeId}/products?categoryId=` | Public | Public product list (optional category filter) |
| `GET`  | `/public/storefront/{storeId}/products/{productId}` | Public | Single public product |

---

### 10. FileStorage

Handles all file/object uploads to MinIO on behalf of every other module (product images, store logos/banners, theme assets, profile pictures, invoices, notification attachments, storefront media). One shared bucket (`MINIO_BUCKET`, default `flowmerce`), sub-divided by folder.

**Key classes:**
- `FileUploadController` — one endpoint per entity type
- `FileStorageService` — uploads to MinIO, ensures the bucket exists, (re)applies a **public-read** bucket policy on every call, persists `FileMetadata`
- `StorageFolder` enum — `PRODUCT_IMAGES`, `STORE_LOGOS`, `STORE_BANNERS`, `THEME_ASSETS`, `USER_PROFILES`, `INVOICES`, `STOREFRONT`, `ATTACHMENTS`, `AI_ASSETS` (unused), `UPLOADS`
- `MinioConfig` — builds the `MinioClient` bean from `minio.url`/`minio.access-key`/`minio.secret-key`

**Object key format:** `{bucket}/{StorageFolder path}/{subPath}/{uuid}.{ext}` — e.g. `flowmerce/products/42/17/9f2c...a1.jpg`.

**Endpoints** (`FileUploadController` at `/api/files`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/files/products/{storeId}/{productId}` | MERCHANT | Upload a product image |
| `POST` | `/api/files/stores/{storeId}/logo` | MERCHANT | Upload a store logo |
| `POST` | `/api/files/stores/{storeId}/banner` | MERCHANT | Upload a store banner |
| `POST` | `/api/files/themes/{storeId}` | MERCHANT | Upload a storefront theme asset |
| `POST` | `/api/files/profiles/{userId}` | Authenticated | Upload a user profile picture |
| `POST` | `/api/files/invoices/{orderId}` | MERCHANT or ADMIN | Upload an invoice PDF |
| `POST` | `/api/files/attachments` | MERCHANT or ADMIN | Upload a notification attachment |
| `POST` | `/api/files/storefront/{storeId}` | MERCHANT | Upload a generic storefront image |
| `GET`  | `/api/files?entityType=&entityId=` | Any authenticated user (no role restriction — inconsistent with its siblings) | List files attached to an entity |
| `DELETE` | `/api/files?url=` | MERCHANT or ADMIN | Soft-delete DB row + remove object from MinIO |

Validation: `image/*` or `application/pdf`, max 10MB. A separate, generic upload path exists at `/uploads` (see [Key Design Decisions](#key-design-decisions)) with stricter content-type validation, used where the caller doesn't need entity association.

---

### 11. IntegrationManagement

Stores and tests **per-store** third-party credentials for payment (Paymob) and shipping (DHL, Aramex, Bosta) providers, encrypted at rest. This is what makes `PaymentManagement`'s `PaymobAdapter` and `OrderManagement`'s shipment creation work without FlowMerce holding its own accounts with these providers — each merchant plugs in their own.

**Key classes:**
- `StoreIntegrationController` — CRUD + connection testing
- `CredentialEncryptionService` — AES-256-GCM (`Base64(IV[12] || ciphertext+tag)`), key from `INTEGRATION_ENCRYPTION_KEY` (required, no default)
- `RequiredCredentialFields` — per-provider required field lists and the masked "preview" field
- `IntegrationCredentialResolver` — read-side used by `PaymobAdapter`/`ShippingService` to fetch a store's decrypted credentials at call time
- `IntegrationTestConnectionProbe` + 4 implementations (Paymob/DHL/Aramex/Bosta) — cheap, side-effect-free live credential checks

**Endpoints** (`StoreIntegrationController` at `/stores/{storeId}/integrations`, all `MERCHANT` + ownership-verified):

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/stores/{storeId}/integrations` | Status of all 4 providers (configured/enabled/masked preview/last verification) |
| `PUT`  | `/stores/{storeId}/integrations/{provider}` | Save/overwrite encrypted credentials — resets to `UNVERIFIED` |
| `PUT`  | `/stores/{storeId}/integrations/{provider}/enabled` | Toggle a provider on/off (requires credentials to already exist) |
| `POST` | `/stores/{storeId}/integrations/{provider}/test` | Live, side-effect-free credential verification against the real provider API |

**Providers:** `PAYMOB`, `DHL`, `ARAMEX`, `BOSTA`. Credential storage (this module) is cleanly separated from credential consumption (`PaymentManagement`, `OrderManagement`'s `ShippingService`) via `IntegrationCredentialResolver`.

---

### 12. AI Assistant

Planned feature: proxy requests to the Groq API server-side, enriching the system prompt with store context (brand name, hex colors, category names, WCAG contrast ratios) to prevent the API key from being exposed to the frontend. Cache repeated pattern questions in Redis (TTL 1 hour).

> **Status:** No AI controller exists in the current codebase. The `ai_suggestions` table is present in the database schema (and cascades on store delete), but the `/ai/*` endpoints are not yet implemented.

**Planned endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/ai/chat` | MERCHANT | Send message to AI advisor |
| `GET`  | `/ai/suggestions/{storeId}` | MERCHANT | Get stored suggestions for store |

---

### 13. Real-Time Events (SSE)

Server-Sent Events for pushing real-time notifications to connected browser clients without WebSocket complexity. Single service (`SseService`) backs two endpoints, both authenticated.

**Key classes:**
- `SseController` — exposes SSE endpoints (`/stream/*`)
- `SseService` — manages emitter registration and event dispatch; emitters never time out (`SseEmitter(Long.MAX_VALUE)`)

**Endpoints** (`SseController` at `/stream`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/stream/private` | Authenticated | Per-user private stream — order updates, account activity, low-stock alerts for the owning merchant |
| `GET`  | `/stream/stock` | Authenticated (any role) | Broadcast stream — fans out to **every** connected client regardless of role/store, despite being intended as merchant-only (see [Known Issues](#known-issues--gaps)) |

**Event types:** `CONNECTED` (welcome, private channel only) · `STOCK_ALERT` (low/out-of-stock, sent to the owning merchant on the private channel) · `ORDER_UPDATE` · `ACCOUNT_ACTIVITY` · generic `broadcast(eventType, data)` for system/flash-sale announcements on the public channel.

**Triggers:** `OrderService.createOrder` sends `ORDER_UPDATE` directly at order creation; all subsequent order/payment status changes arrive indirectly via the two RabbitMQ consumers in NotificationManagement; `InventoryManagement`'s in-process `StockEventListener` sends `STOCK_ALERT` on low/out-of-stock.

---

## Database Schema

All tables use `SERIAL PRIMARY KEY` (integer auto-increment). Key relationships:

```
users ──────────────── admins (1:1)
      ──────────────── customers (1:1)
      ──────────────── merchants (1:1)
      ──────────────── sessions (1:N)
      ──────────────── verification_tokens (1:N)

merchants ──────────── stores (1:N)

stores ─────────────── store_settings (1:1)
       ─────────────── categories (1:N)
       ─────────────── products (1:N)
       ─────────────── shopping_carts (1:N)
       ─────────────── orders (1:N)
       ─────────────── storefront_templates (1:1)
       ─────────────── storefront_media (1:N)
       ─────────────── base_components (1:N)
       ─────────────── store_integrations (1:N, one per provider)

products ────────────── product_media (1:N)
         ────────────── inventory (1:1)
         ────────────── reviews (1:N)

shopping_carts ──────── cart_items (1:N)

orders ──────────────── order_items (1:N)
       ──────────────── invoices (1:1)
       ──────────────── payments (1:N)
       ──────────────── deliveries (1:N)

storefront_templates ── storefront_pages (1:N)
                        theme_templates (1:1 via theme_id)

storefront_pages ─────── base_components (1:N)
base_components ──────── component_decorators (1:N)
```

**Notable constraints:**
- `shopping_carts` has `UNIQUE(customer_id, store_id)` — one cart per customer per store
- `wishlists` has `UNIQUE(customer_id, product_id)` — no duplicate wishlist entries
- `reviews` has `UNIQUE(product_id, customer_id)` — one review per customer per product
- `inventory.version` — optimistic locking column, incremented by Hibernate on every update
- `cart_items.price_at_add`, `order_items.price` — price snapshots, immutable after creation

**Schema management:** `spring.jpa.hibernate.ddl-auto=update` (validated against Supabase; the schema itself is managed directly there, not via Hibernate auto-DDL in normal operation). The full store-deletion cascade chain is enforced with `ON DELETE CASCADE` on the following FK columns:

| Table | Column | Cascades from |
|-------|--------|---------------|
| `orders` | `store_id` | `stores` |
| `categories` | `store_id` | `stores` |
| `products` | `store_id` | `stores` |
| `products` | `category_id` | `categories` |
| `shopping_carts` | `store_id` | `stores` |
| `store_settings` | `store_id` | `stores` |
| `store_integrations` | `store_id` | `stores` |
| `storefront_templates` | `store_id` | `stores` |
| `storefront_media` | `store_id` | `stores` |
| `base_components` | `store_id` | `stores` |
| `ai_suggestions` | `store_id` | `stores` |
| `reports` | `store_id` | `stores` |
| `invoices` | `order_id` | `orders` |
| `payments` | `order_id` | `orders` |
| `deliveries` | `order_id` | `orders` |
| `order_items` | `order_id` | `orders` |
| `shipments` | `order_id` | `orders` |
| `cart_items` | `cart_id` | `shopping_carts` |
| `storefront_pages` | `storefront_id` | `storefront_templates` |
| `base_components` | `page_id` | `storefront_pages` |
| `component_decorators` | `component_id` | `base_components` |
| `product_media` | `product_id` | `products` |
| `order_items` | `product_id` | `products` |
| `cart_items` | `product_id` | `products` |
| `reviews` | `product_id` | `products` |
| `wishlists` | `product_id` | `products` |

---

## Event Bus (RabbitMQ)

Two durable topic exchanges. Both producers treat a publish failure as non-critical (logged, doesn't roll back the triggering transaction).

```
OrderService/OrderEventPublisher ──publishStatusChanged──▶ flowmerce.order (topic)
                                                             └─ binding: order.# ─▶ order.notifications
                                                                                      └─▶ OrderNotificationConsumer
                                                                                            → Notification row + SSE + transactional email

PaymentServiceImpl/PaymentEventPublisher ──publish{Initiated,Succeeded,Failed,Refunded}──▶ flowmerce.payment (topic)
                                                             ├─ binding: payment.* ─▶ payment.notifications
                                                             ├─ binding: wallet.*  ─▶ payment.notifications  (dead — nothing publishes wallet.*)
                                                             └─ binding: payment.webhook.# ─▶ payment.webhooks  (dead — no producer, no consumer)
                                                                                      └─▶ PaymentNotificationConsumer
                                                                                            → Notification row + SSE + transactional email
```

| Exchange | Queue | Routing keys bound | Actually published | Consumer |
|---|---|---|---|---|
| `flowmerce.order` | `order.notifications` | `order.#` | `order.status.updated` (used for **every** status change, including cancellation — there is no separate `order.cancelled` key in practice, despite a constant existing for one) | `OrderNotificationConsumer` |
| `flowmerce.payment` | `payment.notifications` | `payment.*`, `wallet.*` | `payment.initiated`, `payment.succeeded`, `payment.failed`, `payment.refunded` | `PaymentNotificationConsumer` |
| `flowmerce.payment` | `payment.webhooks` | `payment.webhook.#` | _(nothing)_ | _(no listener — scaffolding for an unimplemented inbound-webhook feature)_ |

`OrderNotificationConsumer` reacts to `PROCESSING`\*/`CONFIRMED`/`SHIPPED`/`DELIVERED`/`CANCELLED`; `PaymentNotificationConsumer` reacts to `PENDING`/`PROCESSING`/`COMPLETED`/`FAILED`/`REFUNDED`/`PARTIALLY_REFUNDED`. Each persists a `Notification`, pushes an SSE event, and (for the terminal states) sends a transactional email.

\* `PROCESSING` is dead code in the order consumer — `Order.OrderStatus` has no such value and no transition ever produces one.

Neither `WalletService` nor anything else ever publishes `wallet.debited`/`wallet.credited`, despite the routing keys/binding existing — wallet balance changes surface only indirectly, via the payment events.

Stock alerts (low-stock / out-of-stock) do **not** go through RabbitMQ — they're published as an in-process Spring `ApplicationEventPublisher` event (`StockChangedEvent`) and consumed `@Async` straight into an SSE broadcast, entirely within `InventoryManagement` + `UserManagement.SseService`.

---

## Key Design Decisions

**Payment Gateway — Strategy Pattern**
`PaymentGatewayAdapter` is a Java interface. Each gateway (`BankTransferAdapter`, `CashOnDeliveryAdapter`, `FawryAdapter`, `PaymobAdapter`, `StripeAdapter`, `WalletSimulationAdapter`) is a Spring bean implementing it. `PaymentServiceImpl` selects the correct adapter at runtime based on the requested payment method. Adding a new gateway requires only a new `@Component` implementing the interface.

**Per-store credentials, not a global merchant account**
Unlike Stripe/Fawry (single global API key via env var), Paymob and the shipping carriers (DHL/Aramex/Bosta) are configured **per store** by the merchant, encrypted at rest with AES-256-GCM. `IntegrationManagement` owns storage/testing; `PaymentManagement`/`OrderManagement` only ever consume credentials through `IntegrationCredentialResolver`, keeping storage and consumption cleanly separated.

**Wallet — Simulation Only**
`WalletSimulationAdapter` and `WalletService` simulate wallet debit/credit for demo purposes. The wallet is not connected to a real financial network.

**Storefront Cache — Cache-Aside + Write-Behind**
Public reads (`GET /public/storefront/{storeId}`) are cache-aside via `flowmerce:sf:{storeId}` with a 30-minute TTL, falling back to DB on miss. Merchant writes to design/theme go to Redis immediately (synchronous), then a separate `@Async` bean writes to PostgreSQL in the background — the HTTP response returns before the DB commit completes. A short-lived (60s) ownership cache additionally lets repeat merchant writes skip the DB entirely when both ownership and design are already warm.

**Cart Scoping**
Each cart is scoped to a `(customer, store)` pair. A customer browsing two different stores maintains two independent carts. Carts expire after 7 days of inactivity.

**Price Snapshots**
Both cart items and order items store the product price at the moment of the action (`price_at_add`, `price`). This means price changes never retroactively affect active carts or historical orders.

**Idempotent Storefront Init**
`POST /stores/{storeId}/storefront/init` is safe to call multiple times — it creates the `StorefrontTemplate` only if one does not already exist for that store.

**Idempotent Order Placement & Payment Initiation**
Both `/orders/place` and `/payments/initiate` accept a client-supplied idempotency key, checked against Redis (24h TTL) before any side effect runs, so retried requests replay the original result instead of double-charging or double-creating.

**Optimistic Locking + Redis Fast Path on Inventory**
The `inventory` table has a `version` column managed by JPA `@Version` — concurrent adjustments to the same product fail all but one with a retry-me exception. On top of that, `reserveStock` does an atomic Redis `DECRBY` against a per-product cached counter (rolled back with `INCRBY` on failure) so the overselling check itself doesn't need to round-trip Postgres on the hot path.

**Authentication — Role-Split Controllers**
Auth is split across two controllers: `AuthController` (`/auth/merchant/*`) for merchants and `CustomerAuthController` (`/auth/customer/*`) for customers, plus `SocialAuthController` (`/auth/social/*`) for Google/Facebook merchant login. Profile and password management live in `UserController` (`/users/me`). Merchant profile CRUD is in `MerchantController` (`/merchants/me`). Note: `SecurityConfig` still `permitAll()`s the bare `/auth/activate` and `/auth/reset-password` paths from an earlier unification attempt, but no controller handles them — see [Known Issues](#known-issues--gaps).

**CORS**
`SecurityConfig` allows `http://localhost:*`, `https://*.flowmerce.tech`, and the configured `FRONTEND_URL`. Credentials (cookies + `Authorization` header) are permitted.

**Subdomain routing**
The Next.js middleware rewrites `{slug}.flowmerce.tech` requests to `/store/{slug}` internally, and sets an `x-store-subdomain` header so store pages can tell a true subdomain request apart from a direct `/store/{slug}` URL (the browser's address bar never shows the rewritten path).

**SSE for Real-Time Events**
`SseController` / `SseService` provide Server-Sent Events endpoints for pushing real-time notifications to connected browser clients without WebSocket complexity.

---

## Performance & Caching Architecture

This section documents the layered caching strategy applied to FlowMerce's two highest-frequency bottlenecks — authentication overhead and storefront ownership verification — and presents the benchmark results produced during development.

### Problem Statement

FlowMerce's backend connects to a remotely hosted PostgreSQL instance (Supabase, EU West 1 region accessed via connection pooler). Each network round-trip to the database incurs 100–200 ms of latency under normal conditions. Without caching, every authenticated request incurs **two mandatory database queries** inside `JwtAuthFilter`:

1. `existsByTokenAndIsRevokedFalse(token)` — revocation check against the `sessions` table
2. `userRepository.findByEmail(email)` — live role reload from the `users` table (required for SEC-10: role changes must propagate within the cache TTL)

For write-heavy merchant endpoints (storefront design saves, theme updates), a further ownership verification step added **two additional queries**:

3. `findMerchantByEmail(email)` — ownership assertion
4. `storeRepository.findById(storeId)` — store load

This meant that even a fully cached storefront write cost **4 Supabase round-trips** per request, producing a warm-path floor of approximately **177 ms P50** — unacceptable for an interactive merchant dashboard.

---

### Caching Layer 1 — Ownership Cache (StorefrontCustomization)

**Implementation class:** `StorefrontCustomizationService`

The ownership verification step was isolated into a Redis-backed cache. On the first request for a `(merchantEmail, storeId)` pair, the service performs the full lookup and stores the merchant's ID in Redis (its presence, not its value, is what's checked on the fast path). Subsequent requests within the TTL window skip both the merchant lookup and the store load entirely.

```
Key:    flowmerce:own:{storeId}:{email}
Value:  merchant ID (string)
TTL:    60 seconds, fixed — no explicit eviction on ownership changes
```

On a cache hit, `getStoreAndVerifyOwner` returns immediately without re-verifying ownership against the database. Storefront write operations (`saveDesign`, `updateTheme`) detect the cache hit and dispatch the database persistence asynchronously via `@Async`, returning a 200 OK to the client before the write completes.

#### Ownership Cache Benchmark

**Methodology:** Serial HTTP requests using .NET `HttpClient`, rate-limit bucket cleared between scenarios, Docker Desktop on Windows 11. The "COLD" scenario deletes the ownership key before each request; "WARM" allows the key to persist across the run.

| Scenario | N | Min (ms) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|
| Design PUT — COLD (ownership cache miss) | 30 | 749 | 852 | 1,087 | 1,102 | 1,180 | 1,180 |
| Design PUT — WARM (ownership cache hit) | 80 | 93 | 177 | 203 | 208 | 219 | 219 |

**Result:** Caching ownership reduces write latency from **852 ms to 177 ms P50 — a 4.8× speedup**, eliminating 2 of 4 database round-trips per request.

The remaining 177 ms floor was attributable entirely to the 2 authentication queries that still ran on every request inside `JwtAuthFilter`.

---

### Caching Layer 2 — Two-Tier Session Cache (JwtAuthFilter)

**Implementation class:** `SessionCacheService`

After ownership caching, profiling confirmed that `JwtAuthFilter` was the sole remaining bottleneck. Every request — regardless of how well the business logic was cached — still paid 2 Supabase queries for session validation and role resolution.

The solution is a two-tier Redis session cache that sits in front of the database checks:

```
Tier 1  Key: flowmerce:sess:{sha256(token)[0:24]}       Value: role string   TTL: 30 s (sliding)
Tier 2  Key: flowmerce:sess:etag:{sha256(token)[0:24]}  Value: role string   TTL: 24 h
```

The token is never stored in Redis directly. The key suffix is the first 24 hexadecimal characters (96 bits) of the SHA-256 digest of the raw JWT string — sufficient collision resistance at this scale while keeping the key short.

#### Request Dispatch Logic

```
Incoming authenticated request
        │
        ▼ JWT signature + expiry check (in-memory, HMAC — 0 DB)
        │
        ├─ Tier-1 HIT  ──────────────────────────────── 0 DB queries
        │   TTL refreshed (sliding); role set from Redis.
        │
        ├─ Tier-1 MISS, Tier-2 HIT ──────────────────── 1 DB query
        │   SELECT is_revoked FROM sessions WHERE token = ?
        │   If active → restore Tier-1, reuse Tier-2 role.
        │   If revoked → evict Tier-2, reject request (401).
        │
        └─ Both MISS (full load) ────────────────────── 2 DB queries
            SELECT is_revoked FROM sessions WHERE token = ?
            SELECT role FROM users WHERE email = ?  ← SEC-10 live role
            Store result in both tiers for next request.
```

The Tier-1 TTL is intentionally short (30 seconds) to bound how long a revoked session can be served from cache. The Tier-2 TTL is long (24 hours) to survive across multiple Tier-1 expirations and enable single-query revalidation rather than a full 2-query reload.

#### Cache Correctness — Explicit Eviction

Role changes and session revocations must invalidate the cache immediately regardless of TTL. Every mutation point that affects session validity calls `SessionCacheService` before touching the database:

| Event | Eviction method | Call site |
|---|---|---|
| Logout | `evict(token)` | `AuthService.logout` |
| Refresh token rotation | `evict(oldRefreshToken)` | `AuthService.refreshToken` |
| Password reset | `evictAllForUser(userId)` | `AuthService.resetPassword` |
| Password change | `evictAllForUser(userId)` | `UserService.changePassword` |
| Account deletion | `evictAllForUser(userId)` | `UserService.deleteMyAccount`, `AuthService.deleteCustomerAccount` |
| Admin user deletion | `evictAllForUser(userId)` | `UserService.deleteUserById` |
| Merchant profile creation (role change) | `evictAllForUser(userId)` | `MerchantService.createMerchantProfile` |
| Merchant account deletion | `evictAllForUser(userId)` | `MerchantService.deleteMerchantAccount`, `MerchantService.deleteMerchantById` |

`evictAllForUser` queries `findActiveTokensByUserId(userId)` before calling `revokeAllByUserId` to ensure all active tokens are still queryable at eviction time.

All Redis operations are individually wrapped in `try-catch` and **fail open**: if Redis is unavailable, authentication falls through to the full database load rather than rejecting the request. The same fail-open pattern is used consistently everywhere Redis is touched in the codebase (storefront cache, ownership cache, stock cache, idempotency keys, rate limiting) — a cache outage degrades performance but never breaks a request.

---

### Full Benchmark Results

**Test environment:**
- Host: Windows 11 Pro, Docker Desktop (WSL2 backend)
- Backend: Spring Boot containerized via Docker Compose
- Database: Supabase PostgreSQL 17.6, EU West 1 (accessed via IPv4 session pooler)
- Cache: Redis 7 (Docker container, local network)
- Test tool: .NET `System.Net.Http.HttpClient` — serial requests (no concurrency), each scenario preceded by rate-limit key deletion and one unmeasured warmup request
- Merchant under test: `bench@flowmerce.com`, Store ID 3

| Scenario | N | Min (ms) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) |
|---|---|---|---|---|---|---|---|
| Health check (baseline — no DB, no Redis) | 80 | 87 | 91 | 180 | 182 | 188 | 188 |
| Public storefront read — COLD (DB fallback) | 30 | 6 | 8 | 93 | 93 | 98 | 98 |
| Public storefront read — WARM (Redis) | 80 | 5 | 6 | 8 | 8 | 16 | 16 |
| Design GET — COLD (ownership + design cache miss) | 30 | 256 | 373 | 458 | 475 | 680 | 680 |
| Design GET — WARM (all caches hot) | 80 | 254 | 360 | 457 | 462 | 468 | 468 |
| Design PUT — COLD (ownership cache miss, pre-session cache) | 30 | 749 | 852 | 1,087 | 1,102 | 1,180 | 1,180 |
| Design PUT — WARM (ownership cache, pre-session cache) | 80 | 93 | 177 | 203 | 208 | 219 | 219 |
| Design PUT — WARM (all caches hot, post-session cache) | 100 | 8 | 16 | 30 | 33 | 48 | 48 |

#### Isolated Session Cache Impact

To isolate the session cache contribution, the test deleted both Redis tier keys before each individual request (forcing a full load) and compared against the tier-1 hit path:

| Auth path | DB queries | P50 latency | Notes |
|---|---|---|---|
| Full load (both tiers empty) | 2 (auth) + 2 (business logic) | ~635 ms | `existsByTokenAndIsRevokedFalse` + `findByEmail` + 2 endpoint queries |
| Tier-1 hit | 0 (auth) + 2 (business logic) | ~363 ms | Role served from Redis |
| Delta (session cache savings) | −2 | ~272 ms saved | ≈ 2 × 136 ms per Supabase round-trip |

---

### Summary of Speedups

| Optimization | Cold P50 | Warm P50 | Speedup | DB queries eliminated |
|---|---|---|---|---|
| Ownership cache (StorefrontCustomization) | 852 ms | 177 ms | **4.8×** | 2 per write request |
| Session cache (JwtAuthFilter) — write path | 177 ms | 16 ms | **11×** | 2 per every authenticated request |
| Combined (both caches active) | 852 ms | 16 ms | **53×** | 4 per write request |

The public storefront read path — the highest-traffic endpoint serving customer-facing pages — drops from a DB-backed 8 ms (P50, already fast due to the public endpoint bypassing auth) to a Redis-only **6 ms P50** with the cache warm.

---

### Correctness Verification

The following scenarios were verified after both caching layers were deployed:

| Test | Expected | Result |
|---|---|---|
| Unauthenticated request | 401 | PASS |
| First request (cold, full load) — tier-1 and tier-2 keys created | Both keys present, role = `MERCHANT` | PASS |
| Second request (tier-1 hit) — TTL refreshed | 200, TTL increases | PASS |
| Tier-1 deleted, tier-2 intact — revalidation restores tier-1 | 200, tier-1 recreated | PASS |
| Logout — both tiers evicted | Both keys deleted | PASS |
| Old JWT used after logout | 401 | PASS |
| Refresh token rotation — new access token issued | 200 with new token | PASS |
| Password change — all user sessions evicted, old token rejected | Keys deleted, old token → 401 | PASS |

---

## Testing

### Overview

The test suite is structured in three tiers, matching the delivery phases:

1. **Unit Tests** — isolated service logic with all dependencies mocked (JUnit 5 + Mockito)
2. **Integration Tests** — controller slice tests using `MockMvc standaloneSetup` (no Spring context needed)
3. **E2E Scenarios** — manual walkthrough scripts for three user personas

---

### Part 1 — Unit Tests (Backend)

**Framework:** JUnit 5 · Mockito · AssertJ
**Pattern:** `@ExtendWith(MockitoExtension.class)` + `@MockitoSettings(strictness = Strictness.LENIENT)` + `@InjectMocks`
**Spring Boot 4.0 note:** `@MockBean` / `@WebMvcTest` were removed in Spring Boot 4.x. All controller tests use `MockMvcBuilders.standaloneSetup()` instead.

#### U-ORD — OrderService

| ID | Scenario | Expected Outcome | Actual Outcome |
|---|---|---|---|
| U-ORD-01 | Place order with valid checkout summary | Order created, invoice generated, cart confirmed | PASS |
| U-ORD-02 | Same idempotency key → Redis cache hit | Returns existing order, no duplicate | PASS |
| U-ORD-03 | Empty cart → BadRequestException | Exception with "empty cart" message | PASS |
| U-ORD-04 | Cancel PENDING order | Status → CANCELLED, order saved | PASS |
| U-ORD-05 | Cancel SHIPPED order | BadRequestException with "cannot be cancelled" | PASS |
| U-ORD-06 | Status transition CONFIRMED → SHIPPED | Status updated, event published | PASS |
| U-ORD-07 | Invalid transition SHIPPED → PENDING | BadRequestException "Invalid status transition" | PASS |
| U-ORD-08 | Get order belonging to different customer | ForbiddenException | PASS |
| U-ORD-09 | getOrderItemsForReorder on own order | Returns list of AddToCartRequest DTOs | PASS |
| U-ORD-10 | getAllOrders (admin) | Returns paginated OrderSummary page | PASS |

**Result: 10/10 tests passed**

---

#### U-CART — CartService

| ID | Scenario | Expected Outcome | Actual Outcome |
|---|---|---|---|
| U-CART-01 | Add item with sufficient stock | Cart item added, total recalculated | PASS |
| U-CART-02 | Add item exceeding available stock | BadRequestException — insufficient stock | PASS |
| U-CART-03 | Add item from inactive product | BadRequestException — product not available | PASS |
| U-CART-04 | Update quantity to valid number | Quantity updated, total recalculated | PASS |
| U-CART-05 | Update quantity exceeds stock | BadRequestException | PASS |
| U-CART-06 | Remove item | Item deleted, cart total decremented | PASS |
| U-CART-07 | Get cart for known customer+store | Returns CartResponse with items | PASS |
| U-CART-08 | Get cart — cart not found | ResourceNotFoundException | PASS |
| U-CART-09 | Clear cart | Cart emptied, success message returned | PASS |

**Result: 9/9 tests passed**

---

#### U-INV — InventoryServiceImpl

| ID | Scenario | Expected Outcome | Actual Outcome |
|---|---|---|---|
| U-INV-01 | adjustStock — valid quantity | Stock updated, transaction logged, event published | PASS |
| U-INV-02 | adjustStock — optimistic lock conflict | BadRequestException containing "conflict" | PASS |
| U-INV-03 | reserveStock — sufficient stock | true returned, reservedQuantity incremented | PASS |
| U-INV-04 | reserveStock — insufficient stock | false returned, Redis key restored | PASS |
| U-INV-05 | releaseStock — valid release | reservedQuantity decremented, Redis incremented | PASS |
| U-INV-06 | releaseStock — more than reserved | BadRequestException "Cannot release more than reserved" | PASS |
| U-INV-07 | checkAvailability — sufficient | true | PASS |
| U-INV-08 | checkAvailability — insufficient | false | PASS |
| U-INV-09 | adjustStock — inventory not found | ResourceNotFoundException | PASS |

**Result: 9/9 tests passed**

---

#### U-AUTH — AuthService

| ID | Scenario | Expected Outcome | Actual Outcome |
|---|---|---|---|
| U-AUTH-01 | Register with new email | User created, merchant profile saved, activation email sent | PASS |
| U-AUTH-02 | Register with duplicate email | ConflictException "already registered" | PASS |
| U-AUTH-03 | Activate with valid token | User isActive becomes true, token used becomes true | PASS |
| U-AUTH-04 | Activate with expired token | BadRequestException "expired" | PASS |
| U-AUTH-05 | Activate with invalid/unknown token | BadRequestException | PASS |
| U-AUTH-06 | Forgot password — registered email | Reset token created, password reset email sent | PASS |
| U-AUTH-07 | Forgot password — unknown email | `BadRequestException` thrown, 400 response, no email sent | PASS |
| U-AUTH-08 | Reset password with valid token | Password hash updated, token marked used | PASS |

**Result: 8/8 tests passed**

---

#### U-PAY — PaymentServiceImpl

| ID | Scenario | Expected Outcome | Actual Outcome |
|---|---|---|---|
| U-PAY-01 | Initiate COD payment | PENDING payment created, COD adapter invoked | PASS |
| U-PAY-02 | Idempotency cache hit | Returns cached payment, no adapter invoked | PASS |
| U-PAY-03 | Confirm PENDING payment | Status becomes COMPLETED, event published | PASS |
| U-PAY-04 | Full refund on COMPLETED payment | Status becomes REFUNDED, refund event published | PASS |
| U-PAY-05 | Partial refund | Status becomes PARTIALLY_REFUNDED | PASS |
| U-PAY-06 | Refund on PENDING payment | BadRequestException "Only completed payments" | PASS |
| U-PAY-07 | Refund amount exceeds payment | BadRequestException "exceeds payment amount" | PASS |
| U-PAY-08 | Confirm already-COMPLETED payment | BadRequestException "cannot be confirmed" | PASS |

**Result: 8/8 tests passed**

---

### Part 2 — Integration Tests (Controller Slice)

**Framework:** JUnit 5 · Mockito · Spring MockMvc (`MockMvcBuilders.standaloneSetup`)
**Setup:** Each controller is instantiated directly. `GlobalExceptionHandler` is registered via `.setControllerAdvice()`.
**No Spring context required.** Services are mocked with `@Mock`.

#### CartController Slice Tests

| ID | Scenario | Expected HTTP | Actual Outcome |
|---|---|---|---|
| I-CART-01 | GET /cart/{storeId} — authenticated buyer | 200 + cart data | PASS |
| I-CART-02 | POST /cart/items — valid payload | 200 + cart data | PASS |
| I-CART-03 | DELETE /cart/items/{id} — item not found | 404 | PASS |
| I-CART-04 | POST /cart/items — inactive product | 400 | PASS |
| I-CART-05 | PUT /cart/items/{id} — update quantity | 200 + cart data | PASS |
| I-CART-06 | DELETE /cart/{storeId} — clear cart | 200 + success message | PASS |
| I-CART-07 | POST /cart/items with text/plain Content-Type | 415 | PASS |

**Result: 7/7 tests passed**

---

#### OrderController Slice Tests

| ID | Scenario | Expected HTTP | Actual Outcome |
|---|---|---|---|
| I-ORD-01 | GET /orders/me — buyer | 200 + array | PASS |
| I-ORD-02 | GET /orders/{id} — own order | 200 + order detail | PASS |
| I-ORD-03 | GET /orders/{id} — not found | 404 | PASS |
| I-ORD-04 | GET /orders/{id} — another customer | 403 | PASS |
| I-ORD-05 | POST /orders/{id}/cancel — pending order | 200 + CANCELLED status | PASS |
| I-ORD-06 | POST /orders/{id}/cancel — shipped order | 400 | PASS |
| I-ORD-07 | PUT /orders/{id}/status — merchant updates | 200 + new status | PASS |
| I-ORD-08 | GET /orders/store/{storeId} — merchant role | 200 + array | PASS |

**Result: 8/8 tests passed**

---

### Summary

| Tier | Tests Run | Passed | Failed |
|---|---|---|---|
| Unit — OrderService | 10 | 10 | 0 |
| Unit — CartService | 9 | 9 | 0 |
| Unit — InventoryServiceImpl | 9 | 9 | 0 |
| Unit — AuthService | 8 | 8 | 0 |
| Unit — PaymentServiceImpl | 8 | 8 | 0 |
| Integration — CartController | 7 | 7 | 0 |
| Integration — OrderController | 8 | 8 | 0 |
| **Total** | **59** | **59** | **0** |

---

### Part 3 — E2E Scenarios (Manual)

Run against the live Docker stack: frontend `http://localhost:3000`, backend `http://localhost:8080/api/v1`. In production substitute `https://flowmerce.tech` and `https://api.flowmerce.tech/api/v1`.

#### Persona 1 — Merchant Journey

**Pre-condition:** Fresh environment, no existing account.

1. Navigate to `http://localhost:3000` — signup page loads
2. Fill name, email, password → click GET STARTED → confirm "check your email" message
3. Open inbox → click activation link → "Account activated" shown
4. Navigate to `/login` → log in → redirect to `/dashboard`
5. Complete onboarding: store name, logo, payment methods (Wallet + COD) → save
6. Create product: name, price = 150 EGP, stock = 10, category → confirm appears in product list
7. Upload product image → thumbnail shown
8. Go to store settings → click Publish store
9. Click View Live Store → `/store/{slug}` loads with branding and product visible
10. Navigate to `/dashboard/analytics` → charts render
11. Navigate to `/dashboard/settings` → change store name → save → verify updated
12. Navigate to `/dashboard/design` → add banner component → save
13. Log out → redirect to `/login`

**Expected:** Complete merchant lifecycle — registered, store live, product visible, design customised.

---

#### Persona 2 — Customer Journey

**Pre-condition:** Persona 1 complete; store published with at least one product in stock.

1. Navigate to `/store/{slug}` → store homepage visible
2. Click product → product detail page shows image, name, price, stock status
3. Click Add to Cart → cart badge increments to 1
4. Proceed to checkout without login → redirect to `/store/{slug}/login`
5. Register as customer (new email) → activate via email link
6. Log in → return to store cart (items preserved or re-add)
7. Go to checkout → fill in delivery address
8. Select Wallet payment → wallet balance shows 0
9. Navigate to `/store/{slug}/account/wallet` → top up 500 EGP
10. Return to checkout → complete order → redirect to `/store/{slug}/confirmation`
11. Confirm order ID visible on confirmation page
12. Navigate to `/store/{slug}/account/orders` → order appears with PENDING status
13. Open order detail → items, total, payment method correct
14. Submit product review: 4 stars + comment → review appears on product page
15. Add product to wishlist → visible in `/store/{slug}/wishlist`
16. Move wishlist item to cart → cart updated
17. Cancel the order → status becomes CANCELLED
18. Verify wallet balance restored to 500 EGP

**Expected:** Complete customer journey — discovered product, purchased, reviewed, and cancelled.

---

#### Persona 3 — Admin Journey

**Pre-condition:** Admin credentials available. Personas 1 & 2 complete.

1. Log in as admin → redirect to `/admin`
2. `/admin/users` → merchant and customer from Personas 1 & 2 visible
3. Deactivate customer account → status changes; re-activate → access restored
4. `/admin/merchants` → merchant from Persona 1 listed → click Verify merchant
5. `/admin/stores` → published store visible
6. `/admin/orders` → order from Persona 2 visible with details
7. `/admin/categories` → create global category "Electronics"
8. Switch to merchant login → product creation form includes "Electronics"
9. Log out → redirect to `/login`

**Expected:** Admin can manage all platform actors and platform-wide entities.

---

#### Cross-Persona Verification Checklist

- [ ] Merchant wallet shows credited amount equal to order total
- [ ] Product stock = 10 (restored after cancellation)
- [ ] Product review visible on public product detail page
- [ ] Merchant dashboard shows new-order notification
- [ ] Customer account shows order status update notification
- [ ] Admin user list shows all 3 accounts (merchant, customer, admin)
- [ ] New "Electronics" category visible to merchant in product form

---

## Known Issues / Gaps

Found while auditing the actual source against this document (full detail with file:line references in `Back end/BACKEND_REFERENCE.md`):

- **Orphaned routes**: `SecurityConfig` still `permitAll()`s `/auth/activate` and `/auth/reset-password`, but no controller serves them (a leftover from an earlier unification attempt) — requests 404. Activation/reset emails correctly link to frontend routes instead.
- **`payment.webhooks` queue and `wallet.debited`/`wallet.credited` routing keys** are fully wired but have no producer and no consumer — dead scaffolding.
- **`OrderNotificationConsumer`'s `PROCESSING` branch** is unreachable — no `OrderStatus` value or transition produces it.
- **Ownership cache (`flowmerce:own:`) has no explicit eviction** — a store-ownership change only takes effect after its 60s TTL lapses.
- **Storefront media add/delete don't evict the public cache** — unlike every other mutating storefront endpoint.
- **`ReviewController`'s ADMIN delete branch is non-functional** — the service always resolves the caller as a `Customer` and throws for an admin caller despite the `@PreAuthorize` allowing it.
- **`StoreCategoryController` has no ownership check** — any authenticated MERCHANT can create/delete categories under any `storeId`.
- **`InventoryController`'s store-inventory listing** likewise has no ownership check.
- **`UserService.deleteMyAccount` (self-delete)** is thinner than the admin delete path — no cascade cleanup of `Customer`/`Merchant`/`Store`/`UserProfile`/notifications.
- **`GET /api/files` has no role restriction**, unlike every sibling endpoint in `FileUploadController`.
- **MFA is scaffolded but unimplemented** — `MfaVerifyRequest` DTO and `User.isMfaEnabled` exist with no backing endpoint.
- **`/stream/stock` is not actually merchant-scoped** despite its code comment claiming so — every authenticated user receives every stock event.
- **`/uploads` POST/GET storage-backend mismatch** — the generic `common/UploadController` POST writes to MinIO, but its GET still serves from local disk; callers should use the MinIO URL returned by the POST rather than the GET.
