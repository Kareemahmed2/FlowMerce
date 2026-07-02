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
   - [CartManagement](#5-cartmanagement)
   - [OrderManagement](#6-ordermanagement)
   - [PaymentManagement](#7-paymentmanagement)
   - [NotificationManagement](#8-notificationmanagement)
   - [StorefrontCustomization](#9-storefrontcustomization)
   - [AI Assistant](#10-ai-assistant)
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
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
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
        └── Anthropic Claude API   — AI advisor (proxied, server-side)
```

**Module structure:** All modules live in the same Spring Boot application under `com.example.flowmerceproject.*`. They communicate via:
- Direct service calls (synchronous, within the same JVM)
- RabbitMQ exchanges (asynchronous, for order and payment events)

**Roles:** `ADMIN` · `MERCHANT` · `CUSTOMER`

---

## Running Locally

### Prerequisites
- Java 17+
- Docker (for local Postgres, RabbitMQ, Redis via `compose.yaml`)

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

| Service | Image | Port |
|---------|-------|------|
| postgres | `postgres:latest` | 5432 |
| rabbitmq | `rabbitmq:latest` | 5672 |
| redis | `redis/redis-stack:latest` | 6379 |

> The live application connects to **Supabase** (configured in `application.properties`). Switch `spring.datasource.url` to `jdbc:postgresql://localhost:5432/mydatabase` for local-only development.

---

## Environment Variables

All values have defaults for local development. Override for production.

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRY` | `86400000` | JWT expiry in ms (24h) |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USERNAME` | `guest` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `SF_CACHE_TTL_MINUTES` | `30` | Storefront Redis cache TTL |
| `INVENTORY_LOW_STOCK_THRESHOLD` | `5` | Threshold for low-stock events |
| `SHIPPING_FLAT_RATE` | `25.00` | Flat shipping cost (EGP) |
| `TAX_RATE` | `0.00` | Tax rate (0 for MVP) |
| `STRIPE_SECRET_KEY` | _(empty)_ | Activates Stripe gateway |
| `PAYMOB_API_KEY` | _(empty)_ | Activates Paymob gateway |
| `FAWRY_MERCHANT_CODE` | _(empty)_ | Activates Fawry gateway |
| `FAWRY_SECURITY_KEY` | _(empty)_ | Activates Fawry gateway |

Mail (Gmail SMTP) and database credentials are currently hardcoded in `application.properties` — move them to environment variables before deploying to production.

---

## API Conventions

**Base URL:** `http://localhost:8080/api/v1`

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

**Key classes:**
- `UnifiedAuthController` — single entry point for all auth flows
- `AuthService` — business logic, email dispatch, token generation
- `SecurityConfig` — Spring Security filter chain, CORS, password encoder
- `JwtAuthFilter` / `JwtUtil` — token parsing and validation
- `GlobalExceptionHandler` — maps domain exceptions to HTTP responses

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | Public | Register merchant or customer |
| `POST` | `/auth/login` | Public | Login, returns JWT + refresh token |
| `POST` | `/auth/refresh` | Public | Refresh expired JWT |
| `GET`  | `/auth/activate?token=` | Public | Activate account via email link |
| `POST` | `/auth/forgot-password` | Public | Send password reset email |
| `POST` | `/auth/reset-password` | Public | Reset password with token |
| `GET`  | `/auth/me` | Any role | Get current user profile |
| `PUT`  | `/auth/me/password` | Any role | Change password |
| `PUT`  | `/auth/me/profile` | Any role | Update profile |
| `DELETE` | `/auth/me` | CUSTOMER | Delete own account |
| `GET`  | `/admin/users` | ADMIN | List all users |
| `GET`  | `/admin/merchants` | ADMIN | List all merchants |
| `DELETE` | `/admin/users/{id}` | ADMIN | Delete user |
| `DELETE` | `/admin/merchants/{id}` | ADMIN | Delete merchant |

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
| `GET`  | `/stores/my` | MERCHANT | List own stores |
| `GET`  | `/stores/{id}` | MERCHANT | Get store by ID |
| `PUT`  | `/stores/{id}` | MERCHANT | Update store |
| `DELETE` | `/stores/{id}` | MERCHANT | Delete store |
| `GET`  | `/stores/{id}/slug` | MERCHANT | Get store URL slug |
| `POST` | `/stores/{id}/publish` | MERCHANT | Publish store |
| `POST` | `/stores/{id}/unpublish` | MERCHANT | Unpublish store |
| `PUT`  | `/stores/{id}/onboarding` | MERCHANT | Advance onboarding step |
| `PUT`  | `/stores/{id}/brand` | MERCHANT | Update brand (name, logo) |
| `PUT`  | `/stores/{id}/payment-methods` | MERCHANT | Set accepted payment methods |
| `GET`  | `/stores/{id}/settings` | MERCHANT | Get store settings |
| `PUT`  | `/stores/{id}/settings` | MERCHANT | Update store settings |
| `GET`  | `/admin/stores` | ADMIN | List all stores |

**Store status flow:** `DRAFT` → `ACTIVE` (published) → `INACTIVE` (unpublished)

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

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores/{storeId}/products` | MERCHANT | Create product |
| `GET`  | `/stores/{storeId}/products` | MERCHANT | List products |
| `GET`  | `/stores/{storeId}/products/{id}` | MERCHANT | Get product |
| `PUT`  | `/stores/{storeId}/products/{id}` | MERCHANT | Update product |
| `DELETE` | `/stores/{storeId}/products/{id}` | MERCHANT | Delete product |
| `POST` | `/stores/{storeId}/products/{id}/media` | MERCHANT | Upload image |
| `DELETE` | `/stores/{storeId}/products/{id}/media/{mediaId}` | MERCHANT | Delete image |
| `GET`  | `/stores/{storeId}/categories` | Any | List categories |
| `POST` | `/stores/{storeId}/categories` | MERCHANT | Create category |
| `PUT`  | `/stores/{storeId}/categories/{id}` | MERCHANT | Update category |
| `DELETE` | `/stores/{storeId}/categories/{id}` | MERCHANT | Delete category |
| `GET`  | `/stores/{storeId}/catalog` | Public | Public catalog (categories + products) |
| `POST` | `/products/{id}/reviews` | CUSTOMER | Leave review |
| `GET`  | `/products/{id}/reviews` | Public | Get reviews |
| `PUT`  | `/products/{id}/reviews/{reviewId}` | CUSTOMER | Update own review |
| `DELETE` | `/products/{id}/reviews/{reviewId}` | CUSTOMER | Delete own review |

---

### 4. InventoryManagement

Tracks stock per product with **optimistic locking** (`@Version` on the `inventory` table) to prevent overselling under concurrency. Supports multiple deduction strategies. A scheduler runs at 2 AM daily to release reserved stock from abandoned carts.

**Key classes:**
- `InventoryController` / `InventoryServiceImpl` — stock queries and adjustments
- `InventoryStrategyFactory` — selects deduction strategy (e.g. `FlashSaleStrategy`)
- `InventoryTransactionRepository` — audit log of all stock changes

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/stores/{storeId}/inventory` | MERCHANT | List inventory |
| `GET`  | `/stores/{storeId}/inventory/{productId}` | MERCHANT | Get stock level |
| `PUT`  | `/stores/{storeId}/inventory/{productId}` | MERCHANT | Update stock |
| `POST` | `/stores/{storeId}/inventory/{productId}/restock` | MERCHANT | Restock product |
| `GET`  | `/stores/{storeId}/inventory/low-stock` | MERCHANT | Items below threshold |

**Low-stock threshold:** configurable via `INVENTORY_LOW_STOCK_THRESHOLD` (default 5). A `StockChangedEvent` is published when stock falls below it.

---

### 5. CartManagement

One cart per `(customer, store)` pair — enforced by a unique constraint. Cart items snapshot the price at time of add. Abandoned carts expire after 7 days; the `CartCleanupScheduler` deletes them and releases reserved inventory.

**Key classes:**
- `CartController` — add/remove/update items, view cart
- `CartService` — manages cart lifecycle and item quantities
- `CheckoutService` — validates cart → reserves stock → creates order and payment

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/stores/{storeId}/cart` | CUSTOMER | View cart |
| `POST` | `/stores/{storeId}/cart/items` | CUSTOMER | Add item |
| `PUT`  | `/stores/{storeId}/cart/items/{itemId}` | CUSTOMER | Update quantity |
| `DELETE` | `/stores/{storeId}/cart/items/{itemId}` | CUSTOMER | Remove item |
| `DELETE` | `/stores/{storeId}/cart` | CUSTOMER | Clear cart |
| `POST` | `/stores/{storeId}/cart/checkout` | CUSTOMER | Checkout → creates order |
| `GET`  | `/stores/{storeId}/cart/summary` | CUSTOMER | Checkout summary (subtotal, shipping, tax) |

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

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/orders/my` | CUSTOMER | My order history |
| `GET`  | `/orders/{id}` | CUSTOMER/MERCHANT | Get order |
| `DELETE` | `/orders/{id}` | CUSTOMER | Cancel PENDING order |
| `GET`  | `/stores/{storeId}/orders` | MERCHANT | List store orders |
| `PUT`  | `/stores/{storeId}/orders/{id}/status` | MERCHANT | Update status |
| `GET`  | `/stores/{storeId}/orders/{id}` | MERCHANT | Get order details |

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

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/payments/initiate` | CUSTOMER | Start payment for an order |
| `POST` | `/payments/confirm` | CUSTOMER | Confirm payment (gateway callback) |
| `GET`  | `/payments/{id}` | CUSTOMER | Get payment status |
| `GET`  | `/payments/order/{orderId}` | CUSTOMER | Get payment by order |
| `POST` | `/payments/{id}/refund` | MERCHANT | Refund payment |
| `GET`  | `/wallet/my` | CUSTOMER | Get own wallet |
| `GET`  | `/wallet/my/transactions` | CUSTOMER | Own transaction history |
| `POST` | `/wallet/top-up` | CUSTOMER | Top up wallet balance |
| `GET`  | `/wallet/store/{storeId}` | MERCHANT | Get store wallet |
| `GET`  | `/wallet/store/{storeId}/transactions` | MERCHANT | Store transaction history |

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

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/notifications` | Any role | Get notifications for current user |
| `PUT`  | `/notifications/{id}/read` | Any role | Mark as read |
| `DELETE` | `/notifications/{id}` | Any role | Delete notification |

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

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stores/{storeId}/storefront/init` | MERCHANT | Create storefront (idempotent) |
| `GET`  | `/stores/{storeId}/storefront` | MERCHANT | Dashboard view |
| `POST` | `/stores/{storeId}/storefront/publish` | MERCHANT | Publish + populate cache |
| `POST` | `/stores/{storeId}/storefront/unpublish` | MERCHANT | Unpublish + evict cache |
| `GET`  | `/stores/{storeId}/storefront/colors` | MERCHANT | Get theme colors |
| `PUT`  | `/stores/{storeId}/storefront/colors` | MERCHANT | Update theme (write-behind) |
| `GET`  | `/public/storefront/{storeUrl}` | Public | Public storefront (cache-aside) |

---

### 10. AI Assistant

Proxies requests to the Anthropic Claude API server-side, enriching the system prompt with store context: brand name, hex colors, category names, and WCAG contrast ratios. This prevents the API key from being exposed to the frontend.

**Model:** `claude-sonnet-4-20250514`  
**Cache:** Redis, TTL 1 hour, for repeated pattern questions.

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/ai/chat` | MERCHANT | Send message to AI advisor |
| `GET`  | `/ai/suggestions/{storeId}` | MERCHANT | Get stored suggestions for store |

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
`WalletSimulationAdapter` and `WalletService` simulate wallet debit/credit for demo purposes. The wallet is not connected to a real financial network. This is documented in `PAYMENT_SERVICE_REPORT.md`.

**Storefront Cache — Write-Behind**  
Merchant theme/color updates go to Redis immediately (synchronous), then a `@Async` bean writes to PostgreSQL in the background. Public reads (`GET /public/storefront/{storeUrl}`) are served from Redis with a 30-minute TTL and fall back to DB on cache miss.

**Cart Scoping**  
Each cart is scoped to a `(customer, store)` pair. A customer browsing two different stores maintains two independent carts. Carts expire after 7 days of inactivity.

**Price Snapshots**  
Both cart items and order items store the product price at the moment of the action (`price_at_add`, `price`). This means price changes never retroactively affect active carts or historical orders.

**Idempotent Storefront Init**  
`POST /stores/{storeId}/storefront/init` is safe to call multiple times — it creates the `StorefrontTemplate` only if one does not already exist for that store.

**Optimistic Locking on Inventory**  
The `inventory` table has a `version` column managed by JPA `@Version`. Concurrent checkout requests that try to decrement the same product's stock will have all but one fail with an optimistic lock exception, preventing overselling without pessimistic database locks.

**Authentication — Unified Controller**  
`UnifiedAuthController` handles all auth flows (merchant, customer, admin) in a single class. Role-specific behavior is branched internally on the `role` field in the request or the authenticated principal's role.

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
| U-AUTH-07 | Forgot password — unknown email | Returns silently (no enumeration), no email sent | PASS |
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

Run against the live Docker stack: frontend `http://localhost:3000`, backend `http://localhost:8080/api/v1`.

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
