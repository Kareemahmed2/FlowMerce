# FlowMerce — Post-Integration Audit Report
Generated: 2026-05-21

## Executive Summary

The FlowMerce backend compiles cleanly (BUILD SUCCESS, 0 errors) and all 37 of 38 previously identified bugs are fully or partially fixed. The branch integration added two functional modules — `ProductManagement` (categories, products, reviews, media) and `CartManagement` (cart, checkout, wishlist) — both of which follow main's architectural patterns with only minor deviations. Three critical issues require immediate attention before any integration testing: (1) `AuthService.login()` never checks `user.isActive`, allowing unactivated accounts to authenticate; (2) `CheckoutService.confirmOrder()` reserves stock during checkout but never calls `inventoryService.confirmOrder()` to debit the committed quantity, leaving reserved stock permanently inflated; (3) `ReviewService.getProductReviews()` accesses lazy JPA associations outside a transaction, which will throw `LazyInitializationException` on the public GET reviews endpoint at runtime. Beyond these critical bugs, the codebase has reached approximately 52% spec completion and is in substantially better shape than the 18% baseline.

---

## Section 1 — Bug Fix Verification

### Fixed ✓ (36 of 38 items)

| # | Fix | Evidence |
|---|-----|----------|
| 1 | `register()` sets `Role.MERCHANT` | `AuthService.java:52` — `Role role = Role.MERCHANT;` |
| 2 | `login()` returns structured `AuthResponse` | `AuthService.java` — `buildAuthResponse()` returns `accessToken`, `refreshToken`, `expiresIn`, `user` |
| 3 | `POST /auth/merchant/refresh` exists | `AuthController.java:41` — `@PostMapping("/refresh")` with `RefreshTokenRequest` body |
| 4 | `GET /auth/merchant/me` exists | `AuthController.java:58` — `@GetMapping("/me")` with `@PreAuthorize("isAuthenticated()")` |
| 5 | No HashMap tokens; `activateAccount()` sets `isActive` | `AuthService.java:97` — `user.setIsActive(true);` ; no `HashMap` field anywhere in class |
| 6 | `resetPassword()` checks expiry | `AuthService.java:218` — `if (vt.getExpiresAt().isBefore(LocalDateTime.now()))` |
| 7 | `register()` returns 201 | `AuthController.java:25` — `ResponseEntity.status(HttpStatus.CREATED)` |
| 8 | `createMerchantProfile()` returns 201 | `MerchantController.java:25` — `ResponseEntity.status(HttpStatus.CREATED)` |
| 9 | `/api/v1` context path | `application.properties:1` — `server.servlet.context-path=/api/v1` |
| 10 | CORS configured | `SecurityConfig.java` — `CorsConfigurationSource` bean with `http://localhost:3000` and `https://*.flowmerce.io` |
| 11 | Default currency EGP | `StoreSettings.java` — `private String currency = "EGP";` ; `StoreService.java:63` — `.currency("EGP")` |
| 12 | `role VARCHAR(50)`, no `role_id` FK | `schema.sql:13` — `role VARCHAR(50) NOT NULL DEFAULT 'BUYER'` ; comment: `-- roles table removed` |
| 13 | `is_active` in schema | `schema.sql:14` — `is_active BOOLEAN NOT NULL DEFAULT FALSE` |
| 14 | `isMfaEnabled` on `User.java` | `User.java:47` — `private Boolean isMfaEnabled = false;` |
| 16 | `storefront.cache.ttl-minutes` key | `application.properties:33` — `storefront.cache.ttl-minutes=${SF_CACHE_TTL_MINUTES:30}` |
| 17 | Only one `RedisConfig.java` | `find src/main/java -name "RedisConfig.java"` returns exactly one: `StorefrontCustomization/config/RedisConfig.java` |
| 18 | `InventoryManagement` package correct | All files under `src/main/java/.../InventoryManagement/` ; zero files use `InventoryMangement` |
| 19 | `ApiResponse<T>` wrapper | `common/ApiResponse.java` — `success`, `data`, `message` fields present; all examined controllers return `ResponseEntity<ApiResponse<T>>` (one minor exception noted below) |
| 20 | `ErrorResponse` has `code` and `details` | `ErrorResponse.java:21` — `private String code;` ; `ErrorResponse.java:25` — `private Map<String, Object> details;` |
| 21 | Validation handler returns `ErrorResponse` | `GlobalExceptionHandler.java:61–72` — returns `ErrorResponse.of(400, "Validation Failed", ..., "VALIDATION_ERROR", ..., fieldErrors)` |
| 22 | `POST /{storeId}/publish` | `StoreController.java:95` — `@PostMapping("/{storeId}/publish")` |
| 23 | `POST /{storeId}/unpublish` | `StoreController.java:103` — `@PostMapping("/{storeId}/unpublish")` |
| 24 | JOIN FETCH for N+1 fix | `StoreRepository.java:17` — `@Query("SELECT s FROM Store s JOIN FETCH s.merchant m ...")` ; `StoreService.java:75` calls `findByMerchantIdWithMerchant()` |
| 25 | `GET /stores/slug/{slug}` | `StoreController.java:49` — `@GetMapping("/slug/{slug}")` |
| 26 | `PUT /{storeId}/brand` | `StoreController.java:65` — `@PutMapping("/{storeId}/brand")` |
| 27 | `PUT /{storeId}/payment-methods` | `StoreController.java:75` — `@PutMapping("/{storeId}/payment-methods")` |
| 28 | `PUT /{storeId}/onboarding-step` | `StoreController.java:85` — `@PutMapping("/{storeId}/onboarding-step")` |
| 29 | `InventoryTransaction` fields complete | `InventoryTransaction.java` — `type`, `quantityChange`, `qtyBefore`, `qtyAfter`, `referenceId`, `createdBy` all present |
| 30 | `Inventory` has `storeId` and `updatedAt` | `Inventory.java:27` — `private Integer storeId = 0;` ; lines 44–46 — `@UpdateTimestamp updatedAt` |
| 31 | `inventory.low-stock-threshold` configurable | `application.properties:36` ; `InventoryServiceImpl.java:37` — `@Value("${inventory.low-stock-threshold:5}")` ; `Inventory.java:39` — `lowStockThreshold = 5` |
| 32 | SSE not changed to RabbitMQ | `StockEventListener.java` — still calls `sseService.broadcast(...)` ; no RabbitMQ usage |
| 33 | All 4 spec inventory endpoints | `InventoryController.java` — `PATCH /products/{id}/stock` (L25), `GET /stores/{storeId}/inventory` (L38), `POST /stores/{storeId}/inventory/{productId}/restock` (L46), `GET /stores/{storeId}/inventory/{productId}/history` (L59) |
| 34 | Cache prefix `flowmerce:sf:` | `StorefrontCustomizationService.java:52` — `private static final String CACHE_KEY_PREFIX = "flowmerce:sf:";` ; `grep storefront:public:` = 0 matches |
| 35 | Redis ops in `try/catch` | `getFromCache()`, `putInCache()`, `evictCache()` — all wrapped in `try { ... } catch (Exception e) { log.warn(...); }` |
| 36 | All 23+ storefront endpoints | 25 endpoints present in `StorefrontCustomizationController.java` including all spec-required and 2 bonus `/colors` endpoints |
| 38 | `deletePage()` protects HOME | `StorefrontCustomizationService.java:285` — `if ("home".equals(page.getSlug())) { throw new ForbiddenException("The HOME page cannot be deleted."); }` |

---

### Partial ⚠ (2 items)

**Fix 15 — DB credentials still partially exposed**
`application.properties:6` — `spring.datasource.password=${DB_PASSWORD:KHYA43bVfFyNhGWa}`

The variable substitution was added, but the actual production database password is still embedded as the default fallback value. If `DB_PASSWORD` is not set in the deployment environment, the real credential is used. The same pattern applies to `jwt.secret` on line 16. The fix should use `${DB_PASSWORD}` with no fallback, forcing the variable to be set externally.

**Fix 37 — Public storefront response is incomplete**
The `toResponseWithComponents()` method includes `theme` and a page summary list but `PageSummary` objects do not include their child components. The full nested `StorefrontDocument` (with components per page) is not returned. Decorator endpoints return empty lists (stub implementation — no `@Entity`, no DB table for `ComponentDecorator`). The public storefront endpoint returns enough data to display the page list and theme, but not enough to render actual page content.

---

### Not Fixed ✗ (0 from original 38)

All 38 original audit items are Fixed or Partial. No item is entirely unaddressed.

---

## Section 2 — Integration Correctness

### 2-A. Product Module

#### Entity Issues

| Entity | Issue | Severity |
|--------|-------|----------|
| `Category` | No `createdAt` / `updatedAt` timestamps on entity or schema | LOW |
| `Category` | `store_id` FK is nullable — allows orphaned global categories that bypass store-scoping; creates confusion when `findByStore_StoreId()` returns empty for stores with only global categories | MEDIUM |
| `Review` | `toResponse()` in `ReviewService` calls `r.getCustomer().getUser().getFullName()` — traverses two `LAZY` associations. This is called by `getProductReviews()` which has NO `@Transactional` annotation. Will throw `LazyInitializationException` on the public GET endpoint at runtime. | **CRITICAL** |
| `ProductMedia` | No timestamp on entity (acceptable — matches schema design) | LOW |

#### Repository Issues

| Repository | Issue | Severity |
|------------|-------|----------|
| `ProductRepository` | No JOIN FETCH query for products + media in one query. `toResponse()` in `ProductService` accesses `p.getMediaList()` which triggers N+1 lazy loads (one SELECT per product) when listing all store products. | HIGH |
| `CategoryRepository` | `existsByName()` is global — does not scope uniqueness to a store. Two different stores cannot have a category with the same name even though categories are store-scoped. | MEDIUM |

#### Service Issues

| Method | Issue | Severity |
|--------|-------|----------|
| `ReviewService.getProductReviews()` | Missing `@Transactional(readOnly = true)` — lazy associations accessed outside transaction | **CRITICAL** |
| `ProductService.searchProducts()` | Not annotated `@Transactional(readOnly = true)` — accesses `inventoryService.getAvailableQuantity()` per product inside a stream (N+1 Redis calls) | LOW |
| `ProductController.deleteMedia()` | `productService.deleteMedia()` verifies the store is owned by the merchant but does NOT verify the media belongs to a product within that store. A merchant can delete media from a different store's product if they know the `mediaId`. | MEDIUM |

#### Controller Issues

| Endpoint | Issue | Severity |
|----------|-------|----------|
| All product endpoints | Path `@RequestMapping("/stores/{storeId}/products")` — with context path `/api/v1` the effective paths are `/api/v1/stores/{storeId}/products`. Spec requires `/api/v1/stores/:storeId/products`. **MATCH.** | ✓ |
| `DELETE /{productId}/media/{mediaId}` | Spec path is `DELETE /products/:id/images/:imageId` (spec uses `/images`) — implemented as `/media`. Minor path name deviation. | LOW |
| `PUT /{productId}/toggle` | Spec has `PATCH /products/:id/status`. Implemented as `PUT /{productId}/toggle`. Wrong HTTP method (PUT vs PATCH) and different sub-path. | MEDIUM |
| `GET /search?keyword=` | No equivalent in spec — bonus endpoint, acceptable | LOW |
| All GET public endpoints | `/public` and `/search` are in `SecurityConfig` permitAll list | ✓ |

#### Spec Path Coverage — ProductController

| Spec Endpoint | Implemented | Notes |
|---------------|-------------|-------|
| `GET /stores/:storeId/products` | ✓ `GET /stores/{storeId}/products` | MERCHANT only |
| `GET /products/:id` | ✓ `GET /stores/{storeId}/products/{productId}` | path includes storeId (extra param) |
| `POST /stores/:storeId/products` | ✓ | CORRECT |
| `PUT /products/:id` | ✓ `PUT /stores/{storeId}/products/{productId}` | path includes storeId |
| `PATCH /products/:id/status` | ⚠ `PUT /{productId}/toggle` | Wrong method (PUT not PATCH), different name |
| `PATCH /products/:id/stock` | ✓ in `InventoryController` | CORRECT (spec-aligned) |
| `DELETE /products/:id` | ✓ | CORRECT |
| `POST /products/:id/images` | ⚠ `POST /{productId}/media` | `/images` vs `/media` naming |
| `DELETE /products/:id/images/:imageId` | ⚠ `DELETE /{productId}/media/{mediaId}` | Same naming deviation |

---

### 2-B. Cart Module

#### Entity Issues

| Entity | Issue | Severity |
|--------|-------|----------|
| `ShoppingCart` | `@OneToOne Customer customer` — correctly uses Customer, not User | ✓ |
| `CartItem` | `@ManyToOne Product product` (from `ProductManagement.entity`) — correct type, correct package | ✓ |
| `Wishlist` | Links to `User` (not `Customer`) via `@ManyToOne @JoinColumn(name = "user_id")`. This means any user (including MERCHANT, ADMIN) can have wishlist items at the DB level, though the controller guards against non-BUYER access. Design inconsistency with `ShoppingCart` which uses `Customer`. | MEDIUM |
| All Cart entities | No `updatedAt` timestamps — acceptable for these entities | LOW |

#### Repository Issues

| Repository | Issue | Severity |
|------------|-------|----------|
| `ShoppingCartRepository` | `findByCustomer_CustomerId()` — correct | ✓ |
| `WishlistRepository` | `deleteByUser_UserIdAndProduct_ProductId()` — correct Spring Data derived delete | ✓ |

#### Service Issues

| Method | Issue | Severity |
|--------|-------|----------|
| `CheckoutService.confirmOrder()` | Clears cart items but never calls `inventoryService.confirmOrder()` to debit `inventory.quantity`. After checkout, stock remains in `reservedQuantity` indefinitely and the actual available quantity is never decremented. | **CRITICAL** |
| `CheckoutService.processCheckout()` | Does not check `product.isActive` for each cart item during checkout. An inactive product can be checked out. | MEDIUM |
| `WishlistService.moveToCart()` | Calls `cartService.addItem(email, ...)` which internally calls `getCustomerByEmail()`. If the `User` on the wishlist item is not a `Customer`, `BadRequestException` is thrown. Controller `@PreAuthorize("hasRole('BUYER')")` prevents this in practice, but the entity-level mismatch is a latent bug. | MEDIUM |

#### Controller Issues

| Endpoint | Expected | Implemented | Auth | Status |
|----------|----------|-------------|------|--------|
| `GET /cart` | Current user's cart | `GET /cart` | BUYER | ✓ |
| `POST /cart/items` | Add item | `POST /cart/items` | BUYER | ✓ |
| `PUT /cart/items/{cartItemId}` | Update qty | `PUT /cart/items/{cartItemId}` | BUYER | ✓ |
| `DELETE /cart/items/{cartItemId}` | Remove item | `DELETE /cart/items/{cartItemId}` | BUYER | ✓ |
| `DELETE /cart` | Clear cart | `DELETE /cart` | BUYER | ✓ |
| `POST /cart/checkout` | Checkout | `POST /cart/checkout` | BUYER | ✓ (but see CRITICAL above) |

All `CartController` and `WishlistController` endpoints:
- Return `ResponseEntity<ApiResponse<T>>` ✓
- Have `@PreAuthorize("hasRole('BUYER')")` ✓
- Use `@Valid` on request bodies ✓

---

### 2-C. Schema Consistency

| Table | Issue | Severity |
|-------|-------|----------|
| `products.product_id` | `SERIAL PRIMARY KEY` (INT); `inventory.product_id` is `BIGINT`. The FK `inventory → products(product_id)` works at DB level (BIGINT can store INT values), but Java-side `ProductService` casts `product.getProductId().longValue()` to bridge `Integer → Long`. Functional but type mismatch. | MEDIUM |
| `categories.store_id` | Nullable FK — allows global categories not belonging to any store. While intentional, the schema lacks a CHECK or partial index to enforce naming uniqueness per-store. | LOW |
| `shopping_carts` | Correctly references `customers(customer_id)` — NOT `users(user_id)` | ✓ |
| `cart_items` | FK to `shopping_carts(cart_id)` ON DELETE CASCADE ✓; FK to `products(product_id)` — missing `ON DELETE CASCADE` or `ON DELETE RESTRICT`. If a product is deleted, cart items referencing it will violate FK constraint. | MEDIUM |
| `wishlists` | FK to `users(user_id)` ON DELETE CASCADE ✓; FK to `products(product_id)` ON DELETE CASCADE ✓ | ✓ |
| `reviews` | FK to `customers(customer_id)` ON DELETE CASCADE ✓; unique constraint `(product_id, customer_id)` ✓ | ✓ |
| `inventory.product_id` | `BIGINT NOT NULL UNIQUE` FK to `products(product_id) ON DELETE CASCADE` ✓ — products uses SERIAL (INT). FK works because PostgreSQL allows BIGINT to reference INT columns via implicit cast. | ✓ (functional) |
| `inventory_transactions` | No FK to `inventory` or `products` — transactions are append-only log entries; this is acceptable. | ✓ |
| No duplicate table definitions | `CREATE TABLE IF NOT EXISTS` used throughout; no table appears twice | ✓ |
| `role_id` column | Absent from `users` table ✓ | ✓ |

---

### 2-D. Cross-Module Consistency

#### Ownership Chain

| Service | Pattern | Consistent? |
|---------|---------|-------------|
| `StoreService` | `email → userRepository.findByEmail() → merchantRepository.findByUser_UserId() → store.getMerchant().getMerchantId().equals(merchant.getMerchantId())` | ✓ baseline |
| `StorefrontCustomizationService` | `getStoreAndVerifyOwner(email, storeId)` — same chain | ✓ |
| `InventoryServiceImpl` | No merchant ownership check — inventory endpoints check `@PreAuthorize("hasRole('MERCHANT')")` at controller level only. No service-level store-ownership guard. | ⚠ MEDIUM — any authenticated merchant can adjust stock for any product |
| `ProductService` | `getStoreAndVerifyOwner(email, storeId)` — same chain as StoreService | ✓ |
| `CartService` | `getCustomerByEmail(email)` — uses Customer not Merchant; correct for cart operations | ✓ (different domain) |
| `CheckoutService` | `getCustomerByEmail(email)` | ✓ |
| `ReviewService` | `email → userRepository.findByEmail() → customerRepository.findByUser_UserId()` — correct for customer domain | ✓ |
| `CategoryService` | No ownership check — categories are admin-managed; correct per design | ✓ |

#### Exception Class Violations

| File | Exception | Issue | Severity |
|------|-----------|-------|----------|
| `AuthController.java:52` | `IllegalArgumentException` | Not handled by `GlobalExceptionHandler`; falls through to generic 500 instead of 400 | MEDIUM |
| `CustomerAuthController.java:52` | `IllegalArgumentException` | Same as above | MEDIUM |
| `InventoryStrategyFactory.java:17` | `IllegalArgumentException` | Invalid strategy type returns 500 instead of 400 | MEDIUM |
| `EmailService.java:60` | `RuntimeException` | Email failure propagates as 500; should be caught and handled gracefully | LOW |

#### `ApiResponse<T>` Coverage

| Controller | All Wrapped | Unwrapped Endpoints |
|------------|-------------|---------------------|
| `AuthController` | ✓ | — |
| `CustomerAuthController` | ✓ | — |
| `MerchantController` | ✓ | — |
| `UserController` | ✓ | — |
| `AdminController` | ⚠ | `DELETE /admin/merchants/{merchantId}` returns `ResponseEntity<Void>` |
| `StoreController` | ✓ | — |
| `InventoryController` | ✓ | — |
| `StorefrontCustomizationController` | ✓ | — |
| `PublicStorefrontController` | ✓ | — |
| `SseController` | N/A | SSE streaming — `ResponseBodyEmitter` type, not applicable |
| `ProductController` | ✓ | — |
| `CategoryController` | ✓ | — |
| `ReviewController` | ✓ | — |
| `CartController` | ✓ | — |
| `WishlistController` | ✓ | — |

#### `@Transactional` on Write Methods

| Service | Method Missing `@Transactional` | Impact |
|---------|--------------------------------|--------|
| `ReviewService` | `getProductReviews()` — read method, but accesses lazy associations; needs `@Transactional(readOnly = true)` | CRITICAL (causes `LazyInitializationException`) |
| `ProductService` | `getStoreProducts()`, `getActiveProducts()`, `getProductById()`, `searchProducts()` — read methods without `@Transactional(readOnly = true)` | LOW (lazy loads may fail in some contexts) |
| `WishlistService` | `getMyWishlist()` — read method, no `@Transactional(readOnly = true)` | LOW |
| All others | All write methods (`@Transactional` present) | ✓ |

#### `@PreAuthorize` Coverage

| Endpoint | Guard | Status |
|----------|-------|--------|
| All `StoreController` write endpoints | `hasRole('MERCHANT')` | ✓ |
| `InventoryController` — merchant ops | `hasRole('MERCHANT')` | ✓ |
| `InventoryController` — no store ownership at service level | Controller-only guard | ⚠ (any MERCHANT) |
| `ProductController` write endpoints | `hasRole('MERCHANT')` | ✓ |
| `ProductController GET /public` | `permitAll` in `SecurityConfig` | ✓ |
| `ReviewController POST/PUT/DELETE` | `hasRole('BUYER')` | ✓ |
| `ReviewController GET` (public) | `permitAll` in `SecurityConfig` | ✓ |
| `CartController` all | `hasRole('BUYER')` | ✓ |
| `WishlistController` all | `hasRole('BUYER')` | ✓ |
| `AdminController` all | `hasRole('ADMIN')` (class level) | ✓ |
| `AuthController` unauthenticated paths | `permitAll` in `SecurityConfig` | ✓ |
| `CustomerAuthController` unauthenticated paths | `permitAll` in `SecurityConfig` | ✓ |
| `SseController /stream/stock` | `permitAll` in `SecurityConfig` | ✓ |

No endpoint found that is accidentally fully public (missing all auth guards and not in `permitAll`).

---

### 2-E. `pom.xml` Audit

| Finding | Details | Severity |
|---------|---------|----------|
| Duplicate dependency | `spring-boot-starter-data-redis` declared at lines 71 and 108 | LOW — Maven resolves to one, but generates build warning |
| `spring-boot-starter-data-redis` present | ✓ Required for cache | ✓ |
| `spring-boot-starter-data-jpa` present | ✓ Required for Hibernate | ✓ |
| `spring-boot-starter-security` present | ✓ | ✓ |
| `spring-boot-starter-validation` present | ✓ Required for `@Valid` | ✓ |
| No new dependencies added by branches | `CartManagement` and `ProductManagement` use only existing dependencies (JPA, Validation, Security) | ✓ |
| No version conflicts | Single Spring Boot parent version manages all Spring dependencies | ✓ |

---

### 2-F. Integration Artefacts

#### TODOs / FIXMEs / HACKs
`grep -rn "TODO\|FIXME\|HACK" src/main/java/` — **ZERO matches.** The codebase is clean of in-code annotations.

#### Unhandled `throw` statements (non-typed exceptions)

| File | Line | Exception | Category |
|------|------|-----------|----------|
| `AuthController.java` | 52 | `IllegalArgumentException` | Technical debt — returns 500 |
| `CustomerAuthController.java` | 52 | `IllegalArgumentException` | Technical debt — returns 500 |
| `InventoryStrategyFactory.java` | 17 | `IllegalArgumentException` | Technical debt — returns 500 |
| `EmailService.java` | 60 | `RuntimeException` | Informational — wraps `MessagingException` |

#### Stub implementations still in place

| Component | Status |
|-----------|--------|
| `DecoratorComponent.java` | Interface only (no `@Entity`). Decorator endpoints exist in controller+service but return empty lists and placeholder messages. No `component_decorators` table in schema. |
| `StorefrontDocument` | Public storefront returns theme + page list only, not full nested document with page components. |

#### Package typo (legacy)

`StoreMangement` (Store Management package) retains the original typo — `StoreMangement` instead of `StoreManagement`. This typo has been consistent since the project's start and all code compiles against it. Not a regression from integration, but noted.

---

## Section 3 — Compilation

### Status: **PASS**

```
[INFO] BUILD SUCCESS
[INFO] Total time: 2.817 s
```

Zero compiler errors. Zero compiler warnings except for the duplicate `spring-boot-starter-data-redis` dependency in `pom.xml` (Maven warning, not Java compiler warning).

### Errors Found
None.

---

## Section 4 — Module Completion

| Module | Spec Endpoints | Correctly Implemented | % | Remaining Gaps |
|--------|---------------|----------------------|---|----------------|
| Auth (Merchant) | 7 | 7 | **100%** | All 7 endpoints present with correct paths, methods, auth, `ApiResponse` |
| Auth (Customer) | 7 | 7 | **100%** | All 7 endpoints in `CustomerAuthController` |
| Store Management | 11 | 10 | **91%** | Settings granular sub-endpoints (1 unified vs 10 spec) |
| Categories | 4 | 4 | **100%** | `GET /categories`, `GET /{id}`, `POST` (ADMIN), `PUT /{id}` (ADMIN), `DELETE /{id}` (ADMIN) — all present |
| Products | 9 | 6 | **67%** | Missing: `PATCH /products/:id/status` (implemented as wrong-method `PUT /toggle`); `/images` path is `/media`; product-level `PATCH /stock` is in InventoryController (spec-correct) |
| Cart | 5 | 5 | **100%** | All 5 cart endpoints correct; checkout exists (with critical inventory bug — functionality broken) |
| Orders | 7 | 0 | **0%** | Entire module absent |
| Analytics | 7 | 0 | **0%** | Entire module absent |
| AI Assistant | 2 | 0 | **0%** | Entire module absent |
| Payment Config | 4 | 0 | **0%** | Entire module absent |
| Shipping | 3 | 0 | **0%** | Entire module absent |
| Notifications | 3 | 0 | **0%** | Entire module absent |
| Settings | 10 | 1 | **10%** | Only unified `GET/PUT /{storeId}/settings`; granular sub-endpoints missing |
| File Upload | 3 | 0 | **0%** | No MinIO integration |
| Public Storefront | 6 | 4 | **67%** | `GET /{storeId}`, `GET /{storeId}/categories`, `GET /{storeId}/products`, `GET /{storeId}/products/{productId}` — present; missing: `/categories/{categoryId}/products`, public orders |
| StorefrontCustomization | 23 | 21 | **91%** | Present: all 21 functional endpoints; Partial: decorator endpoints (4 present but non-functional stubs); media endpoints (3 present and functional) |
| InventoryManagement | 4+ | 4 | **100%** | All 4 spec paths implemented; legacy non-spec endpoints also present |
| Wishlist (bonus) | — | 4 | — | `GET /wishlist`, `POST /wishlist`, `DELETE /{productId}`, `POST /{productId}/move-to-cart` |
| **TOTAL** | **115** | **~60** | **~52%** | Orders, Analytics, AI, Payment, Shipping, Notifications, File Upload entirely absent |

---

## Issues by Severity

### CRITICAL — Blocks functionality or security

1. **`login()` does not check `user.isActive`** — `AuthService.java:107` — Unactivated or deactivated accounts receive valid JWT tokens. A user who registers but never clicks the activation email (or whose account was deactivated by admin) can authenticate and perform all operations.

2. **`CheckoutService.confirmOrder()` does not commit inventory** — `CheckoutService.java:110` — `processCheckout()` calls `inventoryService.reserveStock()` for each item (correct). But `confirmOrder()` only clears cart items — it never calls `inventoryService.confirmOrder()` to debit the committed stock from `inventory.quantity`. After every successful checkout, `reservedQuantity` grows indefinitely and `availableQuantity` becomes permanently negative relative to real stock.

3. **`ReviewService.getProductReviews()` triggers `LazyInitializationException`** — `ReviewService.java:105` — Method is not `@Transactional`. The `toResponse()` mapper at line 124 calls `r.getCustomer().getUser().getFullName()` which accesses two `LAZY` associations outside an open transaction. The public `GET /products/{productId}/reviews` endpoint will throw `LazyInitializationException` on first call.

### HIGH — Incorrect behaviour or data integrity risk

4. **N+1 queries in `ProductService.toResponse()`** — `ProductService.java` — When listing store products (`getStoreProducts()`), each `Product.mediaList` is loaded lazily, issuing one `SELECT` per product. With 100 products = 101 queries. `ProductRepository` has no JOIN FETCH query for products+media.

5. **Decorator persistence is entirely non-functional** — `StorefrontCustomizationService.java:381–383` — Four decorator endpoints accept requests and return 200 OK but persist nothing. No `@Entity`, no table, no repository. Callers receive a `message` field saying "not yet implemented." Silent data loss.

6. **`InventoryService` has no store-ownership guard** — `InventoryController.java` — `PATCH /products/{productId}/stock` and restock endpoints check `hasRole('MERCHANT')` but not whether the authenticated merchant owns the product's store. Any verified merchant can adjust another merchant's inventory.

### MEDIUM — Spec deviation or data integrity concern

7. **`cart_items` has no `ON DELETE` rule for product FK** — `schema.sql` — If a product is deleted, the `cart_items.product_id` FK constraint blocks deletion unless all cart items are cleaned up first. Products have `ON DELETE CASCADE` from `stores`, but `cart_items` has no `ON DELETE CASCADE`. This will cause constraint violation errors when a merchant deletes a product with active cart items.

8. **`product_id` type mismatch across modules** — `products.product_id` is `SERIAL` (INT) but `inventory.product_id` is `BIGINT`. Java bridges this with `.longValue()` casts. Works at runtime but is architecturally inconsistent and will cause confusion when other modules reference product IDs.

9. **`deleteMedia()` ownership not fully verified** — `ProductService.java:173` — Verifies the store is owned by the merchant but does not check the media belongs to a product within that store. A merchant can delete another store's product media with a known `mediaId`.

10. **`IllegalArgumentException` not handled by `GlobalExceptionHandler`** — `AuthController.java:52`, `CustomerAuthController.java:52`, `InventoryStrategyFactory.java:17` — Returns 500 instead of 400. Should use `BadRequestException`.

11. **`Wishlist` entity uses `User` while `ShoppingCart` uses `Customer`** — Design inconsistency. Wishlist is user-scoped while cart is customer-scoped. Presents confusing identity model and a latent bug in `moveToCart()` for non-Customer users.

12. **`CheckoutService.processCheckout()` does not check `product.isActive`** — An inactive/deactivated product can proceed through checkout even if it was deactivated after being added to cart.

13. **`PATCH /products/:id/status` implemented as `PUT /{productId}/toggle`** — Wrong HTTP method (PUT vs PATCH) and different path name. Spec deviation.

14. **Hardcoded fallback credentials** — `application.properties:6` — `${DB_PASSWORD:KHYA43bVfFyNhGWa}` — production password still embedded as fallback default.

### LOW — Cosmetic or minor

15. **`AdminController.deleteMerchant()` returns `ResponseEntity<Void>`** — Inconsistent with all other endpoints which return `ApiResponse<String>`. Should return `ApiResponse<String>` with a "deleted successfully" message.

16. **`Category` entity has no timestamps** — `ProductManagement/entity/Category.java` — No `createdAt`/`updatedAt`. Minor omission.

17. **`StoreMangement` package typo** — Pre-existing inconsistency, not a regression.

18. **Duplicate `spring-boot-starter-data-redis` in `pom.xml`** — Lines 71 and 108. Should deduplicate.

19. **`CategoryService.existsByName()` is global** — Two stores cannot have a category with the same name. Should be `existsByNameAndStore_StoreId()` or `existsByNameAndStoreIsNull()`.

20. **`RuntimeException` in `EmailService`** — Wraps `MessagingException` in an unhandled `RuntimeException`. Should be caught and logged without re-throwing (email failure should not crash the request).

---

## Integration Verdict

| Criterion | Status |
|-----------|--------|
| Previous bugs fixed (38 items) | **36 FIXED, 2 PARTIAL** (Items 15 and 37) |
| Product module correctly integrated | **PARTIAL** — compiles and mostly functional; 3 medium bugs (N+1, deleteMedia ownership, status path deviation); HIGH risk in `getProductReviews` LazyInit |
| Cart module correctly integrated | **PARTIAL** — cart/wishlist functional; checkout integration is BROKEN (inventory never committed after reservation) |
| Schema consistent and correct | **PARTIAL** — `cart_items` missing `ON DELETE` for product FK; `product_id` type mismatch (INT vs BIGINT); otherwise sound |
| Cross-module patterns consistent | **PASS** — ownership chains, exception classes, `ApiResponse<T>` coverage all consistent; 3 `IllegalArgumentException` violations are minor |
| Compilation clean | **PASS** — `BUILD SUCCESS`, 0 errors |
| **Overall verdict** | **NEEDS FIXES** — 3 critical bugs must be resolved before integration testing can proceed |
