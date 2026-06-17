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
