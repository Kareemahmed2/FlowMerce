# FlowMerce — Backend Documentation

**Cairo University Faculty of Computers & Information — Graduation Project 2025–2026**

FlowMerce is a smart e-commerce platform builder for SMEs. Its core differentiator is an AI-powered UX/UI advisor that guides merchants through store design decisions — filling the gap that Shopify, Salla, and WooCommerce leave for users who lack design expertise, particularly in the Egyptian market.

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
   - [AI Assistant](#10-ai-assistant)
   - [Real-Time Events (SSE)](#11-real-time-events-sse)
8. [Database Schema](#database-schema)
9. [Event Bus (RabbitMQ)](#event-bus-rabbitmq)
10. [Key Design Decisions](#key-design-decisions)
11. [Performance & Caching Architecture](#performance--caching-architecture)
12. [Testing](#testing)

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
| Backend | Spring Boot 3 · Java 17 |
| Frontend | Next.js 14 · TypeScript |
| Database | PostgreSQL (Supabase) |
| Cache | Redis |
| Message Queue | RabbitMQ |
| File Storage | MinIO |
| AI | Groq API |
| Auth | JWT (24h) + Refresh Token (30d) + RBAC |
| Testing | JUnit 5 · Testcontainers (Postgres, RabbitMQ, Redis) |

---

## Architecture Overview

```
[Next.js 14 Frontend]
        │
        ▼ REST (JSON)
[Spring Boot Backend]   ─── base path: /api/v1
        │
        ├── PostgreSQL (Supabase)   — persistent data
        ├── Redis                   — storefront cache, session
        ├── RabbitMQ               — async order/payment events
        ├── MinIO                  — product images, store logos
        └── Groq API               — AI advisor (proxied, server-side)
```

**Module structure:** All modules live in the same Spring Boot application under `com.example.flowmerceproject.*`. They communicate via:
- Direct service calls (synchronous, within the same JVM)
- RabbitMQ exchanges (asynchronous, for order and payment events)

**Roles:** `ADMIN` · `MERCHANT` · `BUYER` (Spring Security role name for customers)

---

## Running Locally

### Prerequisites
- Java 17+
- Docker (for local RabbitMQ, Redis, MinIO via `compose.yaml`)

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
> MinIO is **not** run by `compose.yaml` — it runs on a separate host. Set `MINIO_URL` (and `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`MINIO_BUCKET`/`MINIO_PUBLIC_URL` as needed) in `.env` to point the backend at it.

---

## Environment Variables

All values have defaults for local development. Override for production.

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRY` | `86400000` | JWT expiry in ms (24h) |
| `BACKEND_URL` | `http://localhost:8080` | Base URL the backend uses for self-referencing links (email activation/reset links, upload image URLs) — set to `https://api.flowmerce.tech` in production |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USERNAME` | `guest` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `MINIO_URL` | `http://minio:9000` | MinIO S3 API endpoint the backend connects to — MinIO runs on a separate host, point this at wherever it's reachable |
| `MINIO_PUBLIC_URL` | _(= `MINIO_URL`)_ | Public URL used when building links returned to the browser, if different from `MINIO_URL` |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | `flowmerce` | MinIO bucket name (created automatically, public-read policy applied automatically) |
| `SF_CACHE_TTL_MINUTES` | `30` | Storefront Redis cache TTL |
| `INVENTORY_LOW_STOCK_THRESHOLD` | `5` | Threshold for low-stock events |
| `SHIPPING_FLAT_RATE` | `25.00` | Flat shipping cost (EGP) |
| `TAX_RATE` | `0.00` | Tax rate (0 for MVP) |
| `STRIPE_SECRET_KEY` | _(empty)_ | Activates Stripe gateway |
| `PAYMOB_API_KEY` | _(empty)_ | Activates Paymob gateway |
| `FAWRY_MERCHANT_CODE` | _(empty)_ | Activates Fawry gateway |
| `FAWRY_SECURITY_KEY` | _(empty)_ | Activates Fawry gateway |

Mail (Gmail SMTP), database credentials, and `jwt.secret` are currently hardcoded in `application.properties` — move all secrets to environment variables before deploying to production.

---

## API Conventions

**Base URL:** `http://localhost:8080/api/v1` (dev) · `https://api.flowmerce.tech/api/v1` (production)

**Authentication:** `Authorization: Bearer <JWT>` on all protected routes.

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

Handles registration, login, email verification, password reset, JWT issuance, and profile management for three roles: Admin, Merchant, and Customer. Uses `@OncePerRequestFilter` (JwtAuthFilter) to validate tokens on every request. Sessions are persisted in the `sessions` table and can be revoked.

**Forgot password behaviour:** Returns `400 Bad Request` with the message `"No account found with this email address."` if the email is not registered. No email is sent and no token is created for unknown addresses.

**Role names:** The Spring Security role used in `@PreAuthorize` for customer-facing operations is `BUYER` (e.g. `hasRole('BUYER')`), not `CUSTOMER`.

**Key classes:**
- `AuthController` — merchant auth flows (`/auth/merchant/*`)
- `CustomerAuthController` — customer auth flows (`/auth/customer/*`)
- `UnifiedAuthController` — shared token endpoints (`/auth/activate`, `/auth/reset-password`)
- `UserController` — profile and password management (`/users/me`)
- `MerchantController` — merchant profile CRUD (`/merchants/me`)
- `AdminController` — admin operations (`/admin/*`)
- `AuthService` — business logic, email dispatch, token generation
- `SecurityConfig` — Spring Security filter chain, CORS, password encoder
- `JwtAuthFilter` / `JwtUtil` — token parsing and validation
- `GlobalExceptionHandler` — maps domain exceptions to HTTP responses

**Merchant auth endpoints** (`AuthController` at `/auth/merchant`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/merchant/register` | Public | Register merchant account |
| `GET`  | `/auth/merchant/activate?token=` | Public | Activate merchant account |
| `POST` | `/auth/merchant/login` | Public | Login, returns JWT + refresh token |
| `POST` | `/auth/merchant/refresh` | Public | Refresh expired JWT |
| `POST` | `/auth/merchant/logout` | Public | Revoke JWT (Authorization header required) |
| `GET`  | `/auth/merchant/me` | Authenticated | Get current merchant profile |
| `POST` | `/auth/merchant/forgot-password` | Public | Send password reset email |
| `POST` | `/auth/merchant/reset-password` | Public | Reset password with token |

**Customer auth endpoints** (`CustomerAuthController` at `/auth/customer`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/customer/register` | Public | Register customer account |
| `GET`  | `/auth/customer/activate?token=` | Public | Activate customer account |
| `POST` | `/auth/customer/login` | Public | Login, returns JWT + refresh token |
| `POST` | `/auth/customer/refresh` | Public | Refresh expired JWT |
| `POST` | `/auth/customer/logout` | Public | Revoke JWT (Authorization header required) |
| `GET`  | `/auth/customer/me` | Authenticated | Get current customer profile |
| `POST` | `/auth/customer/forgot-password` | Public | Send password reset email |
| `POST` | `/auth/customer/reset-password` | Public | Reset password with token |
| `DELETE` | `/auth/customer/me` | Authenticated | Delete own customer account |

**Shared auth endpoints** (`UnifiedAuthController` at `/auth`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/auth/activate?token=` | Public | Activate account (email link target) |
| `POST` | `/auth/reset-password` | Public | Reset password with token |

**User profile endpoints** (`UserController` at `/users`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/users/me` | Authenticated | Get own profile |
| `PUT`  | `/users/me` | Authenticated | Update profile |
| `PUT`  | `/users/me/change-password` | Authenticated | Change password |
| `DELETE` | `/users/me` | Authenticated | Delete own account |

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
| `DELETE` | `/admin/users/{userId}` | ADMIN | Delete user by ID |
| `GET`  | `/admin/merchants` | ADMIN | List all merchants |
| `PUT`  | `/admin/merchants/{merchantId}/verify` | ADMIN | Verify/approve merchant |
| `DELETE` | `/admin/merchants/{merchantId}` | ADMIN | Delete merchant by ID |
| `GET`  | `/admin/stores` | ADMIN | List all stores |

**Verification token types:** `ACTIVATION` · `PASSWORD_RESET`  
Tokens are single-use, have an `expires_at`, and are stored in `verification_tokens`.

---

### 2. Store Management

A merchant can own multiple stores. Each store has an onboarding flow (steps 0–5), a publish/unpublish state, branding, and configurable settings (currency, timezone, language, shipping, tax).

**Key classes:**
- `StoreController` — CRUD + publish/unpublish
- `StoreService` — slug generation, step advancement
- `AdminController` — admin-level store/merchant management
- `MerchantController` / `MerchantService` — merchant profile

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores` | MERCHANT | Create store |
| `GET`  | `/stores/me` | MERCHANT | List own stores |
| `GET`  | `/stores/{storeId}` | MERCHANT | Get store by ID |
| `PUT`  | `/stores/{storeId}` | MERCHANT | Update store |
| `DELETE` | `/stores/{storeId}` | MERCHANT | Delete store |
| `GET`  | `/stores/slug/{slug}` | Authenticated | Get store by URL slug |
| `POST` | `/stores/{storeId}/publish` | MERCHANT | Publish store |
| `POST` | `/stores/{storeId}/unpublish` | MERCHANT | Unpublish store |
| `PUT`  | `/stores/{storeId}/onboarding-step` | MERCHANT | Advance onboarding step |
| `PUT`  | `/stores/{storeId}/brand` | MERCHANT | Update brand (name, logo) |
| `PUT`  | `/stores/{storeId}/payment-methods` | MERCHANT | Set accepted payment methods |
| `GET`  | `/stores/{storeId}/settings` | MERCHANT | Get store settings |
| `PUT`  | `/stores/{storeId}/settings` | MERCHANT | Update store settings |

**Store status values:** `DRAFT` · `PUBLISHED` · `PAUSED` · `DEACTIVATED`  
A store starts as `DRAFT`. `POST /stores/{storeId}/publish` transitions to `PUBLISHED`; `/unpublish` transitions to `PAUSED`.

---

### 3. ProductManagement

Products belong to a store and optionally a category. Each product has a media gallery stored in MinIO. Customers can leave one review per product (rating 1–5). A public catalog endpoint serves storefront customers.

**Key classes:**
- `ProductController` — product CRUD, media management
- `CategoryController` / `CategoryService` — category tree
- `ReviewController` / `ReviewService` — product reviews

**MinIO structure:**
```
flowmerce-assets/
  logos/{storeId}/logo.{ext}
  products/{storeId}/{productId}/{imageId}.{ext}
```

**Product endpoints** (`ProductController` at `/stores/{storeId}/products`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores/{storeId}/products` | MERCHANT | Create product |
| `GET`  | `/stores/{storeId}/products` | MERCHANT | List all store products |
| `GET`  | `/stores/{storeId}/products/public` | Public | List active/published products |
| `GET`  | `/stores/{storeId}/products/search?keyword=` | Public | Search products by keyword |
| `GET`  | `/stores/{storeId}/products/{productId}` | Public | Get product by ID |
| `PUT`  | `/stores/{storeId}/products/{productId}` | MERCHANT | Update product |
| `PATCH` | `/stores/{storeId}/products/{productId}/status` | MERCHANT | Toggle product active/inactive |
| `DELETE` | `/stores/{storeId}/products/{productId}` | MERCHANT | Delete product |
| `POST` | `/stores/{storeId}/products/{productId}/media` | MERCHANT | Add media (upload URL) |
| `DELETE` | `/stores/{storeId}/products/{productId}/media/{mediaId}` | MERCHANT | Delete media |

**Category endpoints** (`CategoryController` at `/categories`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/categories` | Public | List all categories |
| `GET`  | `/categories/{id}` | Public | Get category by ID |
| `POST` | `/categories` | ADMIN | Create category |
| `PUT`  | `/categories/{id}` | ADMIN | Update category |
| `DELETE` | `/categories/{id}` | ADMIN | Delete category |

**Review endpoints** (`ReviewController` at `/products/{productId}/reviews`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/products/{productId}/reviews` | Public | Get reviews for product |
| `POST` | `/products/{productId}/reviews` | BUYER | Submit review |
| `PUT`  | `/products/{productId}/reviews` | BUYER | Edit own review (review identified by authenticated user) |
| `DELETE` | `/products/{productId}/reviews/{reviewId}` | BUYER or ADMIN | Delete review |

> **Note:** The public catalog (categories + products for a storefront) is served by `PublicStorefrontController` — see the StorefrontCustomization module.

---

### 4. InventoryManagement

Tracks stock per product with **optimistic locking** (`@Version` on the `inventory` table) to prevent overselling under concurrency. Supports multiple deduction strategies. A scheduler runs at 2 AM daily to release reserved stock from abandoned carts.

**Key classes:**
- `InventoryController` / `InventoryServiceImpl` — stock queries and adjustments
- `InventoryStrategyFactory` — selects deduction strategy (e.g. `FlashSaleStrategy`)
- `InventoryTransactionRepository` — audit log of all stock changes

**Endpoints** (`InventoryController`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `PATCH` | `/products/{productId}/stock` | MERCHANT | Update stock quantity |
| `GET`  | `/stores/{storeId}/inventory` | MERCHANT | List all inventory for a store |
| `POST` | `/stores/{storeId}/inventory/{productId}/restock` | MERCHANT | Restock a product |
| `GET`  | `/stores/{storeId}/inventory/{productId}/history` | MERCHANT | Transaction history for a product |
| `GET`  | `/inventory/{productId}` | Authenticated | Get inventory details for a product |
| `GET`  | `/inventory/{productId}/check?qty=` | Authenticated | Check stock availability for a quantity |
| `POST` | `/inventory/adjust` | MERCHANT | Adjust stock with optional strategy (legacy) |
| `POST` | `/inventory/reserve` | BUYER | Reserve stock for checkout (internal) |
| `POST` | `/inventory/release` | BUYER or ADMIN | Release reserved stock (internal) |

**Low-stock threshold:** configurable via `INVENTORY_LOW_STOCK_THRESHOLD` (default 5). A `StockChangedEvent` is published when stock falls below it.

---

### 5. CartManagement & Wishlist

One cart per `(customer, store)` pair — enforced by a unique constraint. Cart items snapshot the price at time of add. Abandoned carts expire after 7 days; the `CartCleanupScheduler` deletes them and releases reserved inventory. Wishlists are per-customer and not store-scoped; a unique constraint on `(customer_id, product_id)` prevents duplicates.

**Key classes:**
- `CartController` — add/remove/update items, view cart (`/cart/*`)
- `WishlistController` — wishlist management (`/wishlist/*`)
- `CartService` — manages cart lifecycle and item quantities
- `WishlistService` — wishlist lifecycle and move-to-cart
- `CheckoutService` — validates cart → reserves stock → creates order and payment

**Cart endpoints** (`CartController` at `/cart`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/cart/{storeId}` | BUYER | View cart for a specific store |
| `POST` | `/cart/items` | BUYER | Add item (storeId derived from product) |
| `PUT`  | `/cart/items/{cartItemId}` | BUYER | Update item quantity |
| `DELETE` | `/cart/items/{cartItemId}` | BUYER | Remove item |
| `DELETE` | `/cart/{storeId}` | BUYER | Clear cart for a specific store |
| `POST` | `/cart/checkout` | BUYER | Checkout — storeId comes from request body |

**Wishlist endpoints** (`WishlistController` at `/wishlist`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/wishlist` | BUYER | Get own wishlist |
| `POST` | `/wishlist` | BUYER | Add product to wishlist |
| `DELETE` | `/wishlist/{productId}` | BUYER | Remove product from wishlist |
| `POST` | `/wishlist/{productId}/move-to-cart` | BUYER | Move wishlist item to cart |

**Shipping calculation:**
```
shipping = 0           if subtotal > store.freeThreshold
         = SHIPPING_FLAT_RATE  otherwise (default 25 EGP)
```

---

### 6. OrderManagement

Orders are created by `CheckoutService`. Merchants update order status; customers can cancel PENDING orders only. Each order auto-generates an invoice (`INV-{year}-{orderId padded to 5 digits}`).

**Key classes:**
- `OrderController` — order lifecycle endpoints
- `OrderService` — status transitions, cancellation logic
- `OrderEventPublisher` — fires `order.placed`, `order.shipped`, `order.delivered` to RabbitMQ

**Status transitions:**
```
PENDING → CONFIRMED → SHIPPED → DELIVERED
PENDING → CANCELLED  (customer only)
```

**Endpoints** (`OrderController` at `/orders`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/orders/place` | BUYER | Place order: checkout + create order + initiate payment in one call |
| `GET`  | `/orders/me` | BUYER | My order history |
| `GET`  | `/orders/{orderId}` | BUYER | Get order by ID |
| `POST` | `/orders/{orderId}/cancel` | BUYER | Cancel PENDING order |
| `GET`  | `/orders/store/{storeId}` | MERCHANT | List all orders for a store |
| `GET`  | `/orders/store/{storeId}/{orderId}` | MERCHANT | Get full order details |
| `PUT`  | `/orders/{orderId}/status` | MERCHANT | Update order status |
| `GET`  | `/orders/admin/all` | ADMIN | Paginated list of all orders (supports `?page=0&size=20&sort=orderDate,desc`) |

**Price snapshots:** both `cart_items.price_at_add` and `order_items.price` store the price at the moment of the transaction, so historical orders are unaffected by product price changes.

---

### 7. PaymentManagement

Implements the **Strategy Pattern** for payment gateways via the `PaymentGatewayAdapter` interface. Currently operational: `CashOnDeliveryAdapter`, `BankTransferAdapter`, `WalletSimulationAdapter`. Stub implementations exist for `FawryAdapter`, `PaymobAdapter`, `StripeAdapter` — activated when their env var keys are set.

The wallet is a simulated payment method for demo purposes, not connected to a real financial network.

**Key classes:**
- `PaymentController` / `WalletController`
- `PaymentServiceImpl` — orchestrates gateway selection, idempotency, event publishing
- `PaymentEventPublisher` — fires payment events to RabbitMQ
- `WalletService` — debit/credit wallet balance and transactions
- `PaymentRabbitMQConfig` — declares exchanges and queues for payment events

**Payment endpoints** (`PaymentController` at `/payments`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/payments/initiate` | BUYER | Start payment for an existing order |
| `POST` | `/payments/{paymentId}/confirm` | MERCHANT | Confirm COD or bank transfer payment |
| `GET`  | `/payments/{paymentId}` | Authenticated | Get payment status |
| `GET`  | `/payments/order/{orderId}` | Authenticated | Get payment by order ID |
| `POST` | `/payments/{paymentId}/refund` | MERCHANT | Issue refund |

**Wallet endpoints** (`WalletController` at `/wallets`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/wallets/me` | BUYER | Get own wallet balance |
| `POST` | `/wallets/me/topup` | BUYER | Top up wallet balance (simulation) |
| `GET`  | `/wallets/me/transactions` | BUYER | Own wallet transaction history |
| `GET`  | `/wallets/store/{storeId}` | MERCHANT | Get store wallet balance |
| `GET`  | `/wallets/store/{storeId}/transactions` | MERCHANT | Store wallet transaction history |

**Idempotency:** `PaymentRepository` stores an `idempotency_key` per payment to prevent duplicate charges on retry.

---

### 8. NotificationManagement

Consumes RabbitMQ events from OrderManagement and PaymentManagement, then dispatches notifications (email / in-app). Stores notifications in the `notifications` table for an in-app inbox.

**Key classes:**
- `OrderNotificationConsumer` — handles `order.*` events
- `PaymentNotificationConsumer` — handles `payment.*` events
- `NotificationService` — creates `Notification` records, sends email via `EmailService`
- `NotificationController` — in-app inbox API
- `NotificationRabbitMQConfig` — declares the notification queues and bindings

**Endpoints** (`NotificationController` at `/notifications`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/notifications` | Authenticated | Paginated notification inbox (supports `?page=0&size=20`) |
| `GET`  | `/notifications/unread-count` | Authenticated | Count of unread notifications |
| `PUT`  | `/notifications/{notificationId}/read` | Authenticated | Mark single notification as read |
| `PUT`  | `/notifications/read-all` | Authenticated | Mark all notifications as read |

---

### 9. StorefrontCustomization

Manages the merchant's customer-facing store design: theme colors, pages, and page components. Uses **Redis cache-aside** for public reads and **write-behind** (async `@Async` DB writes) for merchant updates to keep latency low.

**Cache key:** `storefront:public:{storeUrl}`  
**Cache TTL:** `SF_CACHE_TTL_MINUTES` (default 30 minutes)

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
- `StorefrontCustomizationService` — business logic (most-connected node in the graph)
- `StorefrontWriteBehindService` — `@Async` DB persistence after cache update
- `RedisConfig` — `StringRedisTemplate` with Jackson serialization

**Merchant endpoints** (`StorefrontCustomizationController` at `/stores/{storeId}/storefront`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores/{storeId}/storefront/init` | MERCHANT | Create storefront (idempotent) |
| `GET`  | `/stores/{storeId}/storefront` | MERCHANT | Get full storefront (dashboard view) |
| `POST` | `/stores/{storeId}/storefront/publish` | MERCHANT | Publish + populate Redis cache |
| `POST` | `/stores/{storeId}/storefront/unpublish` | MERCHANT | Unpublish + evict Redis cache |
| `GET`  | `/stores/{storeId}/storefront/design` | MERCHANT | Get design data (JSON) |
| `PUT`  | `/stores/{storeId}/storefront/design` | MERCHANT | Save design data (write-behind) |
| `GET`  | `/stores/{storeId}/storefront/colors` | MERCHANT | Get theme colors |
| `PUT`  | `/stores/{storeId}/storefront/colors` | MERCHANT | Update theme colors (write-behind) |
| `GET`  | `/stores/{storeId}/storefront/pages` | MERCHANT | List pages |
| `POST` | `/stores/{storeId}/storefront/pages` | MERCHANT | Create page |
| `GET`  | `/stores/{storeId}/storefront/pages/{pageId}` | MERCHANT | Get page |
| `PUT`  | `/stores/{storeId}/storefront/pages/{pageId}` | MERCHANT | Update page |
| `DELETE` | `/stores/{storeId}/storefront/pages/{pageId}` | MERCHANT | Delete page |
| `GET`  | `/stores/{storeId}/storefront/pages/{pageId}/components` | MERCHANT | List components on page |
| `POST` | `/stores/{storeId}/storefront/pages/{pageId}/components` | MERCHANT | Add component to page |
| `PUT`  | `/stores/{storeId}/storefront/pages/{pageId}/components/{componentId}` | MERCHANT | Update component |
| `DELETE` | `/stores/{storeId}/storefront/pages/{pageId}/components/{componentId}` | MERCHANT | Delete component |
| `PUT`  | `/stores/{storeId}/storefront/pages/{pageId}/components/reorder` | MERCHANT | Reorder components |
| `GET`  | `/stores/{storeId}/storefront/components/{componentId}/decorators` | MERCHANT | List decorators on component |
| `POST` | `/stores/{storeId}/storefront/components/{componentId}/decorators` | MERCHANT | Add decorator |
| `PUT`  | `/stores/{storeId}/storefront/components/{componentId}/decorators/{decoratorId}` | MERCHANT | Update decorator |
| `DELETE` | `/stores/{storeId}/storefront/components/{componentId}/decorators/{decoratorId}` | MERCHANT | Delete decorator |
| `GET`  | `/stores/{storeId}/storefront/media` | MERCHANT | List storefront media |
| `POST` | `/stores/{storeId}/storefront/media` | MERCHANT | Save media reference |
| `DELETE` | `/stores/{storeId}/storefront/media/{mediaId}` | MERCHANT | Delete media reference |

**Public endpoints** (`PublicStorefrontController` at `/public/storefront`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/public/storefront/{storeId}` | Public | Full storefront by store ID (cache-aside) |
| `GET`  | `/public/storefront/{storeId}/categories` | Public | Public category list for storefront |
| `GET`  | `/public/storefront/{storeId}/products?categoryId=` | Public | Public product list (optional category filter) |
| `GET`  | `/public/storefront/{storeId}/products/{productId}` | Public | Single public product |

---

### 10. AI Assistant

Planned feature: proxy requests to the Groq API server-side, enriching the system prompt with store context (brand name, hex colors, category names, WCAG contrast ratios) to prevent the API key from being exposed to the frontend. Cache repeated pattern questions in Redis (TTL 1 hour).

> **Status:** No AI controller exists in the current codebase. The `ai_suggestions` table is present in the database schema (and cascades on store delete), but the `/ai/*` endpoints are not yet implemented.

**Planned endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/ai/chat` | MERCHANT | Send message to AI advisor |
| `GET`  | `/ai/suggestions/{storeId}` | MERCHANT | Get stored suggestions for store |

---

### 11. Real-Time Events (SSE)

Server-Sent Events for pushing real-time notifications to connected browser clients without WebSocket complexity.

**Key classes:**
- `SseController` — exposes SSE endpoints (`/stream/*`)
- `SseService` — manages emitter registration and event dispatch

**Endpoints** (`SseController` at `/stream`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/stream/private` | Authenticated | Private SSE stream — user-specific events |
| `GET`  | `/stream/stock` | Public | Broadcast SSE stream — stock-level change events |

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

**Schema management:** `spring.jpa.hibernate.ddl-auto=none` — Hibernate does not create or modify the schema. All tables and FK constraints are managed directly in Supabase. The full store-deletion cascade chain is enforced with `ON DELETE CASCADE` on the following FK columns:

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

| Event routing key | Publisher | Consumer | Trigger |
|-------------------|-----------|----------|---------|
| `order.placed` | `OrderEventPublisher` | `OrderNotificationConsumer` | Checkout completes |
| `order.shipped` | `OrderEventPublisher` | `OrderNotificationConsumer` | Merchant marks shipped |
| `order.delivered` | `OrderEventPublisher` | `OrderNotificationConsumer` | Merchant marks delivered |
| `order.cancelled` | `OrderEventPublisher` | `OrderNotificationConsumer` | Order cancelled |
| `payment.initiated` | `PaymentEventPublisher` | `PaymentNotificationConsumer` | Payment started |
| `payment.success` | `PaymentEventPublisher` | `PaymentNotificationConsumer` | Gateway confirms payment |
| `payment.failed` | `PaymentEventPublisher` | `PaymentNotificationConsumer` | Gateway rejects payment |
| `stock.low` | `InventoryServiceImpl` | _(future: MerchantNotification)_ | Stock < threshold |

**Exchange topology:**
- `order.exchange` (direct) → `order.notification.queue`
- `payment.exchange` (direct) → `payment.notification.queue`, `payment.wallet.queue`, `payment.webhook.queue`
- `notification.exchange` (direct) → `notification.order.queue`, `notification.payment.queue`

---

## Key Design Decisions

**Payment Gateway — Strategy Pattern**  
`PaymentGatewayAdapter` is a Java interface. Each gateway (`BankTransferAdapter`, `CashOnDeliveryAdapter`, `FawryAdapter`, `PaymobAdapter`, `StripeAdapter`, `WalletSimulationAdapter`) is a Spring bean implementing it. `PaymentServiceImpl` selects the correct adapter at runtime based on the requested payment method. Adding a new gateway requires only a new `@Component` implementing the interface.

**Wallet — Simulation Only**  
`WalletSimulationAdapter` and `WalletService` simulate wallet debit/credit for demo purposes. The wallet is not connected to a real financial network.

**Storefront Cache — Write-Behind**  
Merchant theme/color updates go to Redis immediately (synchronous), then a `@Async` bean writes to PostgreSQL in the background. Public reads (`GET /public/storefront/{storeId}`) are served from Redis with a 30-minute TTL and fall back to DB on cache miss.

**Cart Scoping**  
Each cart is scoped to a `(customer, store)` pair. A customer browsing two different stores maintains two independent carts. Carts expire after 7 days of inactivity.

**Price Snapshots**  
Both cart items and order items store the product price at the moment of the action (`price_at_add`, `price`). This means price changes never retroactively affect active carts or historical orders.

**Idempotent Storefront Init**  
`POST /stores/{storeId}/storefront/init` is safe to call multiple times — it creates the `StorefrontTemplate` only if one does not already exist for that store.

**Optimistic Locking on Inventory**  
The `inventory` table has a `version` column managed by JPA `@Version`. Concurrent checkout requests that try to decrement the same product's stock will have all but one fail with an optimistic lock exception, preventing overselling without pessimistic database locks.

**Authentication — Role-Split Controllers**  
Auth is split across three controllers: `AuthController` (`/auth/merchant/*`) for merchants, `CustomerAuthController` (`/auth/customer/*`) for customers, and `UnifiedAuthController` (`/auth/activate`, `/auth/reset-password`) for shared token endpoints. Profile and password management live in `UserController` (`/users/me`). Merchant profile CRUD is in `MerchantController` (`/merchants/me`).

**CORS**  
`SecurityConfig` allows `http://localhost:3000` and `https://*.flowmerce.tech`. Credentials (`Authorization` header) are permitted.

**Subdomain routing**  
The Next.js middleware rewrites `{slug}.flowmerce.tech` requests to `/store/{slug}` so each merchant's storefront is served from its own subdomain without a separate deployment.

**SSE for Real-Time Events**  
`SseController` / `SseService` provide a Server-Sent Events endpoint for pushing real-time notifications to connected browser clients without WebSocket complexity.

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

The ownership verification step was isolated into a Redis-backed cache. On the first request for a `(merchantEmail, storeId)` pair, the service performs the full lookup and stores a boolean flag in Redis. Subsequent requests within the TTL window skip both the merchant lookup and the store load entirely.

```
Key:    flowmerce:own:{storeId}:{email}
Value:  "true"
TTL:    60 seconds
```

On a cache hit, `getStoreAndVerifyOwner` returns immediately without touching the database. Storefront write operations (`saveDesign`, `updateTheme`) detect the cache hit and dispatch the database persistence asynchronously via `@Async`, returning a 200 OK to the client before the write completes.

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

All Redis operations are individually wrapped in `try-catch` and **fail open**: if Redis is unavailable, authentication falls through to the full database load rather than rejecting the request.

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
