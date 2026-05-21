# FlowMerce Backend — Audit Report
Generated: 2026-05-16

## Executive Summary

The FlowMerce backend is a Spring Boot 4.0.2 application with two newer modules (StorefrontCustomization and InventoryManagement) layered onto a core UserManagement/StoreManagement foundation. Of the 110+ spec-required endpoints, only approximately 18 are implemented — a ~16% completion rate — because entire modules (Categories, Products, Orders, Analytics, AI, Payment, Shipping, Notifications, File Upload) are entirely absent. The two newer modules exist but diverge fundamentally from their specifications: StorefrontCustomization implements 6 of 23 required endpoints and uses a separate-column design instead of the required JSONB data blob architecture, while InventoryManagement implements 5 endpoints with wrong paths, is missing an audit log entity, and has no RabbitMQ integration. Across the codebase there is a critical logic bug in user registration (roles are always forced to BUYER regardless of input), no `ApiResponse<T>` wrapper (every response is unwrapped), and no `/api/v1` version prefix on any route. The spec-required login response shape (with `accessToken`, `refreshToken`, `user` object) is not returned — only a raw JWT string. The schema is substantially out of sync with both entities and the spec: activation/reset tokens are stored in in-memory HashMaps (lost on restart), the schema's `role_id` FK approach conflicts with the entity's direct `@Enumerated` role column, and 13 spec-required tables are entirely absent.

---

## SECTION A — Existing Modules

### A-1. Critical Bugs

#### BUG-001: Role assignment always forced to BUYER — merchant registration broken
- **File:** `src/main/java/com/example/flowmerceproject/UserManagement/service/AuthService.java` lines 45–53
- **Description:** `String roleUpper = role.name().toUpperCase()` reads from the already-defaulted `role` variable (always `BUYER`), not from `request.getRole()`. The result is discarded and never assigned back. All users register as BUYER regardless of the `role` field in the request body.
- **Impact:** Merchants cannot register with the MERCHANT role directly. They must register as BUYER, then call `POST /api/merchants/me` separately. More critically, attempting to pass `"role": "MERCHANT"` silently fails — no error, just wrong data.
- **Fix hint:** Replace `String roleUpper = role.name().toUpperCase()` with `role = Role.valueOf(request.getRole().name().toUpperCase())` and assign back to the `role` variable.

#### BUG-002: Activation and password-reset tokens stored in in-memory HashMaps
- **File:** `AuthService.java` lines 36–37
- **Description:** `private final Map<String, String> activationTokens = new HashMap<>()` and `passwordResetTokens` are instance-level fields. They are wiped on every restart and are not shared across instances.
- **Impact:** CRITICAL — In any production or multi-instance deployment, tokens are lost on restart. A user who requests a password reset and the server restarts before they click the link gets a permanent "Invalid token" error. Tokens also never expire, creating a security window of indefinite length.
- **Fix hint:** Persist tokens to the `sessions` table or a dedicated `verification_tokens` table with an `expires_at` column.

#### BUG-003: Password reset token has no expiry
- **File:** `AuthService.java` line 37
- **Description:** `passwordResetTokens` never removes entries except on successful use. An attacker who intercepts a reset link can use it weeks later.
- **Impact:** HIGH security vulnerability.
- **Fix hint:** Store tokens with a `LocalDateTime expiresAt` in the database and check expiry on use.

#### BUG-004: `login()` returns a raw JWT string — spec requires structured response
- **File:** `AuthService.java` line 91, `AuthController.java` line 36
- **Description:** `login()` returns `String token`. The spec requires: `{ "accessToken": "...", "refreshToken": "...", "expiresIn": 86400000, "user": { "id", "name", "email", "role", "createdAt" } }`.
- **Impact:** CRITICAL — Frontend cannot parse login response correctly. No refresh token is generated or stored anywhere.
- **Fix hint:** Create a `LoginResponse` DTO with the above fields and return it. Generate and persist a separate refresh token.

#### BUG-005: No refresh token endpoint
- **File:** N/A — entirely missing
- **Description:** `POST /auth/merchant/refresh` is required by the spec. No refresh token is generated at login, and no refresh endpoint exists.
- **Impact:** CRITICAL — Access tokens expire after 24 h with no renewal path.

#### BUG-006: `register()` returns HTTP 200 instead of 201 Created
- **File:** `AuthController.java` line 24
- **Description:** `ResponseEntity.ok(...)` returns 200. Resource creation should return 201.
- **Impact:** LOW — Non-standard HTTP status code.

#### BUG-007: Default currency is "USD" — spec targets Egyptian market (EGP)
- **File:** `StoreSettings.java` line 24, `StoreService.java` line 56
- **Description:** `currency` defaults to `"USD"` in both entity and service. The spec implies EGP for an Egyptian-market platform.
- **Impact:** MEDIUM — Incorrect default will ship incorrect invoices and payment amounts.

#### BUG-008: `schema.sql` users table uses `role_id FK` but entity uses `@Enumerated role VARCHAR`
- **File:** `schema.sql` line 12 vs `User.java` line 40
- **Description:** `schema.sql` defines `role_id INT, FOREIGN KEY (role_id) REFERENCES roles(role_id)`. The `User` entity maps `@Enumerated(EnumType.STRING) @Column(name = "role")`. With `ddl-auto=update`, Hibernate will add a `role` column but the schema column is `role_id`. These coexist as separate columns, breaking all role lookups that query `role_id`.
- **Impact:** CRITICAL data integrity — The two role-storage mechanisms are incompatible.

#### BUG-009: `users` entity has `is_active` field not in `schema.sql`
- **File:** `User.java` line 44 vs `schema.sql` lines 10–20
- **Description:** `User.isActive` maps to `is_active` column. The schema has no `is_active` column. Hibernate adds it via `ddl-auto=update` but schema.sql cannot be used to bootstrap a fresh DB.
- **Impact:** MEDIUM — Schema bootstrapping from `schema.sql` will fail; DB state depends on Hibernate's alter table.

#### BUG-010: `users` entity missing `is_mfa_enabled` that is in `schema.sql`
- **File:** `schema.sql` line 17 vs `User.java`
- **Description:** `schema.sql` has `is_mfa_enabled BOOLEAN`. The `User` entity has no corresponding field. This column is orphaned in the schema.

#### BUG-011: `createMerchantProfile()` returns HTTP 200 instead of 201
- **File:** `MerchantController.java` line 26
- **Description:** `ResponseEntity.ok(...)` on a POST that creates a resource.
- **Impact:** LOW.

#### BUG-012: Duplicate RedisConfig beans — value serializer mismatch
- **File:** `StorefrontCustomization/config/RedisConfig.java` and `InventoryMangement/config/RedisConfig.java`
- **Description:** Two `@Configuration` classes both declare Redis beans. `spring.main.allow-bean-definition-overriding=true` masks the conflict. `InventoryMangement.config.RedisConfig` declares `RedisTemplate<String, Object>` with a Jackson JSON serializer for values — but `InventoryServiceImpl` injects `StringRedisTemplate` (not this template). The `RedisTemplate<String, Object>` bean is unused and a source of confusion.
- **Impact:** MEDIUM — unused bean, fragile configuration, risk of serialization errors if templates are swapped.

#### BUG-013: N+1 query risk in `getMyStores()` — lazy merchant access in loop
- **File:** `StoreService.java` lines 64–68
- **Description:** `findByMerchant_MerchantId()` loads a list of stores with LAZY merchant association. `toResponse()` then calls `store.getMerchant().getMerchantId()` for each store, triggering one SELECT per store. OSIV (open-in-view=true by default) prevents LazyInitializationException but does not prevent N+1.
- **Impact:** MEDIUM performance — degrades linearly with store count.
- **Fix hint:** Add a JOIN FETCH in the repository query or use a projection DTO.

#### BUG-014: `storefront.cache.ttl-minutes` property does not exist — implemented as `ttl-seconds`
- **File:** `application.properties` line 37, `StorefrontCustomizationService.java` line 43
- **Description:** The code binds `${storefront.cache.ttl-seconds:3600}`. The spec and audit checklist reference `storefront.cache.ttl-minutes`. The property name diverges from the spec.
- **Impact:** LOW — Works, but integration with documentation/configuration management will mismatch.

#### BUG-015: `InventoryMangement` package name is misspelled
- **File:** All files under `InventoryMangement/`
- **Description:** Package name is `InventoryMangement` instead of `InventoryManagement`. The directory name also has the typo.
- **Impact:** LOW cosmetic — will confuse developers and require search/replace refactor before handoff.

#### BUG-016: CORS not configured — no allowed origins defined
- **File:** `SecurityConfig.java` line 28
- **Description:** `.cors(Customizer.withDefaults())` enables CORS but uses Spring's default `CorsConfigurationSource` — no `CorsConfigurationSource` bean is defined, so no origins, methods, or headers are explicitly allowed. This will reject all cross-origin requests from the frontend.
- **Impact:** CRITICAL — Frontend (`localhost:3000` or `*.flowmerce.io`) cannot make API calls.
- **Fix hint:** Define a `CorsConfigurationSource` bean allowing the required origins.

#### BUG-017: Credentials stored in plain text in `application.properties`
- **File:** `application.properties` lines 4–5, 28
- **Description:** `spring.datasource.password=KHYA43bVfFyNhGWa` (Supabase production password) and `spring.mail.password=0000` are committed to the codebase in plain text.
- **Impact:** HIGH security — Any developer with repo access has production DB credentials.
- **Fix hint:** Use environment variables or a secrets manager.

---

### A-2. API Spec Deviations

#### Base URL Mismatch
All routes use `/api/...` without a `/v1` version segment. The spec requires `/api/v1`. No `server.servlet.context-path` is set in `application.properties`.

**Severity: CRITICAL** — Every single endpoint path is wrong against the spec.

#### Completely Missing Modules
- [ ] Categories — 4 spec endpoints (GET/POST `/stores/:storeId/categories`, PUT/DELETE `/categories/:id`)
- [ ] Products — 9 spec endpoints (full CRUD + stock/status patches + image management)
- [ ] Orders — 7 spec endpoints (merchant + customer + public views)
- [ ] Analytics — 7 spec endpoints (overview, revenue, orders, top-products, funnel, payment-split, customers)
- [ ] AI Assistant — 2 spec endpoints (`/ai/chat`, `/stores/:storeId/ai/insights`)
- [ ] Payment Config — 4 spec endpoints
- [ ] Shipping — 3 spec endpoints
- [ ] Notifications — 3 spec endpoints
- [ ] File Upload — 3 spec endpoints (MinIO-backed logo, product-image, delete)
- [ ] Public Storefront catalog — 5 of 6 spec endpoints missing (`/categories`, `/products`, `/products/:id`, `/category/:id`, `/orders`)

#### Wrong Path or Method

| # | Spec | Implemented As | Severity |
|---|------|----------------|----------|
| 1 | POST `/api/v1/auth/merchant/register` | POST `/api/auth/register` | CRITICAL |
| 2 | POST `/api/v1/auth/merchant/login` | POST `/api/auth/login` | CRITICAL |
| 3 | POST `/api/v1/auth/merchant/logout` | POST `/api/auth/logout` | HIGH |
| 4 | POST `/api/v1/auth/merchant/refresh` | MISSING | CRITICAL |
| 5 | GET `/api/v1/auth/merchant/me` | GET `/api/users/me` | HIGH |
| 6 | POST `/api/v1/auth/merchant/forgot-password` | POST `/api/auth/forgot-password` | MEDIUM |
| 7 | POST `/api/v1/auth/merchant/reset-password` | POST `/api/auth/reset-password` | MEDIUM |
| 8 | POST `/api/v1/auth/customer/*` (7 endpoints) | MISSING — no customer auth | CRITICAL |
| 9 | GET `/api/v1/stores/slug/:slug` | MISSING | HIGH |
| 10 | PUT `/api/v1/stores/:id/brand` | MISSING | HIGH |
| 11 | PUT `/api/v1/stores/:id/colors` | PUT `/api/stores/{id}/storefront/colors` | HIGH |
| 12 | PUT `/api/v1/stores/:id/payment-methods` | MISSING | HIGH |
| 13 | POST `/api/v1/stores/:id/publish` | PUT `/api/stores/{id}/publish` (wrong method) | MEDIUM |
| 14 | POST `/api/v1/stores/:id/unpublish` | PUT `/api/stores/{id}/deactivate` (wrong path+method) | HIGH |
| 15 | PUT `/api/v1/stores/:id/onboarding-step` | MISSING | MEDIUM |
| 16 | PATCH `/api/v1/products/:id/stock` | POST `/api/inventory/adjust` (wrong path+method) | HIGH |
| 17 | GET `/api/v1/stores/:storeId/inventory` | MISSING | HIGH |
| 18 | POST `/api/v1/stores/:storeId/inventory/:productId/restock` | MISSING | HIGH |
| 19 | GET `.../inventory/:productId/history` | MISSING (no audit log) | HIGH |

#### Wrong Response Shape

| # | Endpoint | Issue | Severity |
|---|----------|-------|----------|
| 1 | POST `/auth/merchant/login` | Returns raw JWT string, not `{accessToken, refreshToken, expiresIn, user}` | CRITICAL |
| 2 | All endpoints | No `ApiResponse<T>` wrapper — raw DTOs returned | CRITICAL |
| 3 | POST `/auth/merchant/register` | Returns plain String, not structured response | HIGH |
| 4 | All store endpoints | `StoreResponse` missing `slug` field (mapped via `storeUrl`) | MEDIUM |
| 5 | POST `/stores` | Returns 200 instead of 201 (store creation) | LOW |

---

### A-3. Response Format Compliance

**No `ApiResponse<T>` wrapper exists anywhere in the codebase.**

All controllers return:
- Raw DTO objects (e.g. `StoreDTOs.StoreResponse`)
- Plain `String` messages
- `Boolean` values
- `ResponseEntity<Map<String, Object>>` for validation errors

The spec requires every response to be wrapped:
```json
{ "success": true, "data": { ... }, "message": "..." }
{ "success": false, "error": "...", "code": "VALIDATION_ERROR", "status": 400, "details": { ... } }
```

**`ErrorResponse` missing required fields:**
Current `ErrorResponse` fields: `status`, `error`, `message`, `path`, `timestamp`.
Missing: `code` (String e.g. "VALIDATION_ERROR"), `details` (Map<String, Object>).

**Validation error handler returns different format:**
`GlobalExceptionHandler` handles `MethodArgumentNotValidException` with a raw `Map<String, Object>` that has `fields` key — completely different from `ErrorResponse`.

---

### A-4. Login Response Compliance

`POST /auth/merchant/login` must return:
```json
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 86400000,
  "user": { "id": "...", "name": "...", "email": "...", "role": "MERCHANT", "createdAt": "..." } }
```

**What the code does:** `AuthService.login()` calls `jwtUtil.generateToken()` and returns the raw token `String`. No refresh token is generated. No user object is constructed. The controller wraps it in `ResponseEntity<String>`.

**Verdict: CRITICAL NON-COMPLIANCE.**

---

### A-5. Entity / Schema Gap Analysis

#### Fields in `schema.sql` not in any entity
| Table | Schema Column | Entity Status |
|-------|--------------|---------------|
| `users` | `role_id INT FK` | Entity uses `role VARCHAR` (Enum) — incompatible |
| `users` | `is_mfa_enabled BOOLEAN` | MISSING from `User.java` |
| `user_profiles` | entire table | NO `UserProfile` entity |
| `admins` | entire table | `Admin.java` exists (not audited in detail) |
| `carts`, `cart_items` | entire tables | NO entities |
| `orders`, `order_items` | entire tables | NO entities |
| `payments`, `invoices` | entire tables | NO entities |
| `delivery_providers`, `deliveries` | entire tables | NO entities |
| `ai_suggestions` | entire table | NO entity |
| `notifications` | entire table | NO entity |
| `reviews` | entire table | NO entity |
| `reports` | entire table | NO entity |
| `categories` | entire table | NO entity |
| `products`, `product_media` | entire tables | NO entities |

#### Fields in entity not in `schema.sql`
| Entity | Field | Schema Status |
|--------|-------|---------------|
| `User.java` | `isActive` / `is_active` | NOT in schema.sql users table |
| `User.java` | `role` (VARCHAR via `@Enumerated`) | Schema has `role_id INT FK` instead |

#### Tables required by spec but entirely absent from schema
`order_status_history`, `payment_config`, `shipping_config`, `notification_config`,
`tax_config`, `ai_chat_history`, `verification_tokens`, `storefronts` (spec design),
`store_designs`, `component_decorators`, `storefront_media`

---

### A-6. Security Config Audit

#### Permit list (no token required):
- `/api/auth/register` ✓
- `/api/auth/login` ✓
- `/api/auth/activate` ✓
- `/api/auth/forgot-password` ✓
- `/api/auth/reset-password` ✓
- `/actuator/health` ✓
- `/api/public/storefront/**` ✓

#### Missing from permit list:
- `/stream/stock` — stock SSE broadcast endpoint referenced in `StockEventListener` but not in security config
- No `/api/v1/**` paths (the actual spec base URL is never used)

#### CORS status:
**NOT configured.** `.cors(Customizer.withDefaults())` without a `CorsConfigurationSource` bean does not allow any cross-origin requests. The frontend will receive CORS errors for every call.

Required origins missing:
- `http://localhost:3000` — local development
- `https://*.flowmerce.io` — production storefronts

#### Merchant endpoint exposure:
All `/api/stores/**` endpoints correctly require `@PreAuthorize("hasRole('MERCHANT')")`. The admin endpoint `GET /api/stores/admin/all` is inside `StoreController` (mapped under `/api/stores`) — it uses `/admin/all` sub-path and has `@PreAuthorize("hasRole('ADMIN')")` but is mounted at `/api/stores/admin/all` not `/api/admin/stores`, which may conflict with Spring Security's pattern matching for `/api/admin/**`.

---

## SECTION B — StorefrontCustomization Module

### B-1. Entity Completeness

| Entity | Exists | Index columns OK | JSONB field OK | Violations |
|--------|--------|-----------------|----------------|------------|
| `Storefront` (→ `storefronts`) | ✗ ABSENT | N/A | N/A | `StorefrontTemplate` is used instead; maps to `storefront_templates`; structurally different |
| `StoreDesign` (→ `store_designs`) | ✗ ABSENT | N/A | N/A | Design data scattered as 6 separate VARCHAR columns in `ThemeTemplate` |
| `Page` (→ `storefront_pages`) | ✓ EXISTS | `slug` ✓, `nav_order` ✓ | ✗ NO `data JSONB` | Has `title`, `page_type`, `is_published`, `meta_description`, `show_in_nav` as top-level columns — all should be in `data` JSONB |
| `BaseComponent` (→ `base_components`) | ✓ EXISTS | `sort_order` ✓, `store_id` ✓ | ✗ `content TEXT` not JSONB | Has `component_type`, `name`, `is_visible` as top-level columns; `content` is TEXT not JSONB; no `@JdbcTypeCode(SqlTypes.JSON)` |
| `ComponentDecorator` (→ `component_decorators`) | ✗ ABSENT | N/A | N/A | Only a Java `interface` exists — NOT a JPA entity; no table |
| `Media` (→ `storefront_media`) | ✗ ABSENT | N/A | N/A | No entity, no table, no repository |

---

### B-2. JSONB-Only Rule Violations

The spec rule: **all business/configuration data lives in the `data JSONB` column. Only IDs, FKs, ordering fields, and timestamps are separate columns.**

**Violations:**

| Entity | Violating Columns | Severity |
|--------|-------------------|----------|
| `ThemeTemplate` | `background VARCHAR(7)`, `header VARCHAR(7)`, `footer VARCHAR(7)`, `accent VARCHAR(7)`, `text_color VARCHAR(7)`, `card VARCHAR(7)` — all 6 color tokens are top-level columns | CRITICAL — entire design approach conflicts |
| `Page` | `title VARCHAR(100)`, `page_type VARCHAR(20)`, `is_published BOOLEAN`, `meta_description VARCHAR(300)`, `show_in_nav BOOLEAN` | HIGH — 5 config fields outside JSONB |
| `BaseComponent` | `component_type VARCHAR(50)`, `name VARCHAR(100)`, `content TEXT` (not JSONB), `is_visible BOOLEAN` | HIGH — 4 config fields outside JSONB; `content` uses wrong column type |

---

### B-3. Repository Method Coverage

| Repository | Required Method | Status |
|------------|----------------|--------|
| `StorefrontTemplateRepository` | `findByStore_StoreId(Integer)` | ✓ EXISTS |
| `StorefrontTemplateRepository` | `existsByStore_StoreId(Integer)` | ✓ EXISTS |
| `StorefrontTemplateRepository` | `findByStore_StoreUrlAndStatus(String, StorefrontStatus)` | ✗ ABSENT — custom JPQL `findPublishedByStoreUrl` exists but uses different signature |
| `StoreDesignRepository` | (entire repository) | ✗ ABSENT — entity doesn't exist |
| `PageRepository` | `findByStorefrontTemplate_TemplateIdOrderByNavOrderAsc(Long)` | ✓ EXISTS (uses TemplateId, not StorefrontId) |
| `PageRepository` | `findByStorefrontTemplate_TemplateIdAndSlug(Long, String)` | ✓ EXISTS |
| `PageRepository` | `existsByStorefrontTemplate_TemplateIdAndSlug(Long, String)` | ✓ EXISTS |
| `PageRepository` | `countByStorefrontTemplate_TemplateId(Long)` | ✓ EXISTS |
| `BaseComponentRepository` | `findByPage_PageIdOrderBySortOrderAsc(Long)` | ✓ EXISTS |
| `BaseComponentRepository` | `nextSortOrderForPage(@Param Long)` | ✓ EXISTS |
| `ComponentDecoratorRepository` | (entire repository) | ✗ ABSENT |
| `ComponentDecoratorRepository` | `findByComponent_ComponentIdOrderByPriorityAsc(Long)` | ✗ ABSENT |
| `ComponentDecoratorRepository` | `deleteByComponent_ComponentId(Long)` | ✗ ABSENT |
| `MediaRepository` | (entire repository) | ✗ ABSENT |
| `MediaRepository` | `findByStore_StoreIdOrderByUploadedAtDesc(Integer)` | ✗ ABSENT |

---

### B-4. DTO Contract Violations

The spec requires request DTOs to carry a `JsonNode data` field, and responses to echo `JsonNode data` alongside structural fields.

| Required DTO | Status | Issue |
|-------------|--------|-------|
| `SaveDesignRequest { JsonNode data }` | ✗ ABSENT | No design request DTO exists |
| `SavePageRequest { JsonNode data }` | ✗ ABSENT | No page creation/update DTO |
| `SaveComponentRequest { JsonNode data }` | ✗ ABSENT | No component DTO |
| `SaveDecoratorRequest { JsonNode data }` | ✗ ABSENT | No decorator DTO |
| `SaveMediaRequest { JsonNode data }` | ✗ ABSENT | No media DTO |
| `DesignResponse { JsonNode data }` | ✗ ABSENT | No design response DTO |
| `PageResponse { JsonNode data }` | ✗ ABSENT | Only `PageSummary` exists without `data` field |
| `ComponentResponse { JsonNode data }` | ✗ ABSENT | Only `ComponentSummary` exists without `data` field |
| `DecoratorResponse { JsonNode data }` | ✗ ABSENT | No decorator response DTO |
| `MediaResponse { JsonNode data }` | ✗ ABSENT | No media response DTO |
| `StorefrontMetaResponse` | ✗ ABSENT | Uses `StorefrontTemplateResponse` for all responses |
| `StorefrontDocument` | ✗ ABSENT | No complete nested tree for public endpoint |

**What exists instead:** `CreateStorefrontRequest` (6 typed color fields), `UpdateThemeRequest` (6 typed color fields), `StorefrontTemplateResponse` (flat structure with `ThemeResponse` and `PageSummary` list), `PageSummary`, `ComponentSummary`. None carry `JsonNode data`.

---

### B-5. Service Logic

| Check | Status | Details |
|-------|--------|---------|
| Ownership chain (`email → user → merchant → store`) | ✓ PASS | `getStoreAndVerifyOwner()` → `getMerchantByEmail()` correctly implemented |
| JSON field extraction (`slug`/`navOrder` from `data`, `sortOrder` from `data`, `priority` from `data`) | ✗ FAIL | DTOs use typed fields, not `JsonNode data`; extraction from JSONB not implemented |
| Cache eviction on every write — `createStorefront()` | N/A | DRAFT state, not cached |
| Cache eviction on every write — `updateTheme()` | ✓ PASS | Writes to cache (write-behind), doesn't evict |
| Cache eviction on every write — `publishStorefront()` | ✓ PASS | Primes cache after publish |
| Cache eviction on every write — `unpublishStorefront()` | ✓ PASS | Deletes key from Redis |
| Cache eviction — page create/update/delete | N/A | Endpoints don't exist |
| Cache eviction — component add/update/delete/reorder | N/A | Endpoints don't exist |
| Cache eviction — decorator operations | N/A | Endpoints don't exist |
| Cache eviction — media delete | N/A | Endpoint doesn't exist |
| Init idempotency | ✓ PASS | Checks `existsByStore_StoreId()` before creating |
| HOME page protection (deletePage throws ForbiddenException) | ✗ FAIL | No `deletePage()` method or delete-page endpoint exists |
| No data interpretation | ✓ PASS (de facto) | Service never reads `data` blob contents because JSONB design not implemented |

**Methods missing cache evict():** N/A for unimplemented endpoints. For implemented writes, the cache is correctly updated or deleted.

**Key scheme mismatch:** Code uses `storefront:public:{storeUrl}` (prefix: `storefront:public:`). Spec requires `flowmerce:sf:{storeUrl}`.

---

### B-6. Redis Cache-Aside Flow

| Step | Implemented | Issues |
|------|-------------|--------|
| `get()` try/catch | ✓ Partial | Catches `JsonProcessingException` but NOT `RedisConnectionException` — a Redis failure throws uncaught exception to the caller |
| `put()` with TTL + try/catch | ✓ Partial | Same issue — only JSON exceptions caught; Redis connection failure propagates |
| `evict()` try/catch | ✗ FAIL | `redisTemplate.delete()` in `unpublishStorefront()` has no try/catch — Redis failure causes 500 instead of graceful degradation |
| Public endpoint cache-aside sequence | ✓ PASS | Correct order: check cache → query DB → populate cache → return |
| Publish primes cache | ✓ PASS | `publishStorefront()` calls `putInCache()` after saving |
| Dedicated `StorefrontCacheService` class | ✗ ABSENT | Cache logic inlined in `StorefrontCustomizationService`; not extracted to a separate bean |
| TTL config key name | ✗ MISMATCH | Code: `storefront.cache.ttl-seconds`; spec: `storefront.cache.ttl-minutes` |
| Cache key scheme | ✗ MISMATCH | Code: `storefront:public:{storeUrl}`; spec: `flowmerce:sf:{storeUrl}` |

---

### B-7. Controller Coverage

Base path: `/api/stores/{storeId}/storefront/`

| Endpoint | Exists | Method Correct | Auth Guard | Issues |
|----------|--------|---------------|-----------|--------|
| POST `/init` | ✓ | ✓ | ✓ MERCHANT | Returns 201 ✓ |
| GET `/` | ✓ | ✓ | ✓ MERCHANT | — |
| POST `/publish` | ✓ | ✓ | ✓ MERCHANT | — |
| POST `/unpublish` | ✓ | ✓ | ✓ MERCHANT | — |
| GET `/design` | ✗ MISSING | — | — | No design CRUD |
| PUT `/design` | ✗ MISSING | — | — | No design CRUD |
| GET `/pages` | ✗ MISSING | — | — | — |
| POST `/pages` | ✗ MISSING | — | — | — |
| GET `/pages/{pageId}` | ✗ MISSING | — | — | — |
| PUT `/pages/{pageId}` | ✗ MISSING | — | — | — |
| DELETE `/pages/{pageId}` | ✗ MISSING | — | — | No HOME guard either |
| GET `/pages/{pageId}/components` | ✗ MISSING | — | — | — |
| POST `/pages/{pageId}/components` | ✗ MISSING | — | — | — |
| PUT `/pages/{pageId}/components/{id}` | ✗ MISSING | — | — | — |
| DELETE `/pages/{pageId}/components/{id}` | ✗ MISSING | — | — | — |
| PUT `/pages/{pageId}/components/reorder` | ✗ MISSING | — | — | — |
| GET `/components/{id}/decorators` | ✗ MISSING | — | — | — |
| POST `/components/{id}/decorators` | ✗ MISSING | — | — | — |
| PUT `/components/{id}/decorators/{dId}` | ✗ MISSING | — | — | — |
| DELETE `/components/{id}/decorators/{dId}` | ✗ MISSING | — | — | — |
| GET `/media` | ✗ MISSING | — | — | — |
| POST `/media` | ✗ MISSING | — | — | — |
| DELETE `/media/{mediaId}` | ✗ MISSING | — | — | — |
| GET `/colors` | ✓ | ✓ | ✓ MERCHANT | Non-spec bonus endpoint |
| PUT `/colors` | ✓ | ✓ | ✓ MERCHANT | Non-spec path (spec: PUT `/stores/:id/colors`) |

**Public:**

| Endpoint | Exists | Auth | Issues |
|----------|--------|------|--------|
| GET `/api/public/storefront/{storeUrl}` | ✓ | None (permitAll) ✓ | Returns `StorefrontTemplateResponse` (not `StorefrontDocument`); missing nested components/decorators |

**Total: 6 of 23 merchant endpoints implemented (26%). Public: 1 of 6 (17%).**

---

### B-8. Schema Audit — Storefront Tables

| Table | Exists | `data JSONB` | FKs | Indexes | Issues |
|-------|--------|-------------|-----|---------|--------|
| `storefronts` | ✗ MISSING | N/A | N/A | N/A | `storefront_templates` used instead; different design |
| `store_designs` | ✗ MISSING | N/A | N/A | N/A | Colors in `theme_templates` as 6 VARCHAR columns |
| `storefront_pages` | ✓ | ✗ NO JSONB | FK → `storefront_templates(template_id) CASCADE` ✓ | UNIQUE(`storefront_id`, `slug`) ✓ | Has `title`, `page_type`, `is_published`, `meta_description`, `show_in_nav` as separate columns; no `data JSONB` |
| `base_components` | ✓ | ✗ `content TEXT` not JSONB | FK → `stores(store_id) CASCADE` ✓, FK → `storefront_pages(page_id) CASCADE` ✓ | None | Has `component_type`, `name`, `is_visible` as columns; `content TEXT` not JSONB |
| `component_decorators` | ✗ MISSING | N/A | N/A | N/A | No table |
| `storefront_media` | ✗ MISSING | N/A | N/A | N/A | No table |
| `theme_templates` | ✓ (extra) | N/A | None | None | Not in spec design; replaces `store_designs`; 6 VARCHAR color columns |
| `storefront_templates` | ✓ (extra) | N/A | FK → `stores(store_id) CASCADE` ✓ | — | Not in spec design; replaces `storefronts` |

---

### B-9. Redis Config

**StorefrontCustomization/config/RedisConfig.java:**
- `StringRedisTemplate` bean ✓
- Uses `StringRedisSerializer` for both key and value (by default in `StringRedisTemplate`) ✓
- Does NOT use `JdkSerializationRedisSerializer` ✓
- Also declares an `ObjectMapper` bean — this may conflict with Spring Boot's auto-configured `ObjectMapper` (covered by `allow-bean-definition-overriding=true`)

**application.properties:**
- `spring.data.redis.host=localhost` ✓
- `spring.data.redis.port=6379` ✓

---

## SECTION C — InventoryManagement Module

### C-1. Module Structure

**Present:** `controller/`, `entity/`, `dto/`, `service/`, `repository/`, `strategy/`, `event/`, `config/`

**Missing:** No `service/InventoryAuditLog*` class, no movement history entity or repository.

**Package name typo:** `InventoryMangement` (missing 'a') throughout all files and directory.

---

### C-2. Entity Completeness

| Entity | Exists | Key Fields Present | Issues |
|--------|--------|--------------------|--------|
| Stock snapshot (`Inventory`) | ✓ | `productId` ✓, `quantity` ✓, `reservedQuantity` ✓, `lowStockThreshold` ✓ (default 10), `@Version` ✓ | **Missing:** `storeId` FK (denorm); **Missing:** `updatedAt` timestamp; `productId` is `@Column(Long)` not `@ManyToOne` — no JPA relationship |
| Stock movement audit log | ✗ ABSENT | — | **Entirely missing.** No entity for `type` (RESTOCK/SALE/RETURN/ADJUSTMENT/DAMAGE), `quantityChange`, `quantityBefore`, `quantityAfter`, `referenceId`, `note`, `createdBy`. Silent stock changes are untraceable. |

---

### C-3. Stock Deduction Safety

| Check | Status | Details |
|-------|--------|---------|
| `@Transactional` on order-placement method | ✓ PASS | `reserveStock()` and `confirmOrder()` are `@Transactional` |
| Stock check before deduction | ✓ PASS | `confirmOrder()` checks `inv.getQuantity() < quantity`; `reserveStock()` uses atomic Redis decrement with rollback |
| `BadRequestException` on insufficient stock | ✓ PASS | Both `NormalStockStrategy` and `confirmOrder()` throw `BadRequestException` |
| Audit log written | ✗ FAIL | No audit log entity — zero traceability for stock changes |
| Stock restored on order cancellation/refund | ✗ PARTIAL | `releaseStock()` endpoint exists but is manually called — no automated trigger from order cancellation since Order module doesn't exist |

---

### C-4. Low Stock Alert Integration

| Check | Status | Details |
|-------|--------|---------|
| Stock checked after every deduction | ✓ PASS | `StockChangedEvent` published after every `adjustStock`, `reserveStock`, `confirmOrder` |
| RabbitMQ `stock.low` event | ✗ FAIL | Uses Spring SSE (`sseService.broadcast()`) instead of `RabbitTemplate.convertAndSend("stock.low", ...)`. No RabbitMQ dependency in `pom.xml`. |
| Threshold configurable (not hardcoded) | ✗ FAIL | `lowStockThreshold` is hardcoded as `DEFAULT 10` in `Inventory` entity and `DEFAULT 10` in schema. No `@Value("${inventory.low-stock-threshold:5}")` injection. |
| `inventory.low-stock-threshold` in `application.properties` | ✗ MISSING | Key absent from config file |

**Note on SSE alert:** `StockEventListener` has the merchant routing commented out (`// TODO: inject ProductRepository and get merchant email`) — alerts currently broadcast to ALL connected clients via the public SSE stream.

---

### C-5. API Endpoints

| Spec Endpoint | Implemented | Auth | Issues |
|--------------|-------------|------|--------|
| PATCH `/products/:id/stock` | ✗ MISSING | — | Implemented as POST `/api/inventory/adjust` (wrong path, wrong method) |
| GET `/stores/:storeId/inventory` | ✗ MISSING | — | — |
| POST `/stores/:storeId/inventory/:productId/restock` | ✗ MISSING | — | — |
| GET `/stores/:storeId/inventory/:productId/history` | ✗ MISSING | — | No audit log entity |
| POST `/api/inventory/adjust` (non-spec) | ✓ | ✓ MERCHANT | Wrong path/method vs spec |
| POST `/api/inventory/reserve` (non-spec) | ✓ | ✓ BUYER | Wrong path vs spec |
| POST `/api/inventory/release` (non-spec) | ✓ | ✓ BUYER/ADMIN | Wrong path vs spec |
| GET `/api/inventory/{productId}` (non-spec) | ✓ | ✗ NO AUTH | Public — intentional but undocumented |
| GET `/api/inventory/{productId}/check` (non-spec) | ✓ | ✗ NO AUTH | Public — intentional but undocumented |

---

### C-6. Concurrency Safety

**Present:**
- `@Version` field on `Inventory` entity ✓ — optimistic locking
- `OptimisticLockingFailureException` caught and rethrown as `BadRequestException` ✓
- Redis atomic `decrement()` in `reserveStock()` ✓

**Not present:**
- `@Lock(LockModeType.PESSIMISTIC_WRITE)` — not used (optimistic is used instead, acceptable)
- Database atomic `UPDATE ... SET quantity = quantity - ?` — not used (application-level update)

**Overall:** Concurrency handling is acceptable for moderate load via optimistic locking + Redis atomic decrement. Under high concurrent load, optimistic locking retries shift responsibility to the caller. **Severity: LOW** for current scale.

---

### C-7. Schema Audit — Inventory Tables

| Table | Exists | Key Columns | FKs | Indexes | Issues |
|-------|--------|-------------|-----|---------|--------|
| `inventory` | ✓ | `inventory_id` ✓, `product_id BIGINT UNIQUE` ✓, `quantity INT DEFAULT 0` ✓, `reserved_quantity INT DEFAULT 0` ✓, `low_threshold INT DEFAULT 10` ✓ (not 5), `version INT DEFAULT 0` ✓ | FK → `products(product_id) ON DELETE CASCADE` ✓ | `UNIQUE(product_id)` ✓ | **Missing:** `store_id` column; **Missing:** `updated_at` timestamp; `low_threshold` default is 10, spec says 5 |
| `inventory_transactions` | ✗ ENTIRELY MISSING | — | — | — | No movement audit table at all |

---

## SECTION D — Cross-Cutting Concerns

### D-1. Module Integration

**StorefrontCustomization ↔ StoreManagement:**
- `StorefrontTemplate` references `Store` via `@OneToOne` ✓
- `storefront_templates.store_id` has `ON DELETE CASCADE` ✓
- `publishStorefront()` uses `store.getStoreUrl()` correctly ✓
- Missing: cascade to `storefront_pages` → `base_components` when store is deleted (schema has cascades within the storefront module ✓)

**InventoryManagement ↔ ProductDomain:**
- `Inventory.productId` is a plain `@Column(Long)` — NOT a `@ManyToOne` JPA relationship ✗
- No `Product` entity exists to create a proper JPA FK
- Schema has `FK product_id → products(product_id) ON DELETE CASCADE` ✓ (DB-level only)
- No cascade cleanup through JPA when a product entity is deleted (no Product entity)

**InventoryManagement ↔ OrderManagement:**
- No `OrderManagement` module exists ✗
- Stock deduction cannot be inside the same `@Transactional` as order creation ✗
- Rollback on order-creation failure: N/A (Order module absent) ✗

**StorefrontCustomization ↔ PublicStorefront:**
- `GET /api/public/storefront/{storeUrl}` correctly calls cache-aside path ✓
- Response does NOT include complete `StorefrontDocument` (no components, decorators, or design blob) ✗
- Returns `StorefrontTemplateResponse` with theme + page list only — insufficient for frontend to render the storefront

---

### D-2. Missing `application.properties` Keys

| Key | Present | Notes |
|-----|---------|-------|
| `spring.data.redis.host` | ✓ | `localhost` |
| `spring.data.redis.port` | ✓ | `6379` |
| `spring.rabbitmq.host` | ✗ MISSING | No RabbitMQ at all |
| `minio.endpoint` | ✗ MISSING | No MinIO / file upload |
| `minio.access-key` | ✗ MISSING | — |
| `minio.secret-key` | ✗ MISSING | — |
| `minio.bucket` | ✗ MISSING | — |
| `anthropic.api-key` | ✗ MISSING | No AI module |
| `jwt.secret` | ✓ | Present (plain text) |
| `jwt.expiry` | ✓ | As `jwt.expiration-ms=86400000` |
| `storefront.cache.ttl-minutes` | ✗ MISMATCH | Implemented as `storefront.cache.ttl-seconds` |
| `inventory.low-stock-threshold` | ✗ MISSING | Hardcoded in entity |
| `app.base-url` | ✓ | `http://localhost:8080` |
| `spring.datasource.password` | ✓ (⚠ EXPOSED) | Plain text production password in committed file |
| `spring.mail.password` | ✓ (⚠ EXPOSED) | `0000` — likely placeholder but committed |

---

## Overall Fix Priority

### P0 — Must fix before any frontend integration
1. **CORS configuration** — frontend cannot call any endpoint without this
2. **`/api/v1` base URL prefix** — all frontend routing is wrong
3. **Login response shape** — must return `accessToken`, `refreshToken`, `user` object
4. **Refresh token endpoint** — required for session management
5. **Role assignment bug in register()** — merchants cannot register correctly
6. **`ApiResponse<T>` wrapper** — all endpoints return unwrapped responses
7. **`ErrorResponse` add `code` and `details` fields**

### P1 — Fix before first demo
1. **Activation/reset tokens to database** — server restart kills all pending activations
2. **Token expiry** — password reset tokens never expire
3. **Default currency EGP** (not USD)
4. **Schema sync** — `users` table: fix `role_id` vs `role` mismatch, add `is_active`
5. **StorefrontCustomization: implement missing 17 endpoints** (pages, components, decorators, media)
6. **Inventory audit log entity + table** (`inventory_transactions`)
7. **Inventory: add `storeId` field and `updated_at`**
8. **`inventory_transactions` schema table**
9. **Low stock threshold configurable via `application.properties`**
10. **RabbitMQ integration** (replace SSE broadcast for stock alerts)

### P2 — Fix before production
1. **Secrets management** — remove plain text credentials from `application.properties`
2. **Categories module** (4 endpoints)
3. **Products module** (9 endpoints)
4. **Orders module** (7 endpoints)
5. **Analytics module** (7 endpoints)
6. **StorefrontCustomization JSONB redesign** — migrate to `storefronts`/`store_designs`/JSONB architecture per spec
7. **`StorefrontDocument` for public endpoint** — include full component tree
8. **N+1 fix in `getMyStores()`**
9. **Redis try/catch for connection failures** in cache-aside methods
10. **Inventory `@ManyToOne` Product relationship** (proper JPA FK)
11. **Rename `InventoryMangement` package to `InventoryManagement`**
12. **Consolidate duplicate `RedisConfig` beans**

### P3 — Nice to have
1. AI Assistant module (2 endpoints)
2. Payment Config module (4 endpoints)
3. Shipping module (3 endpoints)
4. Notifications module (3 endpoints)
5. File Upload / MinIO module (3 endpoints)
6. Settings granular sub-endpoints (10 spec endpoints vs 1 unified)
7. Store slug lookup endpoint (`GET /stores/slug/:slug`)
8. Store onboarding step endpoint

---

## Module Completion Summary

| Module | Spec Endpoints | Implemented | % Complete | Critical Gaps |
|--------|---------------|-------------|------------|---------------|
| Auth (Merchant) | 7 | 5 (wrong paths, missing refresh+me) | 45% | No refresh token; login returns raw string; wrong paths |
| Auth (Customer) | 7 | 0 | 0% | Entirely missing; no customer auth separation |
| Store Management | 11 | 7 (wrong paths/methods) | 45% | No slug lookup; wrong HTTP methods; no brand/onboarding |
| Categories | 4 | 0 | 0% | Entire module absent |
| Products | 9 | 0 | 0% | Entire module absent; no entity |
| Orders | 7 | 0 | 0% | Entire module absent; no entity |
| Analytics | 7 | 0 | 0% | Entire module absent |
| AI Assistant | 2 | 0 | 0% | Entire module absent |
| Payment Config | 4 | 0 | 0% | Entire module absent |
| Shipping | 3 | 0 | 0% | Entire module absent |
| Notifications | 3 | 0 | 0% | Entire module absent; no entity |
| Settings | 10 | 1 unified (wrong design) | 10% | Granular sub-endpoints missing |
| File Upload | 3 | 0 | 0% | No MinIO; entire module absent |
| Public Storefront | 6 | 1 | 17% | Only top-level GET; catalog endpoints absent |
| StorefrontCustomization | 23 | 6 | 26% | 17 endpoints missing; wrong JSONB architecture; missing 4 entities/tables |
| InventoryManagement | 4+ | 0 spec-correct (5 non-spec) | 0% spec | Wrong paths/methods; no audit log; no RabbitMQ; no store-scoped endpoints |
| **TOTAL** | **110** | **~20** | **~18%** | Core registration/auth broken; CORS blocked; no API versioning; most modules absent |
