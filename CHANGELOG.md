# Changelog — Uncommitted Changes (as of 2026-06-22)

Branch: `flowmerce-frontend-and-security`
Base commit: `23bd05e` — "integrate MinIO object storage with FileMetadata"

This document covers every working-tree change since the last commit, across both
the Spring Boot backend (`Back end/`) and the Next.js frontend (`frontend/`).
Tool-generated noise (`graphify-out/`, stray screenshots, runtime upload test
files, `next-env.d.ts`) is excluded.

Two themes dominate this diff:

1. **Session/security correctness** — merchant and customer logins can now coexist
   in the same browser without clobbering each other's cookie, OAuth sessions are
   as resilient as password sessions, and account data (brand name) no longer
   leaks from the wrong source.
2. **Closing real gaps in store creation/onboarding** — stale cross-account
   drafts, dropped logo/product images, an unpublished storefront template, and a
   new backend-aggregated Customers feature.

---

## Backend: Auth & Session Security (SEC-11)

**Problem:** a customer logging into the storefront and a merchant logging into
the dashboard, in the same browser, used to silently overwrite each other's auth
cookie — because both used the same cookie name.

- `CookieUtil.java` — cookie names are now scoped: `{scope}_access_token` /
  `{scope}_refresh_token`, with `MERCHANT_SCOPE` / `CUSTOMER_SCOPE` constants.
  `setAuthCookies`, `clearAuthCookies`, `extractAccessToken`, `extractRefreshToken`
  all take a `scope` parameter now.
- `JwtAuthFilter.java` — now prefers the `Authorization` header over cookies
  (it reflects exactly which context made *this* call). When there's no header,
  it falls back to a new `X-Auth-Role` request header to pick the right scoped
  cookie, or checks both scopes if no hint is given.
- `AuthController.java` (merchant) / `CustomerAuthController.java` (customer) —
  updated every cookie call site to pass the correct scope constant.
- `SocialAuthController.java` / `SocialAuthService.java` *(this session)* —
  Google/Facebook OAuth login now also sets the merchant-scoped httpOnly cookie,
  matching what password login already did (previously OAuth had **no** cookie
  fallback at all — a single dropped bearer-token request had nowhere to fall
  back to). The OAuth redirect URL now also includes `expiresIn`, fixing a gap
  vs. what the frontend's OAuth parser expected.
- Frontend: `auth-store.tsx` (merchant) and `CustomerAuthProvider.tsx` (customer)
  — `getAuthHeader()` always sends `X-Auth-Role: MERCHANT` / `CUSTOMER` even
  before a bearer token is held in memory, so the backend can pick the right
  cookie on first load. `StoreHeader.tsx`'s unread-notification fetch now
  explicitly passes `auth.getAuthHeader()` (it sent no auth header before, risking
  a cross-scope cookie read).

## Backend: User Profile Completeness

- `UserProfile.java` — added a `city` column.
- `RegisterRequest.java`, `UserResponse.java`, `AuthResponse.UserInfo` — added
  `address` / `city` (and `phone` on `AuthResponse.UserInfo`).
- `AuthService.java` — `register()` now creates a `UserProfile` row when
  address/city are supplied; `getCurrentUser()` / `buildAuthResponse()` now join
  in `UserProfile` and populate phone/address/city instead of leaving them blank.
- Frontend: `auth.types.ts` gained `address`/`city` on the relevant types;
  `CustomerAuthProvider.tsx`'s `profileFromAuthResponse()` now accepts fresh
  server data so a new login/`/me` response overwrites the stale local cache
  instead of the cache always winning; signup now forwards `address`/`city`.

## Backend: Orders & New Customers Feature

- **New endpoint:** `GET /orders/store/{storeId}/customers` →
  `OrderService.getStoreCustomers()` — aggregates a store's orders into one row
  per distinct customer (order count, lifetime spend excluding cancelled orders,
  last order date, join date, last shipping address). New `OrderDTOs.CustomerSummary`
  DTO. This replaces a frontend-only "derive customers from order rows" approach
  that never had access to customer email/name.
- **Order cancellation now reverses payment:** `cancelOrder()` calls
  `paymentService.refundPayment(...)` when a wallet payment had already settled
  (`COMPLETED`) before the cancellation — COD/bank-transfer orders stay `PENDING`
  so there's nothing to reverse there. New `PaymentRepository` / `PaymentServiceImpl`
  dependencies.
- **Duplicate notification removed:** `updateOrderStatus()` and `cancelOrder()`
  both called `sseService.sendOrderUpdate(...)` directly *and* published an event
  via `orderEventPublisher`, whose consumer already does the SSE push and
  persists the notification — this was double-firing the toast. The direct call
  was removed.

## Backend: Notifications

- `NotificationRabbitMQConfig.java` — routing key binding changed from `order.*`
  to `order.#`. AMQP wildcards: `*` matches exactly one word, `#` matches
  zero-or-more. `order.*` only matched 2-segment keys (`order.cancelled`) and
  silently dropped 3-segment ones (`order.status.updated`) — a real bug, not
  cosmetic.

## Backend: Read-Only Transaction Hygiene

`CategoryService.java`, `ProductService.java`, `StoreService.java` — every
pure-read method (`getAllCategories`, `getCategoryById`,
`getStoreCombinedCategories`, `getStoreProducts`, `getActiveProducts`,
`getProductById`, `searchProducts`, `getMyStores`, `getStoreById`, `getBySlug`,
`getSettings`, `getAllStores`) gained `@Transactional(readOnly = true)` —
previously running with no transaction boundary at all.

## Backend: Store Brand Name Fix

`StoreService.toResponse()` — `brandName` used to come from
`merchant.getBusinessName()`, a field set once at account creation (and for
OAuth signups, filled with the merchant's *personal* Google/Facebook name) that
is never updated afterward. A merchant's actual chosen store name was
permanently shadowed on every customer-facing page (hero, header, footer,
login/signup). Now `brandName = store.getStoreName()` directly. **Same root
problem class as the OAuth session bug fixed this session** — OAuth account
data leaking into places it shouldn't.

## Backend: File Uploads

`UploadController.java` — every uploaded file used to be forced
`Content-Disposition: attachment` (forced download, never inline) as an XSS
mitigation against a rogue SVG/HTML masquerading as an image. Now only
validated raster types (`image/jpeg|png|gif|webp|avif`) are served `inline` so
`<img>` tags actually render them; everything else still forces `attachment`.
Fixes images failing to display while keeping the XSS protection for
non-image fallback types.

## Backend: New Entity (groundwork, not yet wired up)

`FileStorage/entity/FileMetadata.java` *(new)* — JPA entity for a `file_metadata`
table: filename, URL, `FileType` enum (IMAGE/PDF/VIDEO/DOCUMENT), `EntityType`
enum (PRODUCT/STORE/THEME/USER/ORDER/ATTACHMENT/STOREFRONT), entityId, bucket,
folder, size, content-type, uploadedBy, isDeleted. Matches the MinIO
integration from the prior commit — groundwork for a generalized file-tracking
layer, not yet referenced elsewhere in this diff.

## Backend: Infrastructure & Config

- `compose.yaml` / `application.properties` — **dropped the local Postgres
  container entirely.** The backend now always talks to the shared Supabase
  Postgres instance via the **Supavisor session pooler**
  (`aws-0-eu-west-1.pooler.supabase.com:5432`) instead of the direct
  `db.<ref>.supabase.co` host, because that direct host is **IPv6-only and
  Docker can't route to it**. `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` are all
  overridable via `.env`.
- `application.properties` — Hikari `maximum-pool-size` dropped **20 → 10**:
  the Supavisor session pooler's free tier caps at 15 total sessions *across the
  whole project*, not just this app, and exceeding it hard-rejects connections
  rather than queuing. A comment notes this should only go back up if the app
  moves to a direct/unpooled connection or the transaction pooler (port 6543).
- `application.properties` — `spring.jpa.hibernate.ddl-auto` changed
  **`create-drop` → `validate`**. `create-drop` was wiping and recreating the
  entire shared Supabase schema on every app start/stop; it now only validates
  the schema matches and never mutates it. Important safety fix now that the DB
  is a shared remote instance, not a disposable local container.
- `compose.yaml` — the backend service now explicitly forwards the Google/
  Facebook OAuth env vars (`GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`,
  `FACEBOOK_APP_ID/SECRET/REDIRECT_URI`) — Compose doesn't auto-inject `.env`
  keys into a container, only ones explicitly listed, so OAuth would otherwise
  silently be unconfigured inside Docker.

---

## Frontend: Next.js Build Fix

`app/login/page.tsx`, `app/activate/page.tsx`, `app/reset-password/page.tsx`,
`app/store/[slug]/login/page.tsx`, `app/store/[slug]/activate/page.tsx`,
`app/store/[slug]/reset-password/page.tsx` — every page using
`useSearchParams()` now wraps its content in `<Suspense>`. Next.js's
static-prerender pass requires this boundary; without it, the build either
fails or deopts the whole route to client-only rendering. Same mechanical fix
applied 6×.

## Frontend: Storefront Theming Fix

`app/store/[slug]/account/notifications/page.tsx` and
`app/store/[slug]/checkout/page.tsx` — notification rows and checkout
payment-method cards were using `store.colors.card` as a background, which can
be a *dark* merchant-chosen color, while the text on top was unstyled (inherits
dark text) — making it unreadable on dark themes. Both now hard-code
`background: '#fff', color: '#1e293b'`, matching the order-summary card pattern
used elsewhere, independent of the merchant's theme. Checkout also gained a
`.payment-option:hover` style using the theme's accent color.

## Frontend: Realtime Customer Notifications (new feature)

- New `components/store/CustomerNotificationListener.tsx` — the customer-side
  mirror of the existing merchant-side `NotificationListener.tsx`. Subscribes to
  `RealtimeProvider`'s SSE stream and toasts on `ORDER_UPDATE` /
  `ACCOUNT_ACTIVITY` events. Mounted in `app/store/[slug]/layout.tsx`, inside
  `CustomerAuthProvider`/`RealtimeProvider`.
- `StoreHeader.tsx` — the unread-notification-count poll now (a) sends
  `auth.getAuthHeader()` explicitly, and (b) refetches immediately on
  `realtime.notificationTick` instead of waiting for the existing 60s poll, so a
  live SSE event updates the badge right away.

## Frontend: Wallet Hook Infinite-Loop Fix

`hooks/useWallet.ts`, `app/store/[slug]/account/wallet/page.tsx`,
`components/merchant/wallet/WalletPage.tsx` — both `useWallet()` and
`useMerchantWallet()` took an already-*invoked* `authHeaders` object as a
parameter. Callers passed `auth.getAuthHeader()` (the call result, not the
function) — since `getAuthHeader()` builds a new object every call, using that
object as an effect/`useCallback` dependency caused an infinite loop (new
object → effect reruns → fetch → re-render → new object → …). All three call
sites now pass the **function reference** (`auth.getAuthHeader`), invoked
internally by the hooks.

## Frontend: Merchant Customers Page — Real Backend Data

`CustomersPage.tsx` — replaced client-side derivation from raw order rows
(deleted `lib/local-store/customers-from-orders.ts`) with the new backend
endpoint (`orderService.getStoreCustomers`) and a new mapper
`lib/local-store/customers-from-summaries.ts` (`buildCustomersFromSummaries()`).
The new mapper derives:
- **segment** (new / regular / loyal / at_risk) and **status**
  (active / vip / inactive) from order count, total spend, and recency
  (90 days → at-risk, 180 days → inactive, 5000 EGP or 10+ orders → VIP,
  7+ orders → loyal, 3+ → regular)
- a display **city**, by matching known Egyptian cities against the last
  shipping address string

Empty-state copy changed from a dev-mode disclaimer to "No customers yet —
they will appear here once your store receives its first order." Backing
types: `types/order.types.ts` gained `MerchantCustomerSummary`;
`services/order.service.ts` gained `getStoreCustomers()`.

## Frontend: Merchant Onboarding — Three Real Fixes

`components/merchant/onboarding/MerchantOnboarding.tsx`:

1. **Stale cross-account draft bug** — the onboarding draft is cached in
   `localStorage` keyed globally, not per-account. If a previous merchant on the
   same browser had published a store, a *different* merchant (new account, no
   backend store) loading onboarding used to see that old merchant's "your store
   is live" screen. Now waits for `auth.isHydrated`, and if the cached draft says
   `published: true` but `auth.storeId` is null, the draft is discarded.
   Companion fix: `auth-store.tsx`'s `removeSession()` now calls
   `clearAllLocalMerchantData()` on every logout, wiping onboarding/settings/
   orders local caches so the next account on this browser starts clean.
2. **Logo never attached to the store** — `createStore()` has no logo field, so
   the uploaded logo URL was silently dropped. Now calls
   `storeService.updateBrand(storeId, { brandName, logoUrl }, headers)` as a
   follow-up after store creation (skipped if the URL is a local-only
   `blob:`/`data:` URL the backend can't fetch).
3. **Product images never attached** — same root cause. Now loops uploaded
   `product.images` and calls `productService.addMedia(storeId, productId, ...)`
   per image (skipping `blob:`/`data:` URLs, and tolerating 409 = already has
   media from a retried attempt).
4. **Storefront template never published** — publishing a store only called
   `storeService.publishStore()`; the storefront *template* has its own separate
   "published" flag that also needs flipping, or the public storefront 404s.
   Now also calls `storefrontService.publishStorefront(storeId, headers)`
   (tolerating 409 = already published).

---

## This Session's Changes (recap)

Made in direct response to two reported bugs — included above in context, listed
together here for reference:

1. **`SocialAuthController.java` / `SocialAuthService.java`** — OAuth login now
   sets the merchant httpOnly cookie (parity with password login) and includes
   `expiresIn` in the redirect URL. Root-caused the "Create your first store"
   button not appearing after Google sign-in.
2. **`DashboardShell.tsx`** — the "View Live Store" sidebar link now checks
   `auth.storeId` + the resolved store slug; with no real store, it shows
   "Create Your Store" linking to `/onboarding` instead of guessing a fake live
   URL.
3. **`DesignStudioPage.tsx`** — the Design tab's AI assistant was rewritten to
   match the onboarding AI assistant's UX: palette suggestions are now parsed
   from a structured `===PALETTE: Name=== ... ===END PALETTE===` block and
   rendered as a card with an explicit **"Apply This Template →"** button;
   standalone hex codes in chat text become clickable apply-to-slot buttons.
   Replaces an earlier silent best-effort auto-apply that gave no visible way to
   apply a suggestion.