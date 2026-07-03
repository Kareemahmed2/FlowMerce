# FlowMerce Backend — Full Reference

Exhaustive catalog of every REST endpoint, every Redis cache, every RabbitMQ exchange/queue/listener, every SSE channel, and the other cross-cutting technology in the Spring Boot backend. Compiled by reading the actual source (not from `DOCUMENTATION.md`, which contains at least one stale claim — see [Known Discrepancies](#known-discrepancies--dead-code)).

All paths below are relative to `server.servlet.context-path=/api/v1` (e.g. `/auth/merchant/login` is really `/api/v1/auth/merchant/login`).

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Cross-Cutting Infrastructure](#cross-cutting-infrastructure)
   - [Redis — full inventory](#redis--full-inventory)
   - [RabbitMQ — full event bus](#rabbitmq--full-event-bus)
   - [Server-Sent Events (SSE)](#server-sent-events-sse)
   - [Security filter chain](#security-filter-chain)
3. [Module Reference](#module-reference)
   1. [UserManagement](#1-usermanagement)
   2. [StoreMangement](#2-storemangement)
   3. [StorefrontCustomization](#3-storefrontcustomization)
   4. [ProductManagement](#4-productmanagement)
   5. [InventoryManagement](#5-inventorymanagement)
   6. [CartManagement + Wishlist](#6-cartmanagement--wishlist)
   7. [OrderManagement](#7-ordermanagement)
   8. [PaymentManagement + Wallet](#8-paymentmanagement--wallet)
   9. [NotificationManagement](#9-notificationmanagement)
   10. [FileStorage](#10-filestorage)
   11. [IntegrationManagement](#11-integrationmanagement)
   12. [common (Upload)](#12-common-upload)
4. [Known Discrepancies / Dead Code](#known-discrepancies--dead-code)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language / framework | Java, Spring Boot 4 (Jackson 3), Spring Security, Spring Data JPA |
| Database | PostgreSQL (Supabase, EU-West-1, via Supavisor session pooler) |
| Cache | Redis (`redis/redis-stack`), accessed exclusively via `StringRedisTemplate` — no `@Cacheable`/Spring Cache abstraction anywhere |
| Messaging | RabbitMQ (topic exchanges, JSON messages via `Jackson2JsonMessageConverter`) |
| Real-time push | Server-Sent Events (`SseEmitter`), no WebSockets |
| Object storage | MinIO (S3-compatible), accessed via `io.minio` SDK |
| Auth | JWT (`io.jsonwebtoken`), httpOnly scoped cookies (merchant/customer namespaces) + Bearer header support, Google/Facebook OAuth2 |
| Email | Gmail SMTP (Jakarta Mail) |
| Encryption | AES-256-GCM for per-store third-party credentials (`IntegrationManagement`) |
| Payments | Paymob (real, per-store credentials), Stripe/Fawry (stub), Bank Transfer, Cash-on-Delivery, internal Wallet simulation |
| Shipping | DHL / Aramex / Bosta adapters (per-store credentials via `IntegrationManagement`) |

---

## Cross-Cutting Infrastructure

### Redis — full inventory

Every Redis key in the codebase, in one place. All use `StringRedisTemplate` directly — there is no generic `RedisTemplate` and no `@Cacheable` annotation anywhere.

| Key pattern | TTL | Value | Purpose | Module | Eviction |
|---|---|---|---|---|---|
| `flowmerce:sess:{sha256(jwt)[:24]}` | 30s, sliding (refreshed on every hit) | role string | **Tier-1** session/role cache — 0 DB queries on hit | UserManagement (`SessionCacheService`, backs `JwtAuthFilter`) | Explicit on logout, refresh-rotation, password change, account deletion, role change (see below) |
| `flowmerce:sess:etag:{sha256(jwt)[:24]}` | 24h | role string | **Tier-2** long-lived fallback — 1 DB query (session-revocation check) on hit, restores Tier-1 | UserManagement (`SessionCacheService`) | Same as Tier-1 |
| `rl:{ip}:{auth\|uploads\|api}` | 60s | request counter | Rate limiting (30/60/300 req per 60s respectively) | UserManagement (`RateLimitFilter`) | Natural expiry only |
| `flowmerce:sf:{storeId}` | 30 min (`storefront.cache.ttl-minutes`) | full storefront JSON (theme + pages + components) | Public storefront read cache | StorefrontCustomization | Explicit, on every mutating storefront/page/component/decorator call **except** media add/delete (gap — see discrepancies) |
| `flowmerce:sf:design:{storeId}` | 30 min | design/theme JSON | Design-only read cache | StorefrontCustomization | Overwritten directly (not deleted) on every design/theme save |
| `flowmerce:own:{storeId}:{email}` | 60s, fixed | merchant ID string | Store-ownership verification fast-path (skips 2 DB round-trips) | StorefrontCustomization | **No explicit eviction anywhere** — relies purely on the 60s TTL |
| `product:{productId}:stock` | none (no expiry set) | available quantity (int string) | Available-stock cache, atomically `DECRBY`/`INCRBY`'d to prevent overselling under concurrency | InventoryManagement (`InventoryServiceImpl`) | Never expires; only overwritten on recompute |
| `order:idempotency:{key}` | 24h | orderId string | Idempotent order placement (replay-safe checkout) | OrderManagement (`OrderService`) | Natural expiry only |
| `payment:idempotency:{key}` | 24h | JSON `{paymentId, status}` | Idempotent payment initiation | PaymentManagement (`PaymentServiceImpl`) | Natural expiry only |

All cache operations across every module wrap Redis calls in try/catch and **fail open** (log a warning, fall through to DB) — a Redis outage degrades performance but never breaks a request.

Two independent `StringRedisTemplate`/config setups exist: `StorefrontCustomization/config/RedisConfig.java` (also defines the shared Jackson `ObjectMapper` bean used for cache JSON (de)serialization) is the only `@Configuration` class that declares the bean; other modules autowire the same `StringRedisTemplate`.

### RabbitMQ — full event bus

Two topic exchanges, both "fire-and-forget with logged failure" (a publish failure never rolls back the triggering transaction).

```
OrderService/OrderEventPublisher ──publishStatusChanged──▶ flowmerce.order (topic)
                                                             └─ binding: order.# ─▶ order.notifications
                                                                                      └─▶ OrderNotificationConsumer
                                                                                            → Notification row + SSE (ORDER_UPDATE/ACCOUNT_ACTIVITY) + transactional email

PaymentServiceImpl/PaymentEventPublisher ──publish{Initiated,Succeeded,Failed,Refunded}──▶ flowmerce.payment (topic)
                                                             ├─ binding: payment.* ─▶ payment.notifications
                                                             ├─ binding: wallet.*  ─▶ payment.notifications  (dead — nothing ever publishes wallet.*)
                                                             └─ binding: payment.webhook.# ─▶ payment.webhooks  (dead — no producer, no @RabbitListener)
                                                                                      └─▶ PaymentNotificationConsumer
                                                                                            → Notification row + SSE (ACCOUNT_ACTIVITY) + transactional email
```

| Exchange | Config class | Queue | Routing keys bound | Consumer |
|---|---|---|---|---|
| `flowmerce.order` (durable topic) | `NotificationManagement/config/NotificationRabbitMQConfig.java` | `order.notifications` (durable) | `order.#` (catches `order.status.updated`; `order.cancelled` constant exists but is never published) | `OrderNotificationConsumer.handleOrderEvent` |
| `flowmerce.payment` (durable topic) | `PaymentManagement/config/PaymentRabbitMQConfig.java` | `payment.notifications` (durable) | `payment.*`, `wallet.*` | `PaymentNotificationConsumer.handlePaymentEvent` |
| `flowmerce.payment` | same | `payment.webhooks` (durable) | `payment.webhook.#` | **none** — unconsumed, unpublished scaffolding |

**Producers:**
- `OrderManagement/event/OrderEventPublisher.java` → always publishes routing key `order.status.updated` (even for cancellations — `newStatus="CANCELLED"` travels on this same key, caught by the `order.#` wildcard). Called from `OrderService.updateStatus` and `OrderService.cancelOrder`.
- `PaymentManagement/event/PaymentEventPublisher.java` → `payment.initiated` / `payment.succeeded` / `payment.failed` / `payment.refunded`. Called from `PaymentServiceImpl.initiatePayment` / `confirmPayment` / `refundPayment`.

**Consumers** (both in `NotificationManagement/consumer/`):
- `OrderNotificationConsumer` — on `PROCESSING`*/`CONFIRMED`/`SHIPPED`/`DELIVERED`/`CANCELLED`: persists a `Notification`, pushes SSE, and (except `PROCESSING`) sends a status-specific transactional email. `CANCELLED` also notifies the merchant. Reaches directly into `OrderManagement`'s repositories to build email content (cross-module coupling). *`PROCESSING` is dead code — `OrderStatus` has no such value.*
- `PaymentNotificationConsumer` — on `COMPLETED`/`FAILED`/`REFUNDED`/`PARTIALLY_REFUNDED`/`PENDING`/`PROCESSING`: persists a `Notification`, pushes SSE to customer and/or merchant, and emails on `COMPLETED`.

Neither `WalletService` nor anything else ever publishes `wallet.debited`/`wallet.credited` despite the routing keys existing — wallet balance changes only surface indirectly via the payment events.

### Server-Sent Events (SSE)

Single service, `UserManagement/service/SseService.java`, backs two endpoints on `UserManagement/controller/SseController.java`.

| Endpoint | Auth | Channel | Mechanics |
|---|---|---|---|
| `GET /stream/private` | authenticated | Per-user private stream | `Map<email, SseEmitter>` (`ConcurrentHashMap`); a second connection from the same user silently replaces (orphans) the first emitter |
| `GET /stream/stock` | authenticated (any role — see discrepancy below) | Broadcast stream | `List<SseEmitter>` (`CopyOnWriteArrayList`), unbounded, fans out to every connected client regardless of role/store |

- Emitters are created with `new SseEmitter(Long.MAX_VALUE)` — no timeout, live until the client disconnects.
- Event types: `CONNECTED` (welcome, private only), `STOCK_ALERT` (low-stock/out-of-stock, sent to the owning merchant only via the private channel), `ORDER_UPDATE`, `ACCOUNT_ACTIVITY`, plus a generic `broadcast(eventType, data)` used for stock alerts on the public channel and any future system/flash-sale announcements.
- Dead emitters (failed `IOException` on send) are swept from tracking on `onCompletion`/`onTimeout`/`onError`, and also opportunistically during broadcast fan-out.
- Triggering paths: `OrderService.createOrder` sends `ORDER_UPDATE` directly at creation; every subsequent order/payment status change arrives indirectly via the two RabbitMQ consumers above; `InventoryManagement`'s `StockEventListener` (an in-process Spring `@EventListener`, **not** RabbitMQ) sends `STOCK_ALERT` on low/out-of-stock.

### Security filter chain

`UserManagement/config/SecurityConfig.java` — stateless sessions, CSRF disabled, custom JSON 401 entry point, CORS allows the frontend origin + `https://*.flowmerce.tech` + `localhost:*` with credentials.

Filter order: `RateLimitFilter` → `JwtAuthFilter` → `UsernamePasswordAuthenticationFilter`.

- **`RateLimitFilter`** — per-IP (`X-Forwarded-For` → `X-Real-IP` → remote addr) fixed-window counter in Redis; `/auth/**` login/register/forgot-password = 30/60s, `/uploads/**` = 20/60s, everything else = 300/60s. CORS preflight (`OPTIONS`) bypasses entirely. Trips → `429` with a JSON body. Fails open on Redis error.
- **`JwtAuthFilter`** — validates JWT signature/expiry in-memory, then resolves role through the two-tier Redis session cache described above, falling back to 1–2 DB queries on cache miss. Reads the token from `Authorization: Bearer` or from scope-specific cookies (`merchant_access_token` / `customer_access_token`), disambiguated by an `X-Auth-Role` header.
- **Cookies** (`CookieUtil`) — namespaced per scope so a merchant and customer session can coexist in one browser: `{scope}_access_token` (path `/api/v1`) and `{scope}_refresh_token` (path `/api/v1/auth`, tighter scope since it's only needed by the refresh endpoint). `secure` flag derived from whether the frontend URL is `https://`; `SameSite=Lax`.
- **`AdminSeeder`** — `CommandLineRunner` idempotently seeds one ADMIN user from `app.admin.email`/`app.admin.password`; refuses to boot in the `prod` profile if the password is still the hardcoded default.

---

## Module Reference

### 1. UserManagement

Handles registration/login/activation/password-reset/profile for three roles (Admin, Merchant, Customer/Buyer) plus Google/Facebook social login, JWT issuance, and the SSE gateway.

**AuthController — `/auth/merchant`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/merchant/register` | Public | Register merchant account, sends 24h activation email |
| GET | `/auth/merchant/activate?token=` | Public | Activate account |
| POST | `/auth/merchant/login` | Public | Login → JWT + refresh token, sets scoped cookies |
| POST | `/auth/merchant/refresh` | Public | Rotate refresh token (single-use), issue new access token |
| POST | `/auth/merchant/logout` | Public (needs token) | Revoke session, evict cache, clear cookies |
| GET | `/auth/merchant/me` | Authenticated | Current profile |
| POST | `/auth/merchant/forgot-password` | Public | Send reset email (generic response — no user enumeration) |
| POST | `/auth/merchant/reset-password` | Public | Complete reset (1h token), revokes all sessions |

**CustomerAuthController — `/auth/customer`** (identical shape to the above, plus):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| DELETE | `/auth/customer/me` | Authenticated | Delete own customer account |

**MerchantController — `/merchants`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/merchants/me` | Authenticated | Create merchant profile, promotes role, evicts session cache |
| GET | `/merchants/me` | Authenticated | Own merchant profile |
| DELETE | `/merchants/me` | Authenticated | Delete merchant profile + user, revoke sessions |

**AdminController — `/admin`** (class-level `hasRole('ADMIN')`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users` | List all users |
| DELETE | `/admin/users/{userId}` | Cascading delete (sessions, notifications, profile, customer/merchant, stores) |
| GET | `/admin/merchants` | List all merchants |
| PUT | `/admin/merchants/{merchantId}/verify` | Mark merchant verified |
| DELETE | `/admin/merchants/{merchantId}` | Delete merchant + user |
| PUT | `/admin/users/{userId}/activate` | Force-activate bypassing email flow |
| GET | `/admin/stores` | List all stores |

**UserController — `/users`** (all authenticated)

| Method | Path | Purpose |
|---|---|---|
| GET | `/users/me` | Own profile |
| PUT | `/users/me` | Update profile |
| PUT | `/users/me/change-password` | Change password, revokes all sessions |
| DELETE | `/users/me` | Delete own account (thinner cleanup than admin path — no Customer/Merchant/Store cascade) |

**SocialAuthController — `/auth/social`** (public)

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/social/{provider}/redirect?state=` | Redirect to Google/Facebook consent |
| GET | `/auth/social/{provider}/callback?code=&state=` | Exchange code, find-or-create user (**always role MERCHANT** — social login never creates customers), set cookies, redirect to frontend |

**SseController — `/stream`** — see [SSE section](#server-sent-events-sse).

**Verification tokens:** `ACTIVATION` (24h) / `PASSWORD_RESET` (1h), single-use, stored in `verification_tokens`.

### 2. StoreMangement

*(package spelling is "Mangement" in the actual code)*

**StoreController — `/stores`** (all `hasRole('MERCHANT')` unless noted)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/stores` | MERCHANT | Create store (rejects duplicate `storeUrl`), seeds default settings, status `DRAFT` |
| GET | `/stores/me` | MERCHANT | List own stores |
| GET | `/stores/{storeId}` | MERCHANT (owner) | Get one store |
| GET | `/stores/slug/{slug}` | Public | Resolve store by slug for storefront rendering (403 if `PAUSED`) |
| PUT | `/stores/{storeId}` | MERCHANT (owner) | Update name/description/logo/URL |
| PUT | `/stores/{storeId}/brand` | MERCHANT (owner) | Update brand name/logo |
| PUT | `/stores/{storeId}/payment-methods` | MERCHANT (owner) | Set accepted payment methods |
| PUT | `/stores/{storeId}/onboarding-step` | MERCHANT (owner) | Advance onboarding (0–5) |
| POST | `/stores/{storeId}/publish` | MERCHANT (owner) | Status → `PUBLISHED` |
| POST | `/stores/{storeId}/unpublish` | MERCHANT (owner) | Status → `PAUSED` |
| DELETE | `/stores/{storeId}` | MERCHANT (owner) | Hard delete |
| GET | `/stores/{storeId}/settings` | MERCHANT (owner) | Currency/timezone/language/tax/shipping settings |
| PUT | `/stores/{storeId}/settings` | MERCHANT (owner) | Update settings |

No Redis/RabbitMQ/SSE in this package at all — ownership checks are plain uncached DB lookups (unlike the cached equivalent in StorefrontCustomization).

### 3. StorefrontCustomization

**PublicStorefrontController — `/public/storefront`** (all public)

| Method | Path | Purpose |
|---|---|---|
| GET | `/public/storefront/{storeId}` | Published storefront (theme+pages+components), cache-aside via `flowmerce:sf:{storeId}` |
| GET | `/public/storefront/{storeId}/categories` | Categories used by visible products |
| GET | `/public/storefront/{storeId}/products?categoryId=` | Visible products |
| GET | `/public/storefront/{storeId}/products/{productId}` | Single product |

**StorefrontCustomizationController — `/stores/{storeId}/storefront`** (all `hasRole('MERCHANT')` + ownership-verified via the `flowmerce:own:` cache)

| Method | Path | Purpose |
|---|---|---|
| POST | `/storefront/init` | Idempotent create — seeds theme + default "home" page |
| GET | `/storefront` | Own storefront (draft, always DB read) |
| POST | `/storefront/publish` | Publish, bump version, repopulate public cache |
| POST | `/storefront/unpublish` | Unpublish, evict public cache |
| GET | `/storefront/design` | Get theme (cache-aside via `flowmerce:sf:design:`) |
| PUT | `/storefront/design` | Save partial design — fast path (0 DB queries) if ownership+design both cached, else full DB path; write-behind async persist |
| GET | `/storefront/colors` | Get theme (rides on `getStorefront`, not separately cached) |
| PUT | `/storefront/colors` | Update theme fields — same fast/slow-path pattern |
| GET/POST/PUT/DELETE | `/pages`, `/pages/{pageId}` | Page CRUD (home page can't be deleted); every mutation evicts `flowmerce:sf:{storeId}` |
| GET/POST/PUT/DELETE | `/pages/{pageId}/components`, `.../components/{id}`, `.../components/reorder` | Component CRUD + bulk reorder; evicts cache |
| GET/POST/PUT/DELETE | `/components/{componentId}/decorators`, `.../decorators/{id}` | Decorator CRUD; evicts cache |
| GET/POST/DELETE | `/media`, `/media/{mediaId}` | Media list/upload/delete — **does not** evict the public cache (gap) |

Write-behind: `StorefrontWriteBehindService` (`@Async @Transactional`, separate bean so Spring AOP can proxy it) persists theme changes to Postgres after the Redis write, so the HTTP response returns before the DB commit completes.

### 4. ProductManagement

**CategoryController — `/categories`** (global categories)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/categories` | Public | List all |
| GET | `/categories/{id}` | Public | Get one |
| POST | `/categories` | ADMIN | Create |
| PUT | `/categories/{id}` | ADMIN | Update |
| DELETE | `/categories/{id}` | ADMIN | Delete |

**StoreCategoryController — `/stores/{storeId}/categories`** (all `hasRole('MERCHANT')`, **no ownership check** — any merchant can act on any storeId)

| Method | Path | Purpose |
|---|---|---|
| GET | `/stores/{storeId}/categories` | Store-owned + global categories, de-duped by name |
| POST | `/stores/{storeId}/categories` | Create store-owned category |
| DELETE | `/stores/{storeId}/categories/{categoryId}` | Delete (rejects deleting a global category) |

**ProductController — `/stores/{storeId}/products`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/stores/{storeId}/products` | MERCHANT (owner) | Create product + Inventory row, warms `product:{id}:stock` cache |
| GET | `/stores/{storeId}/products` | MERCHANT (owner) | List all (incl. inactive) |
| GET | `/stores/{storeId}/products/public` | Public | List active only |
| GET | `/stores/{storeId}/products/{productId}` | Public | Get one |
| PUT | `/stores/{storeId}/products/{productId}` | MERCHANT (owner) | Partial update |
| PATCH | `/stores/{storeId}/products/{productId}/status` | MERCHANT (owner) | Toggle active/inactive |
| DELETE | `/stores/{storeId}/products/{productId}` | MERCHANT (owner) | Delete (Inventory cascades) |
| GET | `/stores/{storeId}/products/search?keyword=` | Public | Keyword search, scoped to store |
| POST | `/stores/{storeId}/products/{productId}/media` | MERCHANT (owner) | Add product image |
| DELETE | `.../media/{mediaId}` | MERCHANT (owner) | Delete product image |

Default `lowStockThreshold` = 10 at creation if not supplied. Every product read calls `InventoryService.getAvailableQuantity` to populate `availableQuantity`, swallowing failures (shows 0 on error).

**ReviewController — `/products/{productId}/reviews`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/products/{productId}/reviews` | Public | List reviews |
| POST | `/products/{productId}/reviews` | BUYER | Submit (one per customer per product) |
| PUT | `/products/{productId}/reviews` | BUYER | Edit own review |
| DELETE | `/products/{productId}/reviews/{reviewId}` | BUYER or ADMIN (ADMIN branch not actually functional in service — see discrepancies) | Delete |

`Product.rating` recalculated (rounded to 1 decimal) after every submit/edit/delete.

### 5. InventoryManagement

**InventoryController** (absolute paths, no class-level prefix)

Spec-compliant:
| Method | Path | Auth | Purpose |
|---|---|---|---|
| PATCH | `/products/{productId}/stock` | MERCHANT | Adjust stock by signed delta (NORMAL strategy) |
| GET | `/stores/{storeId}/inventory` | MERCHANT or ADMIN | List store inventory (**no ownership check**) |
| POST | `/stores/{storeId}/inventory/{productId}/restock` | MERCHANT | Record restock |
| GET | `/stores/{storeId}/inventory/{productId}/history` | MERCHANT | Transaction history |

Legacy (kept for backward compat):
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/inventory/adjust` | MERCHANT | Adjust with caller-specified strategy (NORMAL/RESERVED/FLASH) |
| POST | `/inventory/reserve` | BUYER | Reserve stock (used by checkout) |
| POST | `/inventory/release` | BUYER or ADMIN | Release reservation |
| GET | `/inventory/{productId}` | Authenticated | Full detail (available/reserved/total/status/threshold) |
| GET | `/inventory/{productId}/check?qty=` | Authenticated | Boolean availability check |

**Mechanics:**
- Strategy pattern (`InventoryStrategyFactory` + `NORMAL`/`RESERVED`/`FLASH` `@Component` beans) does the actual quantity math; `FLASH` caps at 2 units/customer.
- `Inventory.version` (`@Version`) optimistic locking on every mutation — conflicts surface as a "please retry" `BadRequestException`.
- `reserveStock` does an atomic Redis `DECRBY` on `product:{id}:stock` (rolled back with `INCRBY` if it would go negative) — this is the overselling-prevention mechanism.
- `confirmOrder` (called from checkout confirmation) does the final permanent deduction against both `quantity` and `reservedQuantity`.
- Every mutation writes an `InventoryTransaction` audit row (`RESTOCK`/`SALE`/`RETURN`/`ADJUSTMENT`/`DAMAGE`) and publishes an in-process `StockChangedEvent` (Spring `ApplicationEventPublisher`, **not** RabbitMQ) consumed by `StockEventListener` (`@Async @EventListener`) which pushes `STOCK_ALERT` over SSE when stock crosses the per-product `lowStockThreshold` or hits zero.
- The global `inventory.low-stock-threshold` property is dead configuration — only the per-product `Inventory.lowStockThreshold` column is actually read.

### 6. CartManagement + Wishlist

**CartController — `/cart`** (all `hasRole('BUYER')`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/cart/{storeId}` | Get/create cart for a store |
| POST | `/cart/items` | Add item (store derived from product) |
| PUT | `/cart/items/{cartItemId}` | Update quantity |
| DELETE | `/cart/items/{cartItemId}` | Remove item |
| DELETE | `/cart/{storeId}` | Clear cart |
| POST | `/cart/checkout` | Run checkout pricing/stock-reservation without creating an order |

**WishlistController — `/wishlist`** (all `hasRole('BUYER')`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/wishlist` | List |
| POST | `/wishlist` | Add (409 if duplicate) |
| DELETE | `/wishlist/{productId}` | Remove |
| POST | `/wishlist/{productId}/move-to-cart` | Add qty=1 to cart, remove from wishlist |

Cart is one-per-(customer, store); new carts expire in 7 days (`CartCleanupScheduler` — daily 2am cron — releases reserved stock and deletes expired carts). Checkout computes `subtotal + tax(app.tax.rate, default 0) + shipping(app.shipping.flat-rate, default 25 EGP)`. No Redis/RabbitMQ/SSE in this package directly.

### 7. OrderManagement

**OrderController — `/orders`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/orders/place` | BUYER | Full checkout→order→payment-initiation flow |
| GET | `/orders/me` | BUYER | Own orders |
| GET | `/orders/{orderId}` | BUYER (owner) | Order detail |
| POST | `/orders/{orderId}/reorder` | BUYER | Re-add all past items to cart |
| POST | `/orders/{orderId}/cancel` | BUYER | Cancel (only while `PENDING`; auto-refunds if a `COMPLETED` payment exists) |
| GET | `/orders/store/{storeId}` | MERCHANT | Store's orders |
| GET | `/orders/store/{storeId}/customers` | MERCHANT | Distinct-customer summary |
| GET | `/orders/store/{storeId}/{orderId}` | MERCHANT (owner) | Full order detail |
| PUT | `/orders/{orderId}/status` | MERCHANT | Status transition; `→SHIPPED` with a carrier creates a real DHL/Aramex/Bosta shipment |
| GET | `/orders/admin/all?page&size&sort` | ADMIN | Paginated, all stores |

**Place-order flow:** idempotency key → Redis fast-path check (`order:idempotency:{key}`) → `CheckoutService.processCheckout` (reserve stock, price) → `OrderService.createOrder` (persist Order+Items+Invoice `INV-{yyyy}-{7digit}`, permanently confirm stock, clear cart, send `ORDER_UPDATE` SSE) → cache idempotency key (24h) → `PaymentServiceImpl.initiatePayment` → `201` with bundled order+payment. A lost idempotency race (DB unique-constraint violation) releases the losing attempt's reserved stock and returns the winner's order.

**Status machine:** `PENDING → CONFIRMED|CANCELLED → SHIPPED → DELIVERED`. Stock is **not** auto-restored on cancel (manual merchant restock).

Publishes `order.status.updated` on every status change/cancel via `OrderEventPublisher` (see RabbitMQ section). Redis: `order:idempotency:{key}` (24h TTL).

### 8. PaymentManagement + Wallet

**PaymentController — `/payments`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/payments/initiate` | BUYER | Initiate payment for an order |
| GET | `/payments/{paymentId}` | Authenticated | Get by id |
| GET | `/payments/order/{orderId}` | Authenticated | Get by order |
| POST | `/payments/{paymentId}/confirm` | MERCHANT | Confirm COD/bank-transfer received |
| GET | `/payments/store/{storeId}` | MERCHANT | List store payments |
| POST | `/payments/{paymentId}/refund` | MERCHANT | Full/partial refund |

**Gateway adapters** (`PaymentGatewayAdapter` beans, selected by `paymentMethod`): `WalletSimulationAdapter` (instant, synchronous debit/credit via `WalletService`), `PaymobAdapter` (**only real per-store-credentialed gateway** — 3-step Accept API flow, pulls the store's own Paymob keys via `IntegrationCredentialResolver`), `StripeAdapter`/`FawryAdapter` (stubs, fail until real keys configured), `BankTransferAdapter`/`CashOnDeliveryAdapter` (start `PENDING`, flipped to `COMPLETED` via merchant confirm).

Credential storage/testing is entirely separate — see [IntegrationManagement](#11-integrationmanagement); `PaymentController` never touches credentials directly.

**WalletController — `/wallets`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/wallets/me` | BUYER | Own wallet (auto-created, seeded 100,000 EGP simulation balance) |
| POST | `/wallets/me/topup` | BUYER | Simulated top-up (min 1.00 EGP) |
| GET | `/wallets/me/transactions` | BUYER | Own history |
| GET | `/wallets/store/{storeId}` | MERCHANT (owner) | Store wallet (starts at 0.00) |
| GET | `/wallets/store/{storeId}/transactions` | MERCHANT (owner) | Store history |

Every balance change writes an immutable `WalletTransaction` with a `balanceAfter` snapshot. Redis: `payment:idempotency:{key}` (24h TTL, JSON `{paymentId, status}`). Publishes `payment.initiated`/`succeeded`/`failed`/`refunded` via `PaymentEventPublisher`.

### 9. NotificationManagement

**NotificationController — `/notifications`** (all authenticated)

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | Paginated list (20/page, newest first) |
| GET | `/notifications/unread-count` | Unread count |
| PUT | `/notifications/{notificationId}/read` | Mark one read (403 if not owner) |
| PUT | `/notifications/read-all` | Mark all read |

No endpoint creates notifications directly — they're only ever created by `OrderNotificationConsumer`/`PaymentNotificationConsumer` off the RabbitMQ queues described above.

### 10. FileStorage

**FileUploadController — `/api/files`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/files/products/{storeId}/{productId}` | MERCHANT | Product image |
| POST | `/api/files/stores/{storeId}/logo` | MERCHANT | Store logo |
| POST | `/api/files/stores/{storeId}/banner` | MERCHANT | Store banner |
| POST | `/api/files/themes/{storeId}` | MERCHANT | Storefront theme asset |
| POST | `/api/files/profiles/{userId}` | Authenticated | Profile picture |
| POST | `/api/files/invoices/{orderId}` | MERCHANT or ADMIN | Invoice PDF |
| POST | `/api/files/attachments` | MERCHANT or ADMIN | Notification attachment |
| POST | `/api/files/storefront/{storeId}` | MERCHANT | Generic storefront image |
| GET | `/api/files?entityType=&entityId=` | Any authenticated user (no `@PreAuthorize` — inconsistent with siblings) | List files for an entity |
| DELETE | `/api/files?url=` | MERCHANT or ADMIN | Soft-delete DB row + remove MinIO object |

All uploads flow through `FileStorageService.uploadFile`: ensures the bucket exists and (re)applies a **public-read** bucket policy on every call, stores under `{StorageFolder}/{subPath}/{uuid+ext}`, validates `image/*` or `application/pdf` up to 10MB. `getPresignedUrl` exists on the service but isn't wired to any endpoint here. `StorageFolder` enum: `PRODUCT_IMAGES, STORE_LOGOS, STORE_BANNERS, THEME_ASSETS, USER_PROFILES, INVOICES, STOREFRONT, ATTACHMENTS, AI_ASSETS (unused), UPLOADS`.

### 11. IntegrationManagement

**StoreIntegrationController — `/stores/{storeId}/integrations`** (all `hasRole('MERCHANT')` + ownership-verified)

| Method | Path | Purpose |
|---|---|---|
| GET | `/stores/{storeId}/integrations` | Status of all 4 providers (configured/enabled/masked preview/last verification) |
| PUT | `/stores/{storeId}/integrations/{provider}` | Save/overwrite encrypted credentials, resets to `UNVERIFIED` |
| PUT | `/stores/{storeId}/integrations/{provider}/enabled` | Toggle on/off |
| POST | `/stores/{storeId}/integrations/{provider}/test` | Live, side-effect-free credential probe |

Providers: `PAYMOB`, `DHL`, `ARAMEX`, `BOSTA`. Credentials stored AES-256-GCM-encrypted (`Base64(IV[12] || ciphertext+tag)`, key from `INTEGRATION_ENCRYPTION_KEY`, no default — app refuses to start without it). `IntegrationCredentialResolver` is the read-side other modules (`PaymobAdapter`, `ShippingService`) use to fetch a store's decrypted credentials at call time — cleanly separates credential storage from credential consumption.

### 12. common (Upload)

**UploadController — `/uploads`**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/uploads` | Public (`permitAll`) | Generic image upload **to MinIO** (`StorageFolder.UPLOADS`), blocks SVG/HTML/XML/JS explicitly, 10MB limit |
| GET | `/uploads/{filename:.+}` | Public | Serves a file **from local disk** (`app.upload.dir`), path-traversal guarded, forces `attachment` disposition except for a raster-image whitelist, sets `X-Content-Type-Options: nosniff` |

**Note the storage-backend mismatch**: POST writes to MinIO, GET reads from local disk — these two endpoints don't round-trip the same files. In practice, callers should use the MinIO URL returned by the POST directly rather than hitting the GET here.

---

## Known Discrepancies / Dead Code

Found while reading the actual source — worth cleaning up or at least being aware of:

- **`DOCUMENTATION.md` references a nonexistent `UnifiedAuthController`** claimed to serve `/auth/activate` and `/auth/reset-password`. No such class exists. Those two paths are still `permitAll()`-listed in `SecurityConfig` but have no backing `@RequestMapping` — a request to them 404s. The real handlers are the scoped `AuthController`/`CustomerAuthController` (`/auth/merchant/*`, `/auth/customer/*`). Activation/reset emails link to **frontend** routes (`/activate?token=`, `/reset-password?token=`), which presumably call the correctly-scoped backend endpoint themselves.
- **`payment.webhooks` queue and `wallet.debited`/`wallet.credited` routing keys** are fully declared (exchange/queue/binding) but have no producer and no consumer anywhere — dead scaffolding, likely for an unimplemented inbound-webhook feature.
- **`OrderNotificationConsumer`'s `PROCESSING` branch** is unreachable — `Order.OrderStatus` has no `PROCESSING` value and no transition produces one.
- **Ownership cache (`flowmerce:own:`) has no explicit eviction** — a store-ownership change only takes effect after the fixed 60s TTL lapses.
- **Storefront media add/delete don't evict `flowmerce:sf:{storeId}`** — unlike every other mutating storefront endpoint.
- **`ReviewController`'s ADMIN delete branch is non-functional** — `ReviewService.deleteReview` always resolves the caller as a `Customer` and will throw for an admin caller despite `@PreAuthorize` allowing ADMIN.
- **`StoreCategoryController`/`CategoryService` has no ownership check** — any authenticated MERCHANT can create/delete categories under any `storeId`, unlike `ProductService`'s ownership-verified equivalent.
- **`InventoryController`'s `GET /stores/{storeId}/inventory`** likewise has no ownership check — any merchant can view any store's inventory by ID.
- **The global `inventory.low-stock-threshold` property is dead** — only the per-product `Inventory.lowStockThreshold` column is read.
- **`UserService.deleteMyAccount` (self-delete) is thinner than the admin delete path** — it doesn't clean up `Customer`/`Merchant`/`Store`/`UserProfile`/notification rows, only sessions + the `User` row.
- **`GET /api/files` has no `@PreAuthorize`**, unlike every sibling endpoint in `FileUploadController` — reachable by any authenticated user regardless of role.
- **`MfaVerifyRequest` DTO and `User.isMfaEnabled`** exist but MFA has no controller, service method, or endpoint anywhere — scaffolded, unimplemented.
- **`/stream/stock`'s SEC-13 comment claims merchant-only scoping**, but the code calls the same unauthenticated-audience `subscribeBroadcast()` used for generic system alerts — any authenticated user of any role receives every stock event, not just the owning merchant.
- **`/uploads` POST/GET storage-backend mismatch** — see [common (Upload)](#12-common-upload) above.
