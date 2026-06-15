# FlowMerce — IMPLEMENTATION_PLAN.md (Execution Roadmap)

> **Context.** A full repo audit produced `AUDIT_REPORT.md` (Spring Boot backend `/api/v1` + Next.js App Router frontend). Verdict: ~60% functional end-to-end; 5 of 7 core flows broken; 5 P0 security issues; 55+ contract mismatches; a `lib/local-store/*` localStorage mock layer shadowing the backend. This document converts **every** audit finding into dependency-ordered, traceable tasks. It does **not** re-audit. Every task cites exact files/symbols (verified against source) traceable to the audit.
>
> **This plan file is the source for `IMPLEMENTATION_PLAN.md`.** On approval I will write this content to `C:\Users\Bahaa\OneDrive\Desktop\FlowMerce-master\IMPLEMENTATION_PLAN.md`.
>
> **Effort legend:** XS ≤1h · S ≤½d · M 1–2d · L 3–5d · XL >1wk. **Risk:** 🔴 high · 🟠 med · 🟢 low.

---

## Phase 1 — Master Issue List (every finding, with ID)

IDs: `SEC` security · `INT` incorrect integration/wiring · `CON` contract · `DOC` docker/env · `DC` dead code · `FEAT` missing feature. Severity from audit. "Loc" abbreviates audit file:line refs.

### Security (audit §8) — SEC
| ID | Sev | Description | Source loc | Impact |
|---|---|---|---|---|
| SEC-1 | P0 | Hardcoded `jwt.secret`, SMTP password, DB password | `application.properties:12,21,35` | Anyone with repo forges ADMIN tokens; mailbox + DB compromise |
| SEC-2 | P0 | Live `GROQ_API_KEY` committed | `frontend/.env.local:4` → `app/api/ai/chat/route.ts:13` | Key theft; quota abuse |
| SEC-3 | P0 | RBAC bypass: any non-empty `localStorage['authToken']` passes; role block skipped when role null | `ProtectedRoute.tsx:88-94,101-113` | `/admin` & `/dashboard` UI reachable by forged token |
| SEC-4 | P0 | AI proxy unauthenticated, unthrottled, attacker-controlled system prompt | `app/api/ai/chat/route.ts:5-45` | Cost abuse, prompt injection |
| SEC-5 | P0 | SMTP app password committed (subset of SEC-1) | `application.properties:35` | Mailbox takeover |
| SEC-6 | P1 | JWT + refresh token + plaintext password in localStorage | `auth-store.tsx:64-69`, `lib/local-store/auth-local.ts:40,68` | XSS token exfiltration |
| SEC-7 | P1 | Default admin seed `ChangeMe!2026`, auto-activated | `application.properties:25-26`, `AdminSeeder.java` (`run`) | Default-cred admin login |
| SEC-8 | P1 | No refresh-token rotation | `auth-store.tsx:102-125` (`scheduleRefresh`) | Stolen refresh token renews forever |
| SEC-9 | P2 | CORS `localhost:[*]` + credentials | `SecurityConfig.java` (`corsConfigurationSource`) | Broad origin trust |
| SEC-10 | P2 | JWT role trusted full 24h, no per-request recheck | `JwtAuthFilter.java` (`doFilterInternal`) | Stale privilege after role change |
| SEC-11 | P2 | Upload serves user-derived extension inline → stored XSS (SVG/HTML) | `UploadController.java` (`upload`,`serve`) | Stored XSS |
| SEC-12 | P2 | Payment webhook/callback signature verification absent | `PaymentController.java` (no webhook handler) | Forged payment confirmations |
| SEC-13 | P3 | Public `/stream/stock` leaks inventory; unauth long-lived conn | `SseController.java` (`streamStock`) | Info leak, resource exhaustion |
| SEC-14 | P3 | `lib/api.ts` uses `NEXT_PUBLIC_API_KEY` as bearer, default port 3001 | `lib/api.ts:6-7,34-36` | Latent wrong-auth (also DC-3) |

### Incorrect Integrations / Wiring (audit §4) — INT
| ID | Sev | Description | Source loc |
|---|---|---|---|
| INT-1 | P0 | Product search ignores `storeId` → cross-store leakage | `ProductService.java:142` (`searchProducts(String keyword)`) |
| INT-2 | P0 | Stock update discarded on product edit (no field on DTO) | `ProductsPage.tsx:462-472`, `ProductDTOs.UpdateProductRequest` (no `quantity`) |
| INT-3 | P0 | Storefront shows no product images | `CatalogDTOs.ProductResponse` (no `images`) vs `StoreProvider.tsx:57` |
| INT-5 | P0 | `verifyMerchant` passes `userId` as `{merchantId}` | `app/admin/merchants/page.tsx:55` (`adminService.verifyMerchant(m.userId)`) |
| INT-6 | P0 | `deleteMerchant` passes `userId` as `{merchantId}` | `app/admin/merchants/page.tsx:65` |
| INT-7 | P0 | change-password sends `oldPassword`; backend wants `currentPassword` | `settings/page.tsx:102` vs `ChangePasswordRequest.currentPassword` |
| INT-8 | P0/P1 | `AdminMerchantResponse` declares phone/isActive/storeCount/createdAt backend never returns | `admin.types.ts:30-37` vs `MerchantDTOs.MerchantResponse` |
| INT-9 | P0 | Review ownership `string === number` always false | `ReviewCard.tsx:24`, `ReviewList.tsx:68` |
| INT-10 | P0 | Admin categories use `useMerchantAuth` for ADMIN endpoints → 403 | `app/admin/categories/page.tsx:17,119` |
| INT-11 | P0 | Checkout: FE sends `items`+auth but `CheckoutRequest` has no items field → backend uses (possibly empty) session cart | `checkout/page.tsx:68-82` vs `CartDTOs.CheckoutRequest` |
| INT-12 | P0 | `getOrderById` called without auth header → 401 | `account/orders/[id]/page.tsx:56` |
| INT-13 | P0 | `cancelOrder` in detail page without auth → 401 | `account/orders/[id]/page.tsx:110` |
| INT-14 | P0 | `getReorderItems` → `POST /orders/{id}/reorder` does not exist → 404 | `order.service.ts` (`getReorderItems`), `[id]/page.tsx:124` |
| INT-15 | P0 | Payment status field mismatch (`paymentStatus` vs `status`) breaks poll/filter/refund | `payment/result/page.tsx:63`, `PaymentsPage.tsx:184,244,254` vs `PaymentDTOs.PaymentResponse.status` |
| INT-16 | P0 | `confirmPayment` without auth → 401/403 | `PaymentsPage.tsx:188` |
| INT-17 | P0 | `refundPayment` without auth → 401/403 | `PaymentsPage.tsx:197` |
| INT-18 | P0 | `getStorePayments` → `GET /payments/store/{storeId}` does not exist → 404 | `payment.service.ts` (`getStorePayments`), `PaymentsPage.tsx:177` |
| INT-19 | P0 | Inventory strategy enum `RESERVED_STOCK`/`FLASH_SALE` vs backend `RESERVED`/`FLASH` | `inventory.types.ts:10`, `InventoryPage.tsx:61-65` |
| INT-20 | P0 | `InventoryResponse` missing `isLowStock`/`isOutOfStock` → badges always "In Stock" | `InventoryPage.tsx:52` vs `InventoryResponse` |
| INT-21 | P0 | History drawer reads wrong field names → all undefined | `InventoryPage.tsx:302-325` vs `InventoryTransaction` |
| INT-22 | P0 | RabbitMQ consumers never push SSE | `OrderNotificationConsumer.handleOrderEvent`, `PaymentNotificationConsumer.handlePaymentEvent` (call `createForUser`, never `SseService.sendToUser`) |
| INT-23 | P0 | Public storefront discards pages/components tree | `useStore.ts` (`useStoreData`, ~135-164), `store/[slug]/page.tsx` (`StoreHome` hardcoded) |
| INT-24 | P0 | Admin stores page renders 4 undefined fields | `admin/stores/page.tsx:48-49,108-110` vs `StoreDTOs.StoreResponse` |
| INT-25 | P1 | Store settings saved only to localStorage | `SettingsPage.tsx:865-925` vs `storeService.getSettings/updateSettings` |
| INT-26 | P1 | Login/signup raw `fetch` bypasses http-client interceptors | `app/login/page.tsx:45`, `app/signup/page.tsx:40` |
| INT-27 | P1 | Customer signup allows 6-char password (backend min 8) | `store/[slug]/signup/page.tsx:41` |
| INT-28 | P2 | change-password client min 6 vs backend min 8 | `settings/page.tsx:97` |
| INT-29 | P1 | Cart subtotal uses `product.price` not server `priceAtAdd` | `cart/page.tsx:56` |
| INT-30 | P1 | Wishlist "Add to Cart" uses local state, not `moveToCart` | `wishlist/page.tsx:128` |
| INT-31 | P1 | Cart PUT/DELETE skipped on missing `cartItemId` (race) | `StoreProvider.tsx:192,205` |
| INT-32 | P1 | Spring `Page.number` read as `currentPage` → broken pagination | `admin/orders/page.tsx:46` |
| INT-33 | P1 | `canCancel=true` for CONFIRMED (backend allows only PENDING) | `order.service.ts:74` |
| INT-34 | P1 | Analytics/customers/dashboard from localStorage mock | `lib/local-store/apply-checkout.ts`, `analytics-from-orders.ts`, `customers-from-orders.ts`, `dashboard-metrics.ts` |
| INT-35 | P1 | Customer `useWallet` omits auth headers → 401 | `useWallet.ts` (`useWallet`) |
| INT-36 | P1 | Rating filter uses hardcoded `mockRating:0` | `search.service.ts:158-167` |
| INT-37 | P1 | `StepCatalog` uploads images but never persists products | `StepCatalog.tsx:30-58` |
| INT-38 | P1 | Upload may send empty auth header | `SettingsPage.tsx:119` |
| INT-39 | P1 | `updateTheme` annotated `@Transactional(readOnly=true)` but writes | `StorefrontCustomizationService.updateTheme` |
| INT-40 | P1 | Product search may require MERCHANT auth (not under `/public/`) | `storefront.service.ts:101-105`, `search.service.ts:135` |
| INT-42 | P2 | Confirmation page never fetches real order | `confirmation/page.tsx:19-22` |
| INT-43 | P2 | Merchant drawer hardcodes shipping=50/tax=14% | `OrdersPage.tsx:143-149` |
| INT-44 | P2 | Wishlist add/remove typed `void` — loses real `wishlistId` | `wishlist.service.ts` (`addToWishlist`,`removeFromWishlist`) |
| INT-45 | P2 | `CheckoutRequest` sends `notes`, missing billingAddress/idempotencyKey | `cart.types.ts:66-70` |
| INT-46 | P2 | `upload.service` bypasses http-client | `upload.service.ts:19-36` |
| INT-47 | P2 | `useProductSearch` idles when categories empty | `useProductSearch.ts:124-127` |

### Contracts (audit §5) — CON (55+ mismatches grouped)
| ID | Sev | Group | Representative loc | Fix vector |
|---|---|---|---|---|
| CON-1 | P1 | Date serialization (`LocalDateTime` → array vs ISO string) affects notifications/orders/users/payments | `Notification.createdAt`, `OrderDTOs`, `UserResponse.createdAt` | Global Jackson `WRITE_DATES_AS_TIMESTAMPS=false` + `JavaTimeModule` |
| CON-2 | P1 | Response envelope: `details` vs `fieldErrors`; phantom `timestamp` | `ErrorResponse.java:24`, `ApiResponse.java:6` vs `api.types.ts:16,55` | Standardize envelope + FE types |
| CON-3 | P0 | Payment `status` vs `paymentStatus`; missing currency/gateway/failureReason/paidAt; FE extra `updatedAt` | `PaymentDTOs.PaymentResponse` vs `payment.types.ts:74-87` | Align (ties INT-15) |
| CON-4 | P0 | Inventory: missing flags/productName/etc; history field renames; strategy enum | `InventoryResponse`, `InventoryTransaction` vs `inventory.types.ts:10,23-51` | Align (ties INT-19/20/21) |
| CON-5 | P0 | Admin Merchant: `merchantId` + 4 phantom fields | `MerchantDTOs.MerchantResponse` vs `admin.types.ts:28-37` | Align (ties INT-8/5/6) |
| CON-6 | P0 | Admin Store: merchantName/email/productCount/orderCount absent | `StoreDTOs.StoreResponse` vs `admin.types.ts:49-52` | Enrich backend DTO (ties INT-24) |
| CON-7 | P0 | Public catalog: `images` absent, `productId` Long vs number | `CatalogDTOs.ProductResponse` vs `storefront.service.ts:55,63` | Add images (ties INT-3) |
| CON-8 | P1 | Order: rich fields (shipment/timeline/paymentSummary), `shippingAddress` String vs object, id `ORD-N` vs Integer, status case (5 UPPER vs 7 lower), missing paymentMethod/items | `OrderDTOs` vs `order.types.ts:19-26,93-153,274-289` | Enrich OrderResponse + FE mapping |
| CON-9 | P1 | Wallet: `isActive`, tx type enum (2 vs 6), referenceId/walletId/referenceType | `PaymentDTOs` wallet, `WalletTransaction` vs `wallet.types.ts:14,24,35-46` | Align |
| CON-10 | P1 | Notification type enum (8 backend vs misaligned), read-all response `String` vs `void` | `Notification.java:47-56`, `NotificationController:57` vs `notification.types.ts:10-23` | Align enum + types |
| CON-11 | P1 | Auth: `id`/`userId`, `isActive` nullable, role enum, `expiresIn` unit | `AuthResponse.java`, `UserResponse.java` vs `auth.types.ts:12,43,111,123` | Align + confirm ms/s |
| CON-12 | P1 | Store: `logo` vs `logoUrl`, missing `brandName`, `paymentMethods` JSON string vs array, settings shape, storefront status `PAUSED` vs `UNPUBLISHED` | `StoreDTOs`, `StorefrontDTOs` vs `store.types.ts:55-128`, `storefront.types.ts:68` | Align |
| CON-13 | P2 | Cart/checkout: response cartId/customerId/storeId absent; createdAt/availableStock/addedAt absent; idempotencyKey/billingAddress | `CartDTOs`, `CheckoutService:162-164` vs `cart.types.ts` | Align (ties INT-45) |
| CON-14 | P2 | Reviews: `customerId` Integer vs string; RatingSummary absent; comment min 10 vs unconstrained | `ReviewDTOs` vs `review.types.ts:7,27` | Align (ties INT-9) |
| CON-15 | P2 | Product/search: `basePrice` BigDecimal vs Money; `rating` never null vs nullable; `mockRating:0` | `ProductDTOs:48,55` vs `product.types.ts:28,41`, `search.types.ts:102` | Align (ties INT-36) |

### Docker / Env (audit §9) — DOC
| ID | Sev | Description | Source loc |
|---|---|---|---|
| DOC-1 | P0 | SMTP password + Groq key committed (= SEC-1/SEC-2) | `application.properties:35`, `.env.local:4` |
| DOC-2 | P1 | No Dockerfile for backend or frontend; compose only infra | `Back end/compose.yaml`, missing Dockerfiles |
| DOC-3 | P1 | JDBC URL hardcoded `localhost:5432` (no env override) | `application.properties:10` |
| DOC-4 | P1 | Postgres has no named volume → data lost on `compose down` | `compose.yaml:2-9` |
| DOC-5 | P1 | No volume for uploads (`app.upload.dir=uploads`) | `compose.yaml`, `UploadController` (`uploadDir`) |
| DOC-6 | P2 | No healthchecks/`depends_on`; `NEXT_PUBLIC_API_URL` hardcoded; CORS not driven by `app.frontend-url` | `compose.yaml`, `.env`, `SecurityConfig` |
| DOC-7 | P3 | `latest` image tags; `next.config.mjs:10-14` lacks localhost image host | `compose.yaml`, `next.config.mjs` |

### Dead Code (audit §10) — DC
| ID | Sev | Description | Source loc |
|---|---|---|---|
| DC-1 | P1 | `paymentService.getStorePayments` → non-existent route (= INT-18) | `payment.service.ts`, `PaymentsPage.tsx:177` |
| DC-2 | P1 | `orderService.getReorderItems` → non-existent route (= INT-14) | `order.service.ts`, `[id]/page.tsx:124` |
| DC-3 | P1 | `lib/api.ts` entirely dead/unimported, wrong port 3001 | `lib/api.ts:1-60` |
| DC-4 | P1 | `UnifiedAuthController` duplicate auth paths, never called | `UnifiedAuthController.java:1-33` |
| DC-5 | P2 | Superseded local-store modules | `lib/local-store/{analytics-from-orders,customers-from-orders,dashboard-metrics,settings-storage,settings-types,auth-local,catalog-sync,apply-checkout,orders,store,hooks}.ts` |
| DC-6 | P2 | Unused service methods | `inventory.service.ts:31-60`, `product.service.ts` (getActiveProducts/getById/search/deleteMedia), `userService.getMyProfile/deleteAccount`, `storeService.updateOnboardingStep/getSettings/updateSettings` |
| DC-7 | P3 | Deprecated/dupe methods; `/stream/stock`; 3 overlapping `/me` | `storefrontService.updateColors/updateDecorator/searchProducts`, `merchantService.deleteMyAccount`, `categoryService.getById`, `cartService.previewCheckout` |

### Missing Features (audit §3) — FEAT (45+; grouped to BE/FE completion)
Tracked individually in Phase 7 (backend) and Phase 8 (frontend); each audit §3 row is assigned there. Notable: SSE subscribers (FEAT-SSE), public page renderer (FEAT-RENDER, XL), server-side search (FEAT-SEARCH, XL), merchant analytics from backend (FEAT-ANALYTICS, XL), account-deletion UI, merchant profile UI, store-category management, inventory reserve/release in checkout, invoice display, decorator-edit UI, metaDescription field, global unread-count bell, single-notification dismiss.

---

## Phase 2 — Dependency Graph (chains)

```
SEC-1 (rotate+externalize secrets) ──► SEC-6/SEC-8 (JWT cookie + rotation) ──► SEC-3 (RBAC guard rewrite)
CON-1 (global Jackson date fix) ──► CON-3,8,9,10,11,12 (all date-bearing DTO aligns) ──► every FE consumer
CON-2 (envelope) ──► FE error handling everywhere (http-client.ts)
CON-3 (payment status) ──► INT-15 ──► Payment flow (D)
CON-4 (inventory DTO/enum) ──► INT-19/20/21 ──► Inventory display (G)
CON-5 (merchant DTO) ──► INT-5/6/8 ──► Admin merchant ops
CON-6 (admin store DTO) ──► INT-24 ──► Admin stores page
CON-7 (catalog images) ──► INT-3 ──► Storefront product display
BE: add POST /orders/{id}/reorder ──► INT-14 (FE wire) ; remove phantom if descoped (DC-2)
BE: add GET /payments/store/{storeId} ──► INT-18 (FE wire) ; (DC-1)
BE: searchProducts(storeId) ──► INT-1 + INT-36/40 ; FEAT-SEARCH (server-side) builds on this
BE: SseService.sendToUser in consumers (INT-22) ──► FEAT-SSE (FE subscribers) ──► Notification flow (F)
BE: CheckoutRequest.items OR cart reconcile (INT-11) ──► Checkout flow (C) ──► confirmation (INT-42)
INT-12/13/16/17/35 (auth headers) ── independent, parallel after CON aligns
Storefront public renderer (FEAT-RENDER) ──► INT-23 (consume pages/components) ──► Storefront flow (E)
Backend integration complete (Phases 2–3) ──► DC-5 mock-layer removal (INT-34, signup mock, dashboard/analytics/customers) ──► Phase 4
Dockerfiles (DOC-2) ──► DOC-3/4/5/6 (compose services/volumes/env) ──► CI/CD
```

**Hard ordering rules**
1. **Secrets (SEC-1/2) before everything** — they are independently catastrophic and gate auth refactor.
2. **CON-1 Jackson fix before any DTO/type alignment** — one change resolves all date mismatches; doing it after wastes per-field effort.
3. **Contract alignment (Phase 1) before frontend wiring (Phase 3)** — wiring to a moving contract causes rework.
4. **Backend endpoints (Phase 2) before their FE consumers** — avoid 404/phantom calls.
5. **Mock-layer removal (Phase 4) last** — only after the backend paths it replaces are proven working.

---

## Phase 3 — Execution Phases (sprint plan)

| Phase | Goal | Issues | Primary files | Risk | Outcome |
|---|---|---|---|---|---|
| **P0 — Security Emergency** | Stop catastrophic exposure | SEC-1..8, DOC-1, CON-1, CON-2 | `application.properties`, `.env*`, `ProtectedRoute.tsx`, `app/api/ai/chat/route.ts`, `auth-store.tsx`, `AdminSeeder.java`, `JacksonConfig`(new) | 🔴 | Secrets rotated/externalized; RBAC enforced; AI proxy gated; dates/envelope standardized |
| **P1 — Contract Alignment** | Single source of truth for DTOs↔types | CON-3..15, INT-7/8/15/19/20/21/32/33/44 | `*/dto/*.java`, `frontend/types/*.ts`, `lib/api/http-client.ts` | 🟠 | All consumers compile against correct shapes |
| **P2 — Backend Missing/Broken Endpoints** | Make phantom/orphan routes real | INT-1/22/39/40, BE-COMP set (reorder, store-payments, stock-update, search-storeId, SSE push) | `OrderController`/`Service`, `PaymentController`/`Service`, `ProductService`, `*NotificationConsumer`, `StorefrontCustomizationService`, `CatalogDTOs`, `ProductDTOs`, `StoreDTOs`, `MerchantDTOs` | 🟠 | No 404s; backend feature-complete for flows |
| **P3 — Frontend Integration Repairs** | Wire UI to real backend | INT-3/5/6/9/10/11/12/13/14/16/17/18/23/24/25/26/27/29/30/31/35/36/37/38/42/43/45/46/47 | admin pages, payments/inventory/orders pages, `StoreProvider.tsx`, `useStore.ts`, `store/[slug]/page.tsx`, checkout/confirmation, wishlist, settings | 🟠 | 5 broken flows (C/D/E/F/G) restored |
| **P4 — Mock Layer Removal** | Delete dual source of truth | INT-34, DC-5, signup mock (SEC-6 cleanup) | `lib/local-store/*`, `app/page.tsx`, dashboard/analytics/customers, `MerchantBackendSync` | 🔴 | One source of truth = backend |
| **P5 — Infrastructure** | Containerize + persist | DOC-2..7, SEC-9/11/13 | new `Dockerfile`s, `compose.yaml`, `SecurityConfig`, `UploadController`, `SseController`, `next.config.mjs` | 🟢 | Reproducible deploy; data/uploads persist |
| **P6 — Optimization & Cleanup** | Robustness + debt | SEC-10/12/14, DC-3/4/6/7, FEAT-SEARCH/ANALYTICS/RENDER polish, state-lib adoption | hooks/*, `lib/api.ts`(del), `UnifiedAuthController`(del), TanStack Query | 🟢 | Maintainable, performant |

---

## Phase 4 — Task Breakdown (per issue)

> Detailed for P0/P1; grouped-but-itemized for P2/P3. Each names exact symbols.

### P0 tasks

**TASK SEC-1 — Rotate & externalize secrets**
*Why:* Repo-readable JWT signing key lets anyone forge ADMIN tokens; live Gmail/DB creds.
*Backend:* `application.properties` — replace inline values at `:12` (`jwt.secret`), `:21` (DB password), `:35` (`spring.mail.password`) with `${JWT_SECRET}`, `${DB_PASSWORD}`, `${MAIL_PASSWORD}` **with no inline defaults for secrets**. Add `.env`/secret-store entries. Rotate the actual Gmail app password, DB password, and generate a new ≥256-bit `JWT_SECRET`.
*Frontend:* none.
*Validation:* App boots with env vars set; boot fails if `JWT_SECRET` unset; old Gmail password rejected by SMTP.
*Effort:* S · Risk 🔴

**TASK SEC-2 — Rotate Groq key + remove from repo**
*Why:* Live key in synced OneDrive folder.
*Frontend:* `app/api/ai/chat/route.ts:13` keeps `process.env.GROQ_API_KEY`; remove value from `.env.local`, rotate at Groq console, store in host secret store; add `.env.local` to `.gitignore` (verify). 
*Validation:* AI chat works with env var; key absent from tracked files (`git grep gsk_`).
*Effort:* XS · Risk 🔴

**TASK SEC-3 — Rewrite ProtectedRoute guard**
*Why:* Forgeable legacy token grants admin UI.
*Frontend:* `components/auth/ProtectedRoute.tsx` — remove legacy `localStorage['authToken']` fallback (`:88-94`); when `requiredRole` is set and `auth.role` is null/mismatch, **deny + redirect** (fix `:101-113`). Gate solely on verified session from `useMerchantAuth()`.
*Validation:* Forged `authToken` no longer renders `/admin`; null-role user blocked from role-gated routes.
*Effort:* S · Risk 🟠

**TASK SEC-4 — Harden AI proxy**
*Frontend:* `app/api/ai/chat/route.ts` (`POST`) — require authenticated session; add rate limit (per-IP/user); server-define the `system` prompt (ignore client-supplied); add origin/CSRF check.
*Validation:* Unauthenticated POST → 401; burst → 429; client `system` ignored.
*Effort:* M · Risk 🟠

**TASK SEC-6+8 — JWT to httpOnly cookies + refresh rotation** *(P1, scheduled in P0 wave for auth coherence)*
*Backend:* `AuthController`/auth service — set access+refresh as `HttpOnly; Secure; SameSite` cookies; implement single-use rotating refresh tokens with server-side revocation (session table already exists per `JwtAuthFilter` `sessionRepository`). Shorten `jwt.expiration-ms`.
*Frontend:* `store/auth-store.tsx` — `writeSession()` (`:64-69`) stop persisting JWT/refresh/password to localStorage; `scheduleRefresh()` (`:102-125`) call cookie-based refresh; delete `lib/local-store/auth-local.ts` usage.
*Validation:* Token not in localStorage; refresh rotates; reused refresh token rejected.
*Effort:* L · Risk 🔴

**TASK SEC-7 — Admin seeder hardening**
*Backend:* `AdminSeeder.run()` — fail startup (or `@Profile("!prod")`) if password equals default `ChangeMe!2026` in prod; force change on first login.
*Effort:* S · Risk 🟢

**TASK CON-1 — Global Jackson date config** *(unblocks all date mismatches)*
*Backend:* add `application.properties` `spring.jackson.serialization.write-dates-as-timestamps=false` + register `JavaTimeModule` (new `JacksonConfig` if needed). Resolves CON-1 and the date facets of CON-8/9/10/11.
*Validation:* `createdAt`/`paidAt`/etc. serialize as ISO-8601 strings; FE `new Date()` parses.
*Effort:* XS · Risk 🟢

**TASK CON-2 — Standardize response envelope**
*Backend:* `ErrorResponse.java` — rename `details`→`fieldErrors` (or add alias); drop phantom `timestamp` from success or add it consistently. *Frontend:* `types/api.types.ts:16,55` align; `lib/api/http-client.ts` error parsing reads `fieldErrors`.
*Effort:* S · Risk 🟠

**TASK INT-1 — Search storeId scoping (backend)**
*Backend:* `ProductService.searchProducts(String keyword)` (`:142`) → add `Integer storeId` param + repository query filter `storeId AND isActive AND keyword`. Update `ProductController` search mapping + callers.
*Validation:* Search in store A never returns store B products.
*Effort:* S · Risk 🟠

**TASK INT-2 — Product stock update path**
*Backend:* add `quantity` to `ProductDTOs.UpdateProductRequest` and handle in `ProductService.updateProduct(...)` (or expose inventory adjust). *Frontend:* `ProductsPage.tsx:462-472` send the field.
*Effort:* M · Risk 🟠

**TASK INT-3 + CON-7 — Storefront images**
*Backend:* `CatalogDTOs.ProductResponse` add `List<String> images` (or `media`); populate from `ProductMedia` join in the public catalog service. *Frontend:* `StoreProvider.tsx:57` consume images; product cards render them.
*Effort:* M · Risk 🟠

**TASK INT-5/6/8 + CON-5 — Admin merchant ops**
*Backend:* `MerchantDTOs.MerchantResponse` already has `merchantId`,`userId`; add phone/isActive/storeCount/createdAt if UI needs them (else trim FE type). *Frontend:* `app/admin/merchants/page.tsx:55,65` pass `m.merchantId`/`confirmDelete.merchantId` (not `userId`); `admin.types.ts:30-37` align to real fields.
*Effort:* S · Risk 🟢

**TASK INT-7 — change-password field**
*Frontend:* `settings/page.tsx:102` rename request field `oldPassword`→`currentPassword`; align `auth.types.ts:86`. (Backend `ChangePasswordRequest.currentPassword` confirmed.)
*Effort:* XS · Risk 🟢

**TASK INT-9 + CON-14 — Review ownership coercion**
*Frontend:* `ReviewCard.tsx:24`, `ReviewList.tsx:68` use `String(review.customerId) === String(currentCustomerId)`; set `review.types.ts:7` `customerId: number`.
*Effort:* XS · Risk 🟢

**TASK INT-10 — Admin categories ADMIN auth**
*Frontend:* `app/admin/categories/page.tsx:17` replace `useMerchantAuth()` with the admin/role-aware auth context for `POST/PUT/DELETE /categories`.
*Effort:* S · Risk 🟠

**TASK INT-11 + CON-13 — Checkout cart reconciliation**
*Why:* FE sends `items` but `CheckoutRequest` has no items field → backend reads session cart (empty for guest-then-login).
*Backend:* add `items[]` to `CartDTOs.CheckoutRequest` and honor in `CheckoutService`/`OrderController.placeOrder`, OR have FE sync local cart to backend cart before placing. Add response `cartId/customerId/storeId`.
*Frontend:* `checkout/page.tsx:68-82` adopt chosen approach.
*Effort:* L · Risk 🔴

**TASK INT-12/13/16/17/35 — Add missing auth headers**
*Frontend:* pass `auth.getAuthHeader()` in `account/orders/[id]/page.tsx:56,110` (getOrderById, cancelOrder); `PaymentsPage.tsx:188,197` (confirm/refund); `useWallet.ts` (`useWallet`).
*Validation:* No 401/403 on these calls when logged in.
*Effort:* S each (batch) · Risk 🟢

**TASK INT-14 / DC-2 — Reorder endpoint**
*Decision:* implement `POST /orders/{orderId}/reorder` in `OrderController` + `OrderService.reorder(...)` (recreate cart from order lines), OR remove `getReorderItems` + UI button. **Recommend implement** (low effort, real value).
*Frontend:* `order.service.ts` (`getReorderItems`) → call real route; `[id]/page.tsx:124` wire.
*Effort:* M (impl) / XS (remove) · Risk 🟠

**TASK INT-15 + CON-3 — Payment status field**
*Frontend:* `payment/result/page.tsx:63`, `PaymentsPage.tsx:184,244,254` read `status` not `paymentStatus`; `payment.types.ts:74-87` align (add currency/gateway/failureReason/paidAt; drop `updatedAt`). (Backend field confirmed `status`.)
*Effort:* S · Risk 🟠

**TASK INT-18 / DC-1 — Store payments endpoint**
*Backend:* add `GET /payments/store/{storeId}` to `PaymentController` + `PaymentServiceImpl.getStorePayments(storeId, merchantEmail)` (MERCHANT auth). *Frontend:* `payment.service.ts` (`getStorePayments`) already calls it; `PaymentsPage.tsx:177` works once real.
*Effort:* M · Risk 🟠

**TASK INT-19/20/21 + CON-4 — Inventory contract**
*Backend:* `InventoryResponse` add `isLowStock/isOutOfStock/productName/productImage/defectiveQuantity/lowStockThreshold/lastUpdated`; expose strategy bean names. *Frontend:* `inventory.types.ts:10` use backend enum values (`RESERVED`/`FLASH`); `InventoryPage.tsx:52,302-325` read correct field names; map `stockStatus`→flags.
*Effort:* M · Risk 🟠

**TASK INT-22 — SSE push from consumers**
*Backend:* `OrderNotificationConsumer.handleOrderEvent` and `PaymentNotificationConsumer.handlePaymentEvent` — after `notificationService.createForUser(...)`, call `sseService.sendToUser(email, eventType, payload)` (use `SseService.sendOrderUpdate`/`sendAccountActivity`).
*Validation:* Placing an order pushes a live SSE event to the buyer.
*Effort:* S · Risk 🟢

**TASK INT-23 + FEAT-RENDER — Public storefront renderer**
*Backend:* `PublicStorefrontController` returns pages/components (verify shape). *Frontend:* `useStore.ts` (`useStoreData`) stop discarding pages/components; build a dynamic renderer in `store/[slug]/page.tsx` (`StoreHome`) that maps backend components → React. (XL; can ship behind flag.)
*Effort:* XL · Risk 🔴

**TASK INT-24 + CON-6 — Admin stores DTO**
*Backend:* `StoreDTOs.StoreResponse`/admin variant add `merchantName/merchantEmail/productCount/orderCount`. *Frontend:* `admin/stores/page.tsx:48-49,108-110` render real fields; `admin.types.ts:49-52` align.
*Effort:* M · Risk 🟢

**TASK INT-39 — updateTheme transaction**
*Backend:* `StorefrontCustomizationService.updateTheme` remove `@Transactional(readOnly=true)` → `@Transactional`.
*Effort:* XS · Risk 🟢

**TASK INT-40 — Public search auth**
*Backend:* ensure `/stores/{storeId}/products/search` is whitelisted public in `SecurityConfig`.
*Effort:* XS · Risk 🟢

### P1/P2/P3 tasks (itemized, grouped)

| ID | Task | Backend | Frontend | Effort |
|---|---|---|---|---|
| INT-25 | Settings → backend | `storeService.getSettings/updateSettings` (exist) | `SettingsPage.tsx:865-925` call them not localStorage | S |
| INT-26 | Auth via httpClient | — | `app/login:45`, `app/signup:40` route through `authService`/http-client | S |
| INT-27/28 | Password min-8 | — | `store/[slug]/signup:41`, `settings/page.tsx:97` set min 8 | XS |
| INT-29 | Cart `priceAtAdd` | ensure DTO returns it | `cart/page.tsx:56` use it | S |
| INT-30/44 | Wishlist move-to-cart + types | — | `wishlist/page.tsx:128` call `wishlistService.moveToCart`; type returns `WishlistResponse`/`CartResponse` | S |
| INT-31 | Cart race | — | `StoreProvider.tsx:192,205` await POST / queue mutations | M |
| INT-32 | Page shape | — | `admin/orders/page.tsx:46` read `number` not `currentPage`; map Spring `Page` | S |
| INT-33 | canCancel PENDING-only | — | `order.service.ts:74` restrict | XS |
| INT-36 + CON-15 | Real rating | search returns real `rating` | `search.service.ts:158-167` map it; drop `mockRating` | S |
| INT-37 | StepCatalog persist | — | `StepCatalog.tsx:30-58` POST products on publish | M |
| INT-38 | Upload auth | — | `SettingsPage.tsx:119` ensure auth header | XS |
| INT-42 | Confirmation live fetch | — | `confirmation/page.tsx:19-22` call `getOrderById` | S |
| INT-43 | Real shipping/tax | order DTO carries them | `OrdersPage.tsx:143-149` read from DTO | S |
| INT-45/CON-13 | CheckoutRequest shape | add billingAddress/idempotencyKey | `cart.types.ts:66-70` align | S |
| INT-46 | upload via httpClient | — | `upload.service.ts:19-36` centralize | S |
| INT-47 | search hydration | — | `useProductSearch.ts:124-127` add hydration signal | S |
| CON-8/11/12 | Order/Auth/Store contracts | enrich `OrderDTOs`, `AuthResponse`, `StoreDTOs` | align `order.types.ts`, `auth.types.ts`, `store.types.ts` | M |
| CON-9/10 | Wallet/Notification enums | align `WalletTransaction`, `Notification` enums | `wallet.types.ts`, `notification.types.ts` | S |
| SEC-9 | CORS from config | `SecurityConfig.corsConfigurationSource` driven by `app.frontend-url` | — | S |
| SEC-10 | Per-request role recheck | `JwtAuthFilter.doFilterInternal` optional DB role check | — | M |
| SEC-11 | Upload XSS | `UploadController` extension allowlist + `Content-Disposition: attachment` | — | S |
| SEC-12 | Webhook signatures | `PaymentController` add verified webhook handler per gateway | — | L |
| SEC-13 | Stream/stock auth | `SseController.streamStock` require auth + scope to merchant | FE subscriber | S |

---

## Phase 5 — Security Remediation Plan (ordered)

1. **Secret rotation (SEC-1, SEC-2, SEC-5)** — generate new `JWT_SECRET` (≥256-bit), rotate Gmail app password, DB password, Groq key. Move all to env/secret store; remove inline defaults for secrets in `application.properties:12,21,35` and value in `.env.local:4`.
2. **Git history cleanup** — the secrets are committed. After rotation: run `git filter-repo` (or BFG) on the `frontend/.git` repo to purge `.env.local`; if the backend is tracked, purge `application.properties` secret history. **Decision needed:** history rewrite is destructive to shared clones — recommend only if repo is private/solo (it lives in OneDrive). At minimum, `.gitignore` `.env*` and treat rotated keys as the real mitigation.
3. **JWT hardening (SEC-6)** — httpOnly+Secure+SameSite cookies; remove localStorage persistence in `auth-store.tsx:64-69`; shorten TTL.
4. **Session hardening (SEC-8)** — single-use rotating refresh tokens + revocation via existing session table (`JwtAuthFilter.sessionRepository`).
5. **RBAC fix (SEC-3)** — `ProtectedRoute.tsx` remove legacy-token bypass; deny on missing role.
6. **AI proxy (SEC-4)** — auth + rate limit + server-side system prompt + origin check on `app/api/ai/chat/route.ts`.
7. **Admin seed (SEC-7)** — `AdminSeeder.run()` block default password in prod.
8. **Upload security (SEC-11)** — extension allowlist + attachment disposition in `UploadController`.
9. **Transport/scope (SEC-9, SEC-10, SEC-13)** — CORS from config; optional role recheck; lock `/stream/stock`.
10. **Webhooks (SEC-12)** — gateway signature verification before trusting payment callbacks.

---

## Phase 6 — Contract Alignment Plan

Full table is **Phase 1 §CON** + audit §5 (55+ rows). Representative:

| Endpoint | Backend DTO | Frontend Type | Mismatch | Fix |
|---|---|---|---|---|
| payments/* | `PaymentDTOs.PaymentResponse.status` | `payment.types.ts:79 paymentStatus` | name + missing fields | rename FE; add fields |
| /stores/{id}/inventory | `InventoryResponse` | `inventory.types.ts:23-40` | 7 missing fields | add backend fields |
| inventory adjust | `RESERVED`/`FLASH` | `RESERVED_STOCK`/`FLASH_SALE` | enum values | use bean names |
| /admin/merchants | `MerchantResponse` | `admin.types.ts:30-37` | 4 phantom fields | enrich or trim |
| /admin/stores | `StoreResponse` | `admin.types.ts:49-52` | 4 missing | enrich backend |
| /public catalog | `CatalogDTOs.ProductResponse` | `storefront.service.ts:63` | no images | add images |
| /orders/{id} | `OrderDTOs.OrderResponse` | `order.types.ts:134-153` | rich fields, status case/id | enrich + map |
| all date fields | `LocalDateTime` | ISO string | serialization | **CON-1 global Jackson** |
| errors | `ErrorResponse.details` | `fieldErrors` | name | standardize |

**Option A — Manual alignment:** edit each DTO/type by hand. Pro: no tooling, surgical. Con: 55+ touch points, drift returns.

**Option B — OpenAPI + codegen:** add `springdoc-openapi` to backend → generate `openapi.json`; run `openapi-typescript` (or `orval`) to generate `frontend/types/api.generated.ts` consumed by services. Pro: single source of truth, drift caught in CI, future-proof. Con: upfront setup; must annotate DTOs.

**Recommendation: Option B.** With 55+ mismatches and ongoing development, generated types eliminate drift permanently. Sequence: do **CON-1/CON-2 + the P0 contract fixes manually first** (they unblock P0 flows immediately), then introduce `springdoc` + codegen in P1/P6 to lock the contract and replace hand-written types incrementally.

---

## Phase 7 — Backend Completion Plan

| Item | Type | File / Controller / Service / Repo | Steps |
|---|---|---|---|
| `POST /orders/{orderId}/reorder` | **Missing** | `OrderController` + `OrderService.reorder` + `OrderRepository` | Load order, recreate cart lines, return cart/summary |
| `GET /payments/store/{storeId}` | **Missing** | `PaymentController` + `PaymentServiceImpl.getStorePayments` + `PaymentRepository` | MERCHANT auth, query by store, page |
| stock on product update | **Broken** | `ProductService.updateProduct`, `ProductDTOs.UpdateProductRequest` | add `quantity`, adjust inventory |
| search storeId scoping | **Broken** | `ProductService.searchProducts`, `ProductRepository` | add storeId param + query |
| server-side search filters/paging | **Missing (XL)** | `ProductController` search, `ProductService` | add filter/sort/page params, facets |
| SSE push | **Broken** | `OrderNotificationConsumer`, `PaymentNotificationConsumer` → `SseService.sendToUser` | call after persist |
| catalog images | **Missing** | `CatalogDTOs.ProductResponse`, public catalog service | join `ProductMedia` |
| admin store enrichment | **Missing** | `StoreDTOs`, `AdminController.getAllStores` | add counts/merchant fields |
| inventory response fields | **Broken** | `InventoryResponse`, `InventoryServiceImpl` | add flags/names/threshold |
| updateTheme tx | **Broken** | `StorefrontCustomizationService.updateTheme` | drop `readOnly` |
| store-category update | **Missing** | `StoreCategoryController` (+ PUT) | add update endpoint |
| inventory reserve/release in checkout | **Orphan** | `InventoryController.reserve/release`, `CheckoutService` | wire into checkout |
| webhook handlers | **Missing** | `PaymentController` | per-gateway verified callbacks |
| `UnifiedAuthController` | **Orphan/dup** | `UnifiedAuthController.java` | delete (DC-4) |
| public single product | **Orphan** | `PublicStorefrontController` `/products/{id}` | wire FE or remove |

---

## Phase 8 — Frontend Completion Plan

| Missing item | Type | Target files | Task |
|---|---|---|---|
| Delete-account UI | page+wire | `store/[slug]/settings` | call `authService.deleteCustomerAccount`/`DELETE /users/me` |
| Merchant profile/self-manage | page | new under `dashboard` | wire `merchantService` (POST/GET/DELETE `/merchants/me`) |
| SSE subscribers | hooks | `useEventStream`, new merchant subscriber; `RealtimeProvider` | consume order/stock events (FEAT-SSE) |
| Public storefront renderer | component (XL) | `store/[slug]/page.tsx`, `useStore.ts` | render backend pages/components (INT-23) |
| Global unread bell | component | dashboard/store layout | use `notification.service` unread-count |
| Single-notification dismiss | component+BE | `account/notifications` + new BE route | add endpoint + UI |
| Store-category management | page | `dashboard/products` area | CRUD store categories |
| Invoice display/download | component | order detail | render `invoiceNumber`; real download |
| Decorator-edit UI | component | `DecoratorsPanel` (StorefrontBuilder) | wire `updateDecorator` |
| metaDescription field | input | StorefrontBuilder page editor | bind to PUT page |
| Inventory low-stock alerts subscriber | hook | inventory page | listen STOCK_ALERT SSE |
| Admin review moderation | page | `app/admin` | DELETE review (ADMIN) |
| Confirmation live order | wire | `confirmation/page.tsx` | `getOrderById` (INT-42) |
| `useUpload` hook | hook | new `hooks/useUpload.ts` | 401 retry + progress |

---

## Phase 9 — Technical Debt Removal (safe order)

1. **After P2/P3 prove backend paths** — remove mock data reads: `lib/local-store/apply-checkout.ts`, `analytics-from-orders.ts`, `customers-from-orders.ts`, `dashboard-metrics.ts` and the `useFlowmerceOrders`/`useFlowmerceStore` hooks (`lib/local-store/hooks.ts`); switch dashboard/analytics/customers pages to backend (INT-34).
2. **After SEC-6** — delete `lib/local-store/auth-local.ts` + signup mock branch in `app/page.tsx` (`.env:13` `NEXT_PUBLIC_API_KEY` gate).
3. **After settings→backend (INT-25)** — remove `settings-storage.ts`/`settings-types.ts`.
4. **After catalog persistence (INT-37)** — remove `catalog-sync.ts`, `orders.ts`, `store.ts`.
5. **Always-safe (unimported)** — delete `lib/api.ts` (DC-3), `UnifiedAuthController.java` (DC-4).
6. **Unused service methods (DC-6/7)** — remove only after grep confirms no imports: `inventory.service.ts:31-60`, `product.service.ts` getActiveProducts/getById/search/deleteMedia (keep if FE wiring planned), `userService.getMyProfile/deleteAccount`, `storeService.updateOnboardingStep`, deprecated `storefrontService.updateColors/searchProducts`.
7. **Consolidate** `/me` endpoints; lock/remove `/stream/stock` if no subscriber.

> Removal rule: each deletion preceded by `grep` for imports across real source (exclude `.claude/worktrees`), and gated behind the feature that replaces it being green.

---

## Phase 10 — Release Roadmap

Baseline integration ≈ **60%** (audit: 55–65%). Durations assume ~2 engineers.

| Sprint | Duration | Issues resolved | Risk reduction | Integration | Readiness |
|---|---|---|---|---|---|
| **Sprint 0** | 3–4 d | SEC-1/2/3/4/5/7, CON-1, CON-2 | Eliminates all 5 P0 security exposures; standardizes dates/envelope | 60% → **63%** | Safe-to-develop |
| **Sprint 1** | 1 wk | All CON aligns + INT-7/8/15/19/20/21/32/33/44; SEC-6/8 | Contract drift removed; auth hardened | 63% → **74%** | Internal alpha |
| **Sprint 2** | 1 wk | BE completion: INT-1/14/18/22/39/40, catalog images, admin store, inventory fields | No 404s; backend feature-complete | 74% → **84%** | Closed beta |
| **Sprint 3** | 1–1.5 wk | FE repairs: INT-3/5/6/9/10/11/12/13/16/17/23/24/25/29/30/31/35/36/37/42/43 | 5 broken flows (C/D/E/F/G) restored | 84% → **93%** | Open beta |
| **Sprint 4** | 1 wk | P4 mock removal (INT-34, DC-5) + P5 infra (DOC-2..7) + DC-3/4 | Single source of truth; reproducible deploy | 93% → **~99%** | **Production-ready** |
| **Sprint 5 (opt)** | ongoing | P6: SEC-10/12, FEAT-RENDER/SEARCH/ANALYTICS XLs, OpenAPI codegen, TanStack Query | Performance + maintainability | polish | GA hardening |

---

## Phase 11 — File-Level Change Map (top files, desc. by issue count)

| # | File | Issues | Priority | Reason |
|---|---|---|---|---|
| 1 | `Back end/.../UserManagement/config/SecurityConfig.java` | SEC-3(support),9,13,INT-40 | P0 | CORS, public matchers, stream auth |
| 2 | `Back end/.../resources/application.properties` | SEC-1,5,7,DOC-1,3,CON-1 | P0 | Secrets, JDBC env, seed, Jackson |
| 3 | `frontend/store/auth-store.tsx` | SEC-6,8,CON-11 | P0 | Token storage, refresh rotation |
| 4 | `frontend/components/merchant/payments/PaymentsPage.tsx` | INT-15,16,17,18 | P0 | status field, auth, phantom route |
| 5 | `frontend/services/payment.service.ts` | INT-18,DC-1,CON-3 | P0 | phantom route, status type |
| 6 | `frontend/types/payment.types.ts` | CON-3,INT-15 | P0 | status + missing fields |
| 7 | `frontend/components/merchant/inventory/InventoryPage.tsx` | INT-19,20,21,CON-4 | P0 | flags, history fields, enum |
| 8 | `frontend/types/inventory.types.ts` | INT-19,CON-4 | P0 | enum + missing fields |
| 9 | `frontend/app/store/[slug]/account/orders/[id]/page.tsx` | INT-12,13,14 | P0 | auth headers, reorder 404 |
| 10 | `frontend/services/order.service.ts` | INT-14,33,DC-2,CON-8 | P0 | phantom route, canCancel, mapping |
| 11 | `frontend/types/order.types.ts` | CON-8 | P1 | rich fields, status case, id |
| 12 | `frontend/app/admin/merchants/page.tsx` | INT-5,6 | P0 | wrong id passed |
| 13 | `frontend/types/admin.types.ts` | INT-8,32,CON-5,6 | P0 | merchant/store/order fields |
| 14 | `frontend/components/store/StoreProvider.tsx` | INT-3,31 | P0 | images, cart race |
| 15 | `frontend/hooks/useStore.ts` | INT-23 | P0 | discards pages/components |
| 16 | `frontend/app/store/[slug]/page.tsx` | INT-23,FEAT-RENDER | P0 | hardcoded storefront |
| 17 | `Back end/.../ProductManagement/dto/CatalogDTOs.java` | INT-3,CON-7 | P0 | missing images |
| 18 | `Back end/.../ProductManagement/dto/ProductDTOs.java` | INT-2,CON-15 | P0 | stock field, rating |
| 19 | `Back end/.../ProductManagement/service/ProductService.java` | INT-1,2,36 | P0 | search storeId, stock |
| 20 | `Back end/.../StoreMangement/dto/StoreDTOs.java` | INT-24,CON-6,12 | P0 | admin store, brandName |
| 21 | `frontend/app/dashboard/settings/.../SettingsPage.tsx` | INT-25,38 | P1 | settings→backend, upload auth |
| 22 | `frontend/app/store/[slug]/checkout/page.tsx` | INT-11,CON-13 | P0 | cart reconcile |
| 23 | `frontend/types/cart.types.ts` | INT-45,CON-13 | P2 | checkout request shape |
| 24 | `frontend/app/store/[slug]/cart/page.tsx` | INT-29 | P1 | priceAtAdd |
| 25 | `Back end/.../NotificationManagement/consumer/OrderNotificationConsumer.java` | INT-22 | P0 | SSE push |
| 26 | `Back end/.../NotificationManagement/consumer/PaymentNotificationConsumer.java` | INT-22 | P0 | SSE push |
| 27 | `Back end/.../PaymentManagement/controller/PaymentController.java` | INT-18,SEC-12 | P0 | missing route, webhooks |
| 28 | `Back end/.../PaymentManagement/service/PaymentServiceImpl.java` | INT-18 | P0 | store payments |
| 29 | `Back end/.../OrderManagement/controller/OrderController.java` | INT-14,CON-8 | P0 | reorder route |
| 30 | `Back end/.../OrderManagement/service/OrderService.java` | INT-14 | P0 | reorder logic |
| 31 | `frontend/components/auth/ProtectedRoute.tsx` | SEC-3 | P0 | RBAC bypass |
| 32 | `frontend/app/api/ai/chat/route.ts` | SEC-2,4 | P0 | key, auth/throttle |
| 33 | `frontend/app/admin/categories/page.tsx` | INT-10 | P0 | admin auth |
| 34 | `frontend/app/admin/stores/page.tsx` | INT-24 | P0 | undefined fields |
| 35 | `frontend/app/admin/orders/page.tsx` | INT-32 | P1 | Page shape |
| 36 | `frontend/hooks/useWallet.ts` | INT-35,CON-9 | P1 | auth headers, enum |
| 37 | `frontend/types/wallet.types.ts` | CON-9 | P1 | tx enum, fields |
| 38 | `frontend/store/wishlist-store.tsx` | INT-30 (deps) | P1 | sync deps |
| 39 | `frontend/services/wishlist.service.ts` | INT-30,44 | P2 | move-to-cart, types |
| 40 | `frontend/app/store/[slug]/wishlist/page.tsx` | INT-30 | P1 | move-to-cart |
| 41 | `frontend/services/search.service.ts` | INT-36,40,CON-15 | P1 | rating, public auth |
| 42 | `frontend/components/store/reviews/ReviewCard.tsx`,`ReviewList.tsx` | INT-9,CON-14 | P0 | ownership coercion |
| 43 | `Back end/.../StorefrontCustomization/service/StorefrontCustomizationService.java` | INT-39 | P1 | readOnly tx |
| 44 | `Back end/compose.yaml` | DOC-2,4,5,6,7 | P1 | services/volumes/health |
| 45 | `Back end/.../UserManagement/config/JwtAuthFilter.java` | SEC-10 | P2 | role recheck |
| 46 | `Back end/.../common/controller/UploadController.java` | SEC-11 | P2 | XSS, disposition |
| 47 | `Back end/.../UserManagement/config/AdminSeeder.java` | SEC-7 | P1 | default cred |
| 48 | `frontend/settings/page.tsx` (change-password) | INT-7,28 | P0 | field rename, min-8 |
| 49 | `frontend/lib/local-store/*` (11 modules) | INT-34,DC-5 | P2 | mock layer removal |
| 50 | `frontend/lib/api.ts` | DC-3,SEC-14 | P1 | delete dead client |

---

## Phase 12 — Final Executive Plan

**Top 10 Critical (do first):**
1. SEC-1 rotate/externalize JWT+SMTP+DB secrets
2. SEC-2 rotate Groq key
3. SEC-3 fix ProtectedRoute RBAC bypass
4. SEC-4 gate AI proxy
5. CON-1 global Jackson date fix (unblocks ~20 mismatches)
6. INT-15/CON-3 payment status field
7. INT-22 SSE push from consumers
8. INT-11 checkout cart reconciliation
9. INT-23 public storefront renderer
10. INT-18 + INT-14 implement the two phantom backend routes

**Top 20 High-ROI:** CON-1; CON-2; INT-7; INT-5/6; INT-9; INT-10; INT-12/13/16/17/35 (auth-header batch); INT-15; INT-19/20/21; INT-24; INT-32; INT-29; INT-33; INT-36; INT-39; INT-40; SEC-6; SEC-7; INT-25.

**Fastest wins (XS, high value):** CON-1 (Jackson); INT-7 (rename field); INT-9 (String() coercion); INT-33 (canCancel); INT-39 (drop readOnly); INT-40 (whitelist search); SEC-2 (rotate key); INT-27/28 (min-8); INT-38 (upload header).

**Highest-risk areas:** SEC-6/8 auth cookie+rotation refactor (touches every authed call); INT-11 checkout reconciliation (payment correctness); INT-23/FEAT-RENDER storefront renderer (XL, shopper-facing); P4 mock-layer removal (regression surface across dashboard/analytics/customers/signup).

**Recommended order:** Sprint 0 (security + CON-1/2) → Sprint 1 (contracts + auth hardening) → Sprint 2 (backend endpoints + SSE) → Sprint 3 (frontend wiring, restore 5 flows) → Sprint 4 (mock removal + infra) → Sprint 5 (OpenAPI codegen, XLs, optimization).

---

## Verification Strategy (end-to-end)

- **Per task:** unit/integration test or manual call with auth; confirm no 401/404 in network tab.
- **Contracts:** after CON-1, snapshot a sample JSON per endpoint and assert FE type parses; long-term, OpenAPI codegen diff in CI.
- **Flows (audit §6 A–G):** scripted walkthroughs — merchant auth; customer auth; browse→cart→checkout→order→payment→confirmation→appears in account + dashboard; design→publish→public render; order→SSE notification; order→stock→inventory badge.
- **Security:** `git grep` for secrets returns nothing tracked; forged `authToken` denied; unauth AI POST → 401; unauth `/admin` API → 403.
- **Infra:** `docker compose up` brings up FE+BE+infra; data/uploads survive `compose down/up`.
- **Coverage gate:** every audit finding maps to an ID above; "done" = its ID closed.

> **Coverage check:** SEC-1..14 ✓ · INT-1..47 ✓ · CON-1..15 (covers audit §5 55+ rows) ✓ · DOC-1..7 ✓ · DC-1..7 ✓ · FEAT (audit §3 45+) → Phases 7–8 ✓ · Business flows A–G → restored via mapped INT/BE tasks ✓ · State-mgmt §7 → mock removal + effect-dep fixes (INT-31/34/35, wishlist deps) ✓.
