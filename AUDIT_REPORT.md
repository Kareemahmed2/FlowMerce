# FlowMerce — Final Frontend↔Backend Integration Audit

**Principal Software Architect Report** · Synthesis of 12 domain audits + 5 cross-cutting audits · Date: 2026-05-31

---

## 1. Executive Summary

FlowMerce's backend (Spring Boot, `/api/v1`) is broad and largely well-built, and the frontend (Next.js App Router) ships a complete service layer that maps almost every endpoint with correct verbs and paths. However, **integration health is roughly 55–65% functional end-to-end**: many service methods are defined but never called, several core flows (checkout, order detail, payments, public storefront rendering) are broken at the wire level, and contract drift is pervasive (field renames, missing fields, enum mismatches).

The **single biggest systemic problem is the `lib/local-store/*` localStorage mock layer**. Merchant analytics, customers, dashboard KPIs, store settings, the entire onboarding catalog, and the public-site checkout all read/write localStorage instead of the backend (`analytics-from-orders.ts`, `customers-from-orders.ts`, `dashboard-metrics.ts`, `settings-storage.ts`, `apply-checkout.ts`, `hooks.ts`). The signup landing page (`app/page.tsx`) is gated on `NEXT_PUBLIC_API_KEY`, which is **empty** (`.env:13`) — so it *always* takes the mock path, storing plaintext passwords in localStorage and never registering users in the backend.

The **most urgent security issues are three P0s**: (1) a live Gmail app password, the JWT signing secret, and the DB password are hardcoded in `application.properties` — anyone with the repo can forge ADMIN tokens; (2) a live `GROQ_API_KEY` sits in `frontend/.env.local` and powers an unauthenticated, unthrottled AI proxy; (3) `ProtectedRoute` grants `/admin` and `/dashboard` access to any forgeable `localStorage['authToken']` with no role check. Backend `@PreAuthorize` still protects data, but the secret exposure is independently catastrophic.

Two audit-digest claims were verified against source and **corrected**: merchant logout **does** revoke the token server-side (`DashboardShell.tsx:53` calls `authService.logoutMerchant` before `clearSession`), and `lib/api.ts` is confirmed dead/unimported (not actively breaking auth, but a latent wrong-port/wrong-path hazard).

---

## 2. Endpoint Connection Matrix

Status legend: **Full** = Fully Connected · **Partial** = Partially Connected · **None** = Not Connected.

### Authentication & Sessions
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| POST /auth/merchant/register | Public | `auth.service.ts:36` → `app/signup/page.tsx:40` (raw fetch) | Full |
| GET /auth/merchant/activate | Public | `auth.service.ts:43` → `app/activate/page.tsx:54` | Full |
| POST /auth/merchant/login | Public | raw fetch `app/login/page.tsx:45` → `auth-store.tsx:224` | Full |
| POST /auth/merchant/refresh | Public | `auth.service.ts:61` → `auth-store.tsx:108` | Full |
| POST /auth/merchant/logout | Bearer | `auth.service.ts:55` → `DashboardShell.tsx:53` (**verified called**) | Full |
| GET /auth/merchant/me | Auth | `auth.service.ts:65` — not called on mount | Partial |
| POST /auth/merchant/forgot-password | Public | `auth.service.ts:47` → `app/forgot-password/page.tsx:66` | Full |
| POST /auth/merchant/reset-password | Public | `auth.service.ts:51` → `app/reset-password/page.tsx:88` | Full |
| POST /auth/customer/register | Public | `auth.service.ts:71` → `CustomerAuthProvider.tsx:281` | Full |
| GET /auth/customer/activate | Public | `auth.service.ts:79` → `store/[slug]/activate/page.tsx:48` | Full |
| POST /auth/customer/login | Public | `auth.service.ts:75` → `CustomerAuthProvider.tsx:253` | Full |
| POST /auth/customer/refresh | Public | `auth.service.ts:97` → `CustomerAuthProvider.tsx:221` | Full |
| POST /auth/customer/logout | Bearer | `auth.service.ts:91` → `CustomerAuthProvider.tsx:303` | Full |
| GET /auth/customer/me | Auth | `auth.service.ts:101` → `CustomerAuthProvider.tsx:187` | Full |
| POST /auth/customer/forgot-password | Public | `auth.service.ts:83` → `store/[slug]/forgot-password/page.tsx:61` | Full |
| POST /auth/customer/reset-password | Public | `auth.service.ts:87` → `store/[slug]/reset-password/page.tsx:84` | Full |
| DELETE /auth/customer/me | Auth | `auth.service.ts:105` — no caller | None |
| GET /auth/activate (Unified) | Public | — | None |
| POST /auth/reset-password (Unified) | Public | — | None |
| GET /stream/private | Auth | `useEventStream`/`sse-client` exist; see Notifications (now wired in `RealtimeProvider.tsx:101`) | Partial |
| GET /stream/stock | Public | — | None |

### Users / Admin / Merchant Management
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| GET /users/me | Any auth | `user.service.ts:20` → `store/[slug]/settings/page.tsx:77` | Full |
| PUT /users/me | Any auth | `user.service.ts:24` → `settings/page.tsx:70` | Full |
| PUT /users/me/change-password | Any auth | `user.service.ts:28` → `settings/page.tsx:101` (sends `oldPassword`, backend wants `currentPassword`) | Partial |
| DELETE /users/me | Any auth | `user.service.ts:32` — settings page uses `authService.deleteCustomerAccount` instead | None |
| GET /admin/users | ADMIN | `admin.service.ts:25` → `admin/users/page.tsx:43` | Full |
| DELETE /admin/users/{userId} | ADMIN | `admin.service.ts:29` → `admin/users/page.tsx:62` | Full |
| GET /admin/merchants | ADMIN | `admin.service.ts:33` → `admin/merchants/page.tsx:36` | Full |
| PUT /admin/merchants/{merchantId}/verify | ADMIN | `admin.service.ts:37` → `admin/merchants/page.tsx:55` (passes `userId`!) | Partial |
| DELETE /admin/merchants/{merchantId} | ADMIN | `admin.service.ts:42` → `admin/merchants/page.tsx:65` (passes `userId`!) | Partial |
| GET /admin/stores | ADMIN | `admin.service.ts:45` → `admin/stores/page.tsx:30` | Partial |
| POST /merchants/me | Any auth | `merchant.service.ts:29` — no caller | None |
| GET /merchants/me | Any auth | `merchant.service.ts:36` — no caller | None |
| DELETE /merchants/me | Any auth | `merchant.service.ts:42` — no caller | None |

### Products
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| POST /stores/{storeId}/products | MERCHANT | `product.service.ts:30` → `ProductsPage.tsx:473` | Full |
| GET /stores/{storeId}/products | MERCHANT | `product.service.ts:34` → `ProductsPage.tsx:430` | Full |
| GET /stores/{storeId}/products/public | Public | `product.service.ts:38` — no caller | None |
| GET /stores/{storeId}/products/{productId} | Public | `product.service.ts:42` — no caller | None |
| PUT /stores/{storeId}/products/{productId} | MERCHANT | `product.service.ts:46` → `ProductsPage.tsx:462` | Full |
| PATCH /stores/{storeId}/products/{productId}/status | MERCHANT | `product.service.ts:50` → `ProductsPage.tsx:494/532` | Full |
| DELETE /stores/{storeId}/products/{productId} | MERCHANT | `product.service.ts:54` → `ProductsPage.tsx:520` | Full |
| GET /stores/{storeId}/products/search | Public | `search.service.ts:135` → `useProductSearch.ts:133` | Full |
| POST /stores/{storeId}/products/{productId}/media | MERCHANT | `product.service.ts:62` → `ProductsPage.tsx:504` | Full |
| DELETE /stores/{storeId}/products/{productId}/media/{mediaId} | MERCHANT | `product.service.ts:66` — no caller | None |

### Categories & Reviews
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| GET /categories | Public | `category.service.ts:19` → `admin/categories/page.tsx:133` | Full |
| GET /categories/{id} | Public | `category.service.ts:38` — no caller | None |
| POST /categories | ADMIN | `category.service.ts:42` → `admin/categories/page.tsx:149` (uses `useMerchantAuth`) | Partial |
| PUT /categories/{id} | ADMIN | `category.service.ts:46` → `admin/categories/page.tsx:160` (merchant auth) | Partial |
| DELETE /categories/{id} | ADMIN | `category.service.ts:50` → `admin/categories/page.tsx:175` (merchant auth) | Partial |
| GET /stores/{storeId}/categories | MERCHANT | `category.service.ts:24` → `ProductsPage.tsx:431` | Full |
| POST /stores/{storeId}/categories | MERCHANT | `category.service.ts:29` → `ProductsPage.tsx:121` | Full |
| DELETE /stores/{storeId}/categories/{categoryId} | MERCHANT | `category.service.ts:34` → `ProductsPage.tsx` | Full |
| GET /products/{productId}/reviews | Public | `review.service.ts:16` → `ReviewList.tsx:56` | Full |
| POST /products/{productId}/reviews | BUYER | `review.service.ts:20` → `ReviewList.tsx:73` | Full |
| PUT /products/{productId}/reviews | BUYER | `review.service.ts:30` → `ReviewList.tsx:95` | Full |
| DELETE /products/{productId}/reviews/{reviewId} | BUYER/ADMIN | `review.service.ts:39` → `ReviewList.tsx:115` | Full |

### Cart & Wishlist
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| GET /cart/{storeId} | BUYER | `cart.service.ts:26` → `StoreProvider.tsx:123` | Full |
| POST /cart/items | BUYER | `cart.service.ts:30` → `StoreProvider.tsx:164` (fire-and-forget) | Partial |
| PUT /cart/items/{cartItemId} | BUYER | `cart.service.ts:37` → `StoreProvider.tsx:205` (skipped if no id) | Partial |
| DELETE /cart/items/{cartItemId} | BUYER | `cart.service.ts:41` → `StoreProvider.tsx:192` (skipped if no id) | Partial |
| DELETE /cart/{storeId} | BUYER | `cart.service.ts:45` → `StoreProvider.tsx:215` | Full |
| POST /cart/checkout | BUYER | `cart.service.ts:49` — never called | None |
| GET /wishlist | BUYER | `wishlist.service.ts:16` → `wishlist-store.tsx:175` | Full |
| POST /wishlist | BUYER | `wishlist.service.ts:20` → `wishlist-store.tsx:220` (typed `void`) | Partial |
| DELETE /wishlist/{productId} | BUYER | `wishlist.service.ts:23` → `wishlist-store.tsx:245` | Full |
| POST /wishlist/{productId}/move-to-cart | BUYER | `wishlist.service.ts:27` — UI calls local `cart.addItem` instead | None |

### Orders & Checkout
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| POST /orders/place | BUYER | `order.service.ts:104` → `checkout/page.tsx:68` (no items sent; relies on backend cart) | Partial |
| GET /orders/me | BUYER | `order.service.ts:50` → `useCustomerOrders.ts:93` | Full |
| GET /orders/{orderId} | BUYER | `order.service.ts:87` → `account/orders/[id]/page.tsx:56` (**no auth header**) | Partial |
| POST /orders/{orderId}/cancel | BUYER | `order.service.ts:98` → `useCustomerOrders.ts:166` (ok); `[id]/page.tsx:110` (**no auth**) | Partial |
| GET /orders/store/{storeId} | MERCHANT | `order.service.ts:145` → `OrdersPage.tsx:202` | Full |
| GET /orders/store/{storeId}/{orderId} | MERCHANT | `order.service.ts:150` → `OrdersPage.tsx:311` | Full |
| PUT /orders/{orderId}/status | MERCHANT | `order.service.ts:155` → `OrdersPage.tsx:289` | Partial |
| GET /orders/admin/all | ADMIN | `admin.service.ts:49` → `admin/orders/page.tsx:41` (reads `currentPage`, Spring sends `number`) | Partial |
| POST /orders/{id}/reorder | — | `order.service.ts:141` → `[id]/page.tsx:124` — **endpoint does not exist** | None (404) |

### Payments & Wallet
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| POST /payments/initiate | BUYER | `payment.service.ts:24` → checkout; result page reads `paymentStatus` (backend: `status`) | Partial |
| GET /payments/{paymentId} | Auth | `payment.service.ts:27` — no caller | Partial/None |
| GET /payments/order/{orderId} | Auth | `payment.service.ts:31` → `payment/result/page.tsx:57` (field mismatch) | Partial |
| POST /payments/{paymentId}/confirm | MERCHANT | `payment.service.ts:35` → `PaymentsPage.tsx:188` (**no auth header**) | Partial |
| POST /payments/{paymentId}/refund | MERCHANT | `payment.service.ts:43` → `PaymentsPage.tsx:196` (**no auth header**) | Partial |
| GET /payments/store/{storeId} | — | `payment.service.ts:39` → `PaymentsPage.tsx:177` — **endpoint does not exist** | None (404) |
| GET /wallets/me | BUYER | `wallet.service.ts:21` → `useWallet.ts:30` (no auth headers passed) | Full/Partial |
| POST /wallets/me/topup | BUYER | `wallet.service.ts:25` → `useWallet.ts:58` | Full |
| GET /wallets/me/transactions | BUYER | `wallet.service.ts:29` → `useWallet.ts:37` (enum mismatch) | Partial |
| GET /wallets/store/{storeId} | MERCHANT | `wallet.service.ts:33` → `useMerchantWallet.ts:100` | Full |
| GET /wallets/store/{storeId}/transactions | MERCHANT | `wallet.service.ts:37` → `useMerchantWallet.ts:101` | Partial |

### Inventory
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| PATCH /products/{productId}/stock | MERCHANT | `inventory.service.ts:39` — defined, not called | Full(svc)/None(UI) |
| GET /stores/{storeId}/inventory | MERCHANT | `inventory.service.ts:27` → `InventoryPage.tsx:348` (DTO 6 vs 12 fields) | Partial |
| POST /stores/{storeId}/inventory/{productId}/restock | MERCHANT | `inventory.service.ts:43` → `InventoryPage.tsx:365` | Full |
| GET /stores/{storeId}/inventory/{productId}/history | MERCHANT | `inventory.service.ts:47` → `InventoryPage.tsx:387` (all field names differ) | Partial |
| GET /inventory/{productId} | Auth | `inventory.service.ts:31` — no caller | None |
| GET /inventory/{productId}/check | Auth | `inventory.service.ts:35` — no caller | None |
| POST /inventory/adjust | MERCHANT | `inventory.service.ts:51` → `InventoryPage.tsx:374` (wrong strategy enum) | Partial |
| POST /inventory/reserve | BUYER | `inventory.service.ts:55` — no caller | None |
| POST /inventory/release | BUYER/ADMIN | `inventory.service.ts:59` — no caller | None |

### Notifications (RabbitMQ/SSE)
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| GET /notifications | Auth | `notification.service.ts:16` → `useNotifications.ts:42` | Full |
| GET /notifications/unread-count | Auth | `notification.service.ts:32` → `useNotifications.ts:60` | Full |
| PUT /notifications/{id}/read | Auth | `notification.service.ts:36` → `useNotifications.ts:108` | Full |
| PUT /notifications/read-all | Auth | `notification.service.ts:40` → `useNotifications.ts:123` | Full |
| GET /stream/private | Auth | `RealtimeProvider.tsx:101` (connected, but consumers never push SSE) | Partial |
| GET /stream/stock | Public | — | None |

### Store Management & Onboarding
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| POST /stores | MERCHANT | `store.service.ts:46` → `MerchantOnboarding.tsx:135` | Full |
| GET /stores/me | MERCHANT | `store.service.ts:38` → `MerchantOnboarding.tsx:143` + `SettingsPage.tsx:820` | Full |
| GET /stores/{storeId} | MERCHANT | `store.service.ts:42` → `SettingsPage.tsx:277` | Full |
| GET /stores/slug/{slug} | Public | `store.service.ts:34` → `useStore.ts:102` | Full |
| PUT /stores/{storeId} | MERCHANT | `store.service.ts:50` → `SettingsPage.tsx:878` | Full |
| PUT /stores/{storeId}/brand | MERCHANT | `store.service.ts:54` → `SettingsPage.tsx:885` | Full |
| PUT /stores/{storeId}/payment-methods | MERCHANT | `store.service.ts:58` → `SettingsPage.tsx:291` | Full |
| PUT /stores/{storeId}/onboarding-step | MERCHANT | `store.service.ts:62` — never called | None |
| POST /stores/{storeId}/publish | MERCHANT | `store.service.ts:66` → `MerchantOnboarding.tsx:232` | Full |
| POST /stores/{storeId}/unpublish | MERCHANT | `store.service.ts:70` → `SettingsPage.tsx:934` | Full |
| DELETE /stores/{storeId} | MERCHANT | `store.service.ts:74` → `SettingsPage.tsx:949` | Full |
| GET /stores/{storeId}/settings | MERCHANT | `store.service.ts:78` — never called (uses localStorage) | None |
| PUT /stores/{storeId}/settings | MERCHANT | `store.service.ts:82` — never called (uses localStorage) | None |
| GET /admin/stores | ADMIN | `admin.service.ts:45` → `admin/stores/page.tsx:30` (DTO missing 4 fields) | Partial |

### Storefront Customization & Public Storefront
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| POST /stores/{storeId}/storefront/init | MERCHANT | `storefront.service.ts:109` → `StorefrontPagesIndex.tsx:196` | Full |
| GET /stores/{storeId}/storefront | MERCHANT | `storefront.service.ts:113` → `StorefrontPagesIndex.tsx:174` | Full |
| POST …/storefront/publish | MERCHANT | `storefront.service.ts:117` → `StorefrontPagesIndex.tsx:210` | Full |
| POST …/storefront/unpublish | MERCHANT | `storefront.service.ts:122` → `StorefrontPagesIndex.tsx:223` | Full |
| GET …/storefront/design | MERCHANT | `storefront.service.ts:127` — orphaned | Partial/None |
| PUT …/storefront/design | MERCHANT | `storefront.service.ts:131` — orphaned | Partial/None |
| GET …/storefront/colors | MERCHANT | `storefront.service.ts:135` → `StorefrontPagesIndex.tsx:177` | Full |
| PUT …/storefront/colors | MERCHANT | `storefront.service.ts:139` → `StorefrontPagesIndex.tsx:239` | Full |
| GET …/storefront/pages | MERCHANT | `storefront.service.ts:150` → `StorefrontPagesIndex.tsx:176` | Full |
| POST …/storefront/pages | MERCHANT | `storefront.service.ts:154` → `StorefrontPagesIndex.tsx:261` | Full |
| GET …/pages/{pageId} | MERCHANT | `storefront.service.ts:158` → `StorefrontBuilder.tsx:342` | Full |
| PUT …/pages/{pageId} | MERCHANT | `storefront.service.ts:162` → `StorefrontBuilder.tsx:434` | Full |
| DELETE …/pages/{pageId} | MERCHANT | `storefront.service.ts:166` → `StorefrontPagesIndex.tsx:272` | Full |
| GET …/pages/{pageId}/components | MERCHANT | `storefront.service.ts:172` — embedded via getPage | Partial |
| POST …/pages/{pageId}/components | MERCHANT | `storefront.service.ts:176` → `StorefrontBuilder.tsx:361` | Full |
| PUT …/components/{componentId} | MERCHANT | `storefront.service.ts:180` → `StorefrontBuilder.tsx:396/418` | Full |
| DELETE …/components/{componentId} | MERCHANT | `storefront.service.ts:184` → `StorefrontBuilder.tsx:385` | Full |
| PUT …/components/reorder | MERCHANT | `storefront.service.ts:188` → `StorefrontBuilder.tsx:491` | Full |
| GET …/components/{componentId}/decorators | MERCHANT | `storefront.service.ts:194` → `StorefrontBuilder.tsx:217` | Full |
| POST …/decorators | MERCHANT | `storefront.service.ts:198` → `StorefrontBuilder.tsx:225` | Full |
| PUT …/decorators/{decoratorId} | MERCHANT | `storefront.service.ts:202` — no UI | None |
| DELETE …/decorators/{decoratorId} | MERCHANT | `storefront.service.ts:206` → `StorefrontBuilder.tsx:240` | Full |
| GET …/storefront/media | MERCHANT | `storefront.service.ts:212` → `MediaLibraryDrawer.tsx:51` | Full |
| POST …/storefront/media | MERCHANT | `storefront.service.ts:216` → `MediaLibraryDrawer.tsx:70` | Full |
| DELETE …/storefront/media/{mediaId} | MERCHANT | `storefront.service.ts:220` → `MediaLibraryDrawer.tsx:86` | Full |
| GET /public/storefront/{storeId} | Public | `storefront.service.ts:84` → `useStore.ts:116` (pages/components discarded) | Partial |
| GET /public/storefront/{storeId}/categories | Public | `storefront.service.ts:88` → `StoreProvider.tsx:43` | Full |
| GET /public/storefront/{storeId}/products | Public | `storefront.service.ts:92` → `StoreProvider.tsx:44` | Full |
| GET /public/storefront/{storeId}/products/{productId} | Public | `storefront.service.ts:97` — no caller | None |

### Search & File Upload
| Endpoint | Auth | Frontend chain | Status |
|---|---|---|---|
| POST /uploads | Auth | `upload.service.ts:19` → `StepBrand.tsx:31`, `StepCatalog.tsx:83`, `ProductsPage.tsx:158`, `SettingsPage.tsx:119` | Full |
| GET /uploads/{filename} | Public | rendered as `<img src>` | Full |
| GET /stores/{storeId}/products/search | Public | `search.service.ts:135` → `useProductSearch.ts:133` (storeId ignored backend-side; rating broken) | Partial |

---

## 3. Missing Frontend Features (Phase 4)

| Backend feature | Backend loc | What's missing | Effort |
|---|---|---|---|
| POST /auth/merchant/logout on-mount /me validation | `AuthController.java:59` | MerchantAuthProvider never calls `/me` on mount (customer does) | S |
| DELETE /auth/customer/me | `CustomerAuthController.java:77` | No "Delete Account" UI; `deleteCustomerAccount` orphaned | M |
| GET /stream/private (order/account events) | `SseController.java:20` | Now wired in RealtimeProvider, but no merchant dashboard subscriber | M |
| GET /stream/stock (broadcast) | `SseController.java:26` | No frontend subscriber at all | M |
| Unified activate/reset endpoints | `UnifiedAuthController.java:18,24` | Never called (or delete controller — see Dead Code) | S |
| POST/GET/DELETE /merchants/me | `MerchantController.java:21,31,38` | No merchant onboarding/profile/self-delete UI | M |
| Admin user activate/deactivate toggle | `User.java:45` (no endpoint) | `isActive` shown as badge only; no toggle endpoint or button | M |
| Admin pagination/sort on users & merchants | `AdminController.java:27,37` | Backend returns full lists; client-side filter only | L |
| DELETE product media | `ProductController.java:108` | Remove button is local-only; `deleteMedia` never invoked | S |
| GET single product (`/products/public`, `/{productId}`) | `ProductController.java:43,49` | Storefront uses thin CatalogDTOs; no images | M |
| Stock update after creation | `ProductDTOs.java:34-40` | `UpdateProductRequest` has no quantity field; edit-form stock discarded | M |
| Images on public CatalogDTOs.ProductResponse | `CatalogDTOs.java:17-27` | No images field → storefront shows no product images | M |
| GET /categories/{id} | `CategoryController.java:27` | `getById` orphaned | S |
| Admin review moderation (DELETE w/ ADMIN) | `ReviewController.java:53` | No admin review-moderation UI | M |
| Store-category update (no PUT endpoint) | `StoreCategoryController.java` | No merchant category-management page; no update endpoint | M |
| POST /cart/checkout (stock reservation/preview) | `CartController.java:73` | `previewCheckout` never called; no idempotency key | M |
| POST /wishlist/{productId}/move-to-cart | `WishlistController.java:48` | UI uses local `cart.addItem`; `moveToCart` orphaned | S |
| availableStock / cart expiry display | `CartDTOs.java:57,71` | No per-line stock warning / expiry countdown | S |
| POST /orders/place backend-cart sync | `OrderController.java:36` | No reconcile of local cart → backend cart before placing | L |
| Order detail rich mapping (shipment/timeline/paymentSummary) | `OrderController.java:76` | Backend OrderResponse lacks these; mapping layer absent | M |
| POST /orders/{id}/reorder | `OrderController.java` | **Endpoint missing entirely** (frontend calls it) | M |
| Confirmation page live order fetch | `OrderController.java:76` | Static UI from query params; no `getOrderById` | S |
| Invoice number display | `OrderService.java:236-248` | No UI renders `invoiceNumber`; Download Invoice is a stub | S |
| Merchant analytics from backend | `analytics-from-orders.ts:1` | All analytics from localStorage mock | XL |
| GET /payments/{paymentId}, /order/{orderId} detail UI | `PaymentController.java:35,45` | No buyer/merchant payment-detail view | S |
| GET /payments/store/{storeId} | `PaymentController.java` | **Endpoint missing** (PaymentsPage calls it) | M |
| redirectUrl handling for card gateways | `PaymentDTOs.java:71` | Checkout never reads redirectUrl / navigates to gateway | M |
| failureReason / wallet isActive display | `PaymentDTOs.java:71,84` | Not surfaced in UI | S |
| Inventory reserve/release in checkout | `InventoryController.java:83-100` | Not wired to cart/checkout | L |
| Availability check on add-to-cart | `InventoryController.java:109-116` | `checkAvailability` orphaned | M |
| InventoryResponse stockStatus mapping | `InventoryServiceImpl.java:75-79` | Frontend ignores `stockStatus`; relies on absent booleans | S |
| Low-stock SSE alerts subscriber | `StockEventListener.java:21-54` | No frontend listener for STOCK_ALERT | L |
| SSE push after RabbitMQ persist | `OrderNotificationConsumer.java`, `PaymentNotificationConsumer.java` | Consumers never call `SseService.sendToUser` | S |
| DELETE single notification | `NotificationController.java` (absent) | No endpoint, no dismiss UI | S |
| Global unread-count bell | `NotificationController.java:36-41` | Only on `/account/notifications` page | M |
| Persist onboarding step | `StoreController.java:84-92` | `updateOnboardingStep` never called | S |
| GET/PUT store settings | `StoreController.java:118-134` | Settings persisted to localStorage only | S |
| AdminStoreResponse enriched DTO | `AdminController.java:54`, `StoreDTOs.java:59-70` | Backend lacks merchantName/email/productCount/orderCount | M |
| StoreResponse.brandName | `StoreDTOs.java:59-70` | Backend never returns brandName (frontend depends on it) | S |
| Public page/component renderer | `PublicStorefrontController.java:22-26` | No dynamic renderer; storefront is hard-coded | XL |
| Decorator update UI | `StorefrontCustomizationController.java:246-258` | Only add/delete in DecoratorsPanel | S |
| Page metaDescription edit | `StorefrontController.java:139-149` | No input field in builder | S |
| Server-side search (paging/filter/facets) | `ProductController.java:88` | Backend keyword-only; all filtering client-side | XL |
| Search storeId scoping | `ProductService.java:142` | Backend ignores storeId; cross-store leakage | S (+backend) |
| Real rating in search | `ProductDTOs.java:55` | `mockRating:0` hardcoded; minRating filter broken | S |
| Upload hook with 401 retry/progress | `UploadController.java:40` | No `useUpload` hook | S |

---

## 4. Incorrect Integrations (Phase 5)

| Issue | File:line | Severity | Fix |
|---|---|---|---|
| Search backend ignores storeId → cross-store results | `ProductService.java:142-148` | P0 | Add storeId filter to repository query |
| Stock update silently discarded on product edit | `ProductsPage.tsx:462-472` + `ProductDTOs.java:34-40` | P0 | Add quantity to UpdateProductRequest or inventory endpoint |
| Storefront shows no product images (CatalogDTOs lacks images) | `CatalogDTOs.java:17-27` vs `StoreProvider.tsx:57` | P0 | Add images[] to public DTO + join ProductMedia |
| Merchant logout — *digest claim corrected*: backend IS called | `DashboardShell.tsx:53` | — | None (resolved) |
| `verifyMerchant` sends `userId` as `{merchantId}` | `admin/merchants/page.tsx:55` | P0 | Pass `m.merchantId`; add field to DTO |
| `deleteMerchant` sends `userId` as `{merchantId}` | `admin/merchants/page.tsx:65` | P0 | Pass `confirmDelete.merchantId` |
| change-password sends `oldPassword` (backend wants `currentPassword`) | `settings/page.tsx:102` | P0 | Rename request field |
| AdminMerchantResponse declares 4 fields backend never returns | `admin.types.ts:30-37` | P0/P1 | Enrich backend DTO or remove fields |
| Reviews ownership check `string === number` always false | `ReviewCard.tsx:24`, `ReviewList.tsx:68` | P0 | Coerce: `String(review.customerId) === currentCustomerId` |
| Admin categories use `useMerchantAuth` for ADMIN endpoints → 403 | `admin/categories/page.tsx:119` | P0 | Use admin/role-aware auth context |
| Checkout bypasses /cart/checkout; backend cart may be empty | `checkout/page.tsx:68` | P0 | Reconcile local→backend cart or send items[] |
| getOrderById called without auth → 401 | `account/orders/[id]/page.tsx:56` | P0 | Pass `auth.getAuthHeader()` |
| cancelOrder in detail page without auth → 401 | `account/orders/[id]/page.tsx:110` | P0 | Pass auth headers |
| reorder endpoint does not exist → 404 | `order.service.ts:141` | P0 | Implement backend route or remove UI |
| Payment status field mismatch (`paymentStatus` vs `status`) breaks polling/filter/refund | `payment/result/page.tsx:63-70`, `PaymentsPage.tsx:184,246` | P0 | Read `result.data.status` / align type |
| confirmPayment without auth header → 401/403 | `PaymentsPage.tsx:188` | P0 | Pass auth headers |
| refundPayment without auth header → 401/403 | `PaymentsPage.tsx:196` | P0 | Pass auth headers |
| getStorePayments hits non-existent endpoint → 404 | `payment.service.ts:39`, `PaymentsPage.tsx:177` | P0 | Add backend endpoint |
| Inventory strategy enum `RESERVED_STOCK`/`FLASH_SALE` vs `RESERVED`/`FLASH` | `inventory.types.ts:10` | P0 | Use backend bean names |
| InventoryResponse missing isLowStock/isOutOfStock → badges always "In Stock" | `InventoryPage.tsx:51-55` | P0 | Map stockStatus → flags |
| History drawer reads wrong field names → all undefined | `InventoryPage.tsx:302-325` | P0 | Align field names (txnId/type/quantityChange/qtyAfter) |
| RabbitMQ consumers never push SSE | `OrderNotificationConsumer.java`, `PaymentNotificationConsumer.java` | P0 | Call `SseService.sendToUser` after persist |
| Public storefront discards pages/components tree | `useStore.ts:137-164`, `store/[slug]/page.tsx` | P0 | Render backend pages/components |
| Admin stores page renders 4 undefined fields | `admin/stores/page.tsx:48-49,108-110` | P0 | Enrich backend DTO |
| Store settings saved only to localStorage | `SettingsPage.tsx:865-925` vs `store.service.ts:82` | P1 | Call updateSettings/getSettings |
| Login/signup raw fetch bypasses http-client interceptors | `app/login/page.tsx:45`, `app/signup/page.tsx:40` | P1 | Route through authService/httpClient |
| Customer signup allows 6-char passwords (backend min 8) | `store/[slug]/signup/page.tsx:41` vs `RegisterRequest.java:22` | P1 | Sync validation to min 8 |
| change-password client min 6 vs backend min 8 | `settings/page.tsx:97` | P2 | Sync to min 8 |
| Cart subtotal uses `item.product.price` not `priceAtAdd` | `cart/page.tsx:56` | P1 | Use server `priceAtAdd` |
| Wishlist "Add to Cart" uses local state, not move-to-cart | `wishlist/page.tsx:128` | P1 | Call moveToCart, update from CartResponse |
| Cart PUT/DELETE skipped on missing cartItemId (race) | `StoreProvider.tsx:192,205` | P1 | Await POST or queue mutations |
| Spring Page `number` read as `currentPage` → broken pagination | `admin/orders/page.tsx:46` | P1 | Read `number`; map Page shape |
| canCancel=true for CONFIRMED (backend allows only PENDING) | `order.service.ts:74` | P1 | Restrict to PENDING |
| Analytics/customers/dashboard from localStorage mock | `apply-checkout.ts:26-105`, `analytics-from-orders.ts` | P1 | Wire to backend orders |
| Customer useWallet omits auth headers → 401 | `useWallet.ts:30,37,46,47,60,67` | P1 | Pass `auth.getAuthHeader()` |
| Rating filter uses hardcoded mockRating:0 | `search.service.ts:158-167` | P1 | Map real `rating` field |
| StepCatalog uploads images but never persists products | `StepCatalog.tsx:30-58` | P1 | POST products on publish |
| Upload may send empty auth header | `SettingsPage.tsx:119` | P1 | Ensure authHeaders propagate |
| `updateTheme` annotated `@Transactional(readOnly=true)` but writes | `StorefrontCustomizationService.java:159` | P1 | Remove readOnly |
| Search endpoint not under /public/ — may require MERCHANT auth | `storefront.service.ts:101-105`, `search.service.ts:135` | P1 | Verify/whitelist public access |
| ProtectedRoute legacy token bypass (also security P0) | `ProtectedRoute.tsx:90-113` | P1/P0 | Remove legacy fallback |
| Confirmation page never fetches real order | `confirmation/page.tsx:19-22` | P2 | Call getOrderById |
| Merchant drawer hardcodes shipping=50/tax=14% | `OrdersPage.tsx:143-149` | P2 | Read from order DTO |
| Wishlist add/remove typed `void` — loses real wishlistId | `wishlist.service.ts:20,23` | P2 | Type as WishlistResponse |
| CheckoutRequest sends `notes`, missing billingAddress/idempotencyKey | `cart.types.ts:67` | P2 | Align DTO |
| upload.service bypasses http-client | `upload.service.ts:19-36` | P2 | Centralize or document |
| `useProductSearch` idles when categories empty | `useProductSearch.ts:124-127` | P2 | Add hydration signal |

---

## 5. Contract Mismatches (Phase 8)

| Endpoint | Field | Backend vs Frontend | Loc |
|---|---|---|---|
| /auth/*/login (UserInfo) | user.id / userId | `Integer id` vs `number userId` | `AuthResponse.java:16` vs `auth.types.ts:111` |
| /auth/*/me | isActive | `Boolean` (NON_NULL, may be absent) vs required `boolean` | `UserResponse.java:19` vs `auth.types.ts:123` |
| /auth/*/register | role | optional enum vs absent in FE type | `RegisterRequest.java:28` vs `auth.types.ts:43` |
| All errors | details / fieldErrors | `Map details` vs `fieldErrors` | `ErrorResponse.java:24` vs `api.types.ts:55` |
| /auth/*/login | expiresIn (ms vs s) | `long` (unit unconfirmed) vs treated as ms | `AuthResponse.java:11` vs `auth-store.tsx:240` |
| /auth/*/me | role enum values | `Role` enum vs `'ADMIN'\|'MERCHANT'\|'BUYER'\|'GUEST'` | `UserResponse.java:18` vs `auth.types.ts:12` |
| All success | timestamp | absent vs declared string | `ApiResponse.java:6` vs `api.types.ts:16` |
| /users/me/change-password | currentPassword / oldPassword | `currentPassword` vs `oldPassword` | `ChangePasswordRequest.java:11` vs `auth.types.ts:86` |
| /admin/merchants | merchantId | `Integer merchantId` vs absent | `MerchantDTOs.java:19` vs `admin.types.ts:28` |
| /admin/merchants | phone,isActive,storeCount,createdAt | absent vs declared | `MerchantDTOs.java:17` vs `admin.types.ts:30-37` |
| /users/me | createdAt | `LocalDateTime` (array risk) vs `string` | `UserResponse.java:20` vs `admin.types.ts:23` |
| /public storefront products | images | absent vs `string[]` | `CatalogDTOs.java:17-27` vs `storefront.service.ts:63` |
| /public storefront products | productId | `Long` vs `number` | `CatalogDTOs.java:19` vs `storefront.service.ts:55` |
| PUT product | stock/quantity | absent vs collected but not sent | `ProductDTOs.java:34` vs `ProductsPage.tsx:462` |
| product ProductResponse | rating | `Double` (never null) vs `number\|null` | `ProductDTOs.java:55` vs `product.types.ts:41` |
| reviews | customerId | `Integer` vs `string` | `ReviewDTOs.java:33` vs `review.types.ts:7` |
| reviews | RatingSummary | absent vs declared | — vs `review.types.ts:27` |
| reviews | comment validation | unconstrained vs min 10 (Zod) | `ReviewDTOs.java:17` vs `ReviewForm.tsx:11` |
| categories | storeId in body | optional vs present but unused | `CategoryDTOs.java:14` vs `category.types.ts:16` |
| /cart/checkout req | idempotencyKey, billingAddress | optional vs absent | `CartDTOs.java:44,39` vs `cart.types.ts:66-70` |
| /cart/checkout req | notes | absent vs present | `CartDTOs.java:32-45` vs `cart.types.ts:69` |
| /cart/checkout resp | cartId,customerId,storeId | present vs absent | `CheckoutService.java:162-164` vs `cart.types.ts:41-50` |
| /cart/{storeId} | createdAt,availableStock,addedAt | present vs absent | `CartDTOs.java:57-70` vs `cart.types.ts:12-37` |
| /wishlist POST/DELETE/move | response type | WishlistResponse/CartResponse vs `void` | `WishlistController.java:35,41,50` vs `wishlist.service.ts:20-27` |
| /orders/admin/all | customerEmail,paymentMethod,storeId | absent vs required | `OrderDTOs.java:59-68` vs `admin.types.ts:60-71` |
| /orders/admin/all | currentPage vs number | Spring `number` vs `currentPage` | Spring Page vs `admin.types.ts:77` |
| /orders/me | paymentMethod | absent vs hardcoded `'—'` | `OrderDTOs.java:59-68` vs `order.service.ts:73` |
| /orders/{id} | CustomerOrder rich fields | absent vs required (shipment/timeline/etc.) | `OrderDTOs.java:39-56` vs `order.types.ts:134-153` |
| /orders/{id} | shippingAddress | `String` vs `OrderAddress` object | `OrderDTOs.java:52` vs `order.types.ts:93-98` |
| /orders/{id} | id/orderId | `Integer orderId` vs `string` "ORD-N" | `OrderDTOs.java:40` vs `order.types.ts:135` |
| /orders/{id} | status case/values | UPPERCASE 5-enum vs lowercase 7-union | `Order.java:21-27` vs `order.types.ts:19-26` |
| /orders/place | items, phone, notes | absent (uses session cart) vs present | `CartDTOs.java:32-45` vs `order.types.ts:274-289` |
| /orders/admin/all | status enum | 5 vs 7 (extra PROCESSING/REFUNDED) | `Order.java:21-27` vs `admin.types.ts:58` |
| payments (all) | status / paymentStatus | `status` vs `paymentStatus` | `PaymentDTOs.java:65` vs `payment.types.ts:79` |
| payments | currency,gateway,failureReason,paidAt | present vs absent; FE extra `updatedAt` | `PaymentDTOs.java:68-72` vs `payment.types.ts:74-87` |
| wallets | isActive | present vs absent | `PaymentDTOs.java:84` vs `wallet.types.ts:24` |
| wallet tx | type enum | CREDIT/DEBIT vs 6 values | `WalletTransaction.java:17` vs `wallet.types.ts:14` |
| wallet tx | referenceId / walletId | `Integer` / absent vs `string\|null` / `number` | `PaymentDTOs.java:94` vs `wallet.types.ts:37-46` |
| wallet tx | referenceType | present vs absent | `PaymentDTOs.java:92` vs `wallet.types.ts:35` |
| inventory | productName,productImage,defectiveQuantity,lowStockThreshold,lastUpdated,isLowStock,isOutOfStock | absent vs declared | `InventoryResponse.java:6-13` vs `inventory.types.ts:23-40` |
| inventory history | transactionId/transactionType/quantityChanged/availableAfter/strategyType | renamed/absent | `InventoryTransaction.java:19-35` vs `inventory.types.ts:45-51` |
| inventory adjust | strategyType values | RESERVED/FLASH vs RESERVED_STOCK/FLASH_SALE | `InventoryStrategyFactory.java` vs `inventory.types.ts:10` |
| notifications | type enum | 8 backend vs misaligned (3 missing, 9 phantom) | `Notification.java:47-56` vs `notification.types.ts:10-23` |
| notifications | createdAt | LocalDateTime (array risk) vs ISO string | `Notification.java:44` vs `notification.types.ts:37` |
| notifications read-all | response | `ApiResponse<String>` vs `void` | `NotificationController.java:57` vs `notification.service.ts:40` |
| /admin/stores | merchantName,merchantEmail,productCount,orderCount | absent vs declared | `StoreDTOs.java:59-70` vs `admin.types.ts:49-52` |
| StoreResponse | logo / logoUrl, brandName | `logo`/no brandName vs `logoUrl`/`brandName` | `StoreDTOs.java:65` vs `store.types.ts:55-56` |
| Store settings | storeName,contactEmail,supportPhone,taxSettings,shippingSettings | divergent | `StoreSettingsDTOs.java` vs `store.types.ts:67-128` |
| StoreResponse | paymentMethods | JSON `String` vs typed array | `StoreDTOs.java:68` vs `store.types.ts:58` |
| public storefront | pages/templateId/version/status | discarded; status `PAUSED` vs `UNPUBLISHED` | `StorefrontDTOs.java:17-27` vs `store.types.ts:79`, `storefront.types.ts:68` |
| search | basePrice / mockRating | `BigDecimal`/`Double rating` vs `Money`/`mockRating:0` | `ProductDTOs.java:48,55` vs `product.types.ts:28`, `search.types.ts:102` |

---

## 6. Business Flow Validation (Phase 6)

**A. Merchant Auth (signup → login → dashboard → refresh → logout) — VALID**
- Signup `POST /auth/merchant/register` (`signup/page.tsx:40`) ✅ (raw fetch, P1 robustness)
- Login `POST /auth/merchant/login` (`login/page.tsx:45`) ✅
- Dashboard gated by ProtectedRoute ✅ (but legacy-token bypass exists — security)
- Refresh scheduled 2min pre-expiry (`auth-store.tsx:108`) ✅
- Logout `POST /auth/merchant/logout` (`DashboardShell.tsx:53`) ✅ **— digest "logout P0" corrected to resolved**

**B. Customer Auth (signup → activation email → login → session) — VALID**
- Register w/ storeSlug (`CustomerAuthProvider.tsx:281`) ✅; logout calls backend (`:303`) ✅
- Caveat: signup password min-length 6 vs backend 8 (P1 contract)

**C. Browse → Cart → Checkout → Order — BROKEN (P0)**
- Browse/list/detail: works for name/price; **images missing** (CatalogDTOs lacks images) ⚠️
- Add to cart: local + fire-and-forget backend sync (race) ⚠️
- Checkout `POST /orders/place` sends **no items**; backend reads persisted cart → "cart is empty" 400 for guest-then-login ❌
- Order detail `getOrderById`/`cancelOrder` **without auth → 401** ❌
- Reorder `POST /orders/{id}/reorder` **endpoint missing → 404** ❌
- Confirmation page static (query-param only) ⚠️

**D. Payment (initiate → gateway → result poll → confirm) — BROKEN (P0)**
- redirectUrl never read → card flows can't navigate to gateway ❌
- Result polling reads `paymentStatus`; backend serializes `status` → never detects COMPLETED/FAILED, always "pending" ❌
- Merchant confirm/refund **without auth → 401/403** ❌; merchant payments list hits **non-existent endpoint → 404** ❌

**E. Storefront Customization (edit → save → publish → public render) — BROKEN (P0)**
- Builder CRUD/publish all wired ✅
- Public render: `useStore.ts:137-164` discards pages/components; `store/[slug]/page.tsx` renders hard-coded layout → **all builder work invisible to shoppers** ❌

**F. Order/Payment → Notification (SSE realtime) — BROKEN (P0)**
- SSE connection plumbing valid (`RealtimeProvider.tsx:101`) ✅
- RabbitMQ consumers persist via `createForUser` but **never call `SseService.sendToUser`** → no push; UI only updates on 60s poll ❌

**G. Order → Stock reduction → Inventory display — BROKEN (P1)**
- Backend reduces stock ✅; merchant inventory badges read absent `isLowStock`/`isOutOfStock` → always "In Stock", summary counts always 0 ❌

---

## 7. State Management Findings (Phase 7)

No server-state library (no React Query/SWR/Redux — confirmed `package.json`); all fetching is manual `useEffect`+`useState`.

- **P0** — Signup page always uses localStorage mock (`auth-local.ts` + `app/page.tsx:14-59`) because `NEXT_PUBLIC_API_KEY` is empty (`.env:13`, **verified**); plaintext passwords stored; backend never called.
- **P1** — Dashboard/Analytics/Customers fall back to localStorage orders via `useFlowmerceOrders` (`DashboardOverview.tsx:87`, `AnalyticsPage.tsx:53`, `CustomersPage.tsx:146`).
- **P1** — `MerchantBackendSync` patches localStorage; other hooks re-read it → dual source of truth, one-time mount only (`MerchantBackendSync.tsx:54-66,85-86`).
- **P1** — Two leaked `storage` event listeners on every remount (`lib/local-store/hooks.ts:17-22,37`).
- **P1** — wishlist backend-sync effect missing `isHydrated`/`auth` deps → silent skip (`wishlist-store.tsx:171-185`).
- **P1** — `auth.getAuthHeader` in effect deps → spurious refetch on every token refresh (`AnalyticsPage.tsx:51`, `CustomersPage.tsx:144`, `DashboardOverview.tsx:84`).
- **P1** — Customer `useWallet` omits auth headers on all calls → 401 (`useWallet.ts:30,37,46,47,60,67`).
- **P2** — No server-state lib; manual polling/dedupe; `useNotifications` interval captures stale `getAuthHeader` (`useNotifications.ts:86-90`).
- **P2** — `completeCheckoutFromCart` writes only localStorage; backend `POST /orders` never called (`apply-checkout.ts:27-104`).
- **P2** — `useProductSearch` silently idles when categories empty (`useProductSearch.ts:123-128`).
- **P3** — `useStoreData` inverted isMounted guard clears state (`useStore.ts:168-175`); `auth-local.ts` login path is dead in main tree.

---

## 8. Security Findings (Phase 9) — P0s first

**P0 — Hardcoded production secrets in `application.properties`** (`:12,21,35`). Live Gmail app password (`ekeq kkog rinc izkn`), `jwt.secret` (HMAC signing key — anyone can forge ADMIN tokens), DB password; no env indirection. → Rotate all three immediately; move to `${ENV}` with no inline default for jwt.secret/mail.

**P0 — Live `GROQ_API_KEY` in `frontend/.env.local:4`**, consumed by `app/api/ai/chat/route.ts:13`. Gitignored but plaintext on a synced OneDrive folder. → Rotate; keep only in host secret store; move repo out of OneDrive.

**P0 — RBAC bypass via forgeable `localStorage['authToken']`** (`ProtectedRoute.tsx:90-113`). Any non-empty legacy token passes auth; role block at `:102` is skipped when `auth.role` is null → `/admin` UI shell accessible. Backend `@PreAuthorize` still guards data. → Remove legacy fallback; deny when `requiredRole` set and role missing.

**P0 — AI chat proxy unauthenticated & unthrottled** (`app/api/ai/chat/route.ts:5-45`). No auth/origin/rate limit; attacker-controlled `system` prompt; burns owner's Groq key. → Require session, rate-limit, server-defined system prompt, CSRF check.

**P0 — SMTP app password committed** (duplicate of secrets finding; `application.properties:35`).

**P1 — JWT in localStorage (XSS-exfiltratable)** (`auth-store.tsx:64-69`, `auth-local.ts:40,68`); 24h TTL; refresh token also in localStorage; plaintext password persisted. → httpOnly+Secure cookies; shorten access TTL; delete auth-local.
**P1 — Default admin seed `ChangeMe!2026`, auto-activated** (`application.properties:25-26`, `AdminSeeder.java:35,51`). → Fail startup on default in prod; force change; `@Profile("!prod")`.
**P1 — No refresh-token rotation** (`auth-store.tsx:102-125`); stolen refresh token renews indefinitely. → Single-use rotating refresh tokens, server revocation.
**P2** — CORS `localhost:[*]` with credentials (`SecurityConfig.java:78-84`); JWT role trusted full 24h, no per-request re-check (`JwtAuthFilter.java:41-62`); upload extension from user input served inline → stored-XSS via SVG/HTML (`UploadController.java:50-110`); payment webhook signature verification absent (design gap, `PaymentController.java`, stub adapters).
**P3** — Public `/stream/stock` leaks inventory + unauthenticated long-lived connection (`SseController.java:26-29`); divergent `lib/api.ts` uses `NEXT_PUBLIC_API_KEY` as bearer + wrong default port 3001 (`lib/api.ts:6-7,34-36`).

---

## 9. Docker & Environment Findings (Phase 10)

- **P0** — SMTP app password committed (`application.properties:35`); live Groq key in `.env.local:4`. → Rotate + env indirection.
- **P1** — No Dockerfile for backend or frontend; `compose.yaml` only starts postgres/rabbitmq/redis. → Add multi-stage Dockerfiles + services.
- **P1** — JDBC URL hardcoded `localhost:5432` (`application.properties:10`), unlike redis/rabbit which use env vars → breaks in-container. → `jdbc:postgresql://${DB_HOST:localhost}:...`.
- **P1** — postgres has no named volume → data lost on `compose down` (`compose.yaml:2-9`). → Add `pgdata` volume.
- **P1** — No volume for uploads (`app.upload.dir=uploads`, `UploadController.java:63`) → uploads lost on restart. → Mount volume / object storage.
- **P2** — `spring.docker.compose.enabled=false` (`:18`); no healthchecks; no `depends_on`; `NEXT_PUBLIC_API_URL` hardcoded localhost:8080 (no client/server split); CORS wildcard not driven by `app.frontend-url` (`SecurityConfig.java:78-81`).
- **P3** — `latest` image tags (non-reproducible); `next.config.mjs:10-14` lacks localhost image host (only `*.flowmerce.io`).

---

## 10. Dead Code (Phase 11)

**P1 (broken/phantom):**
- `paymentService.getStorePayments` → non-existent `GET /payments/store/{storeId}` (`payment.service.ts:42`, `PaymentsPage.tsx:177`).
- `orderService.getReorderItems` → non-existent `POST /orders/{id}/reorder` (`order.service.ts:136-141`).
- `lib/api.ts` entirely dead/unimported, wrong port 3001 (`lib/api.ts:1-60`) — **verified no imports outside worktrees**.
- `UnifiedAuthController` duplicates auth paths, never called, risks ambiguous-mapping (`UnifiedAuthController.java:1-33`).

**P2 (superseded local-store + unused service methods):** `analytics-from-orders.ts`, `customers-from-orders.ts`, `dashboard-metrics.ts`, `settings-storage.ts`/`settings-types.ts`, `auth-local.ts`, `catalog-sync.ts`, `apply-checkout.ts`, `orders.ts`, `store.ts`, `hooks.ts` (all localStorage, superseded by real APIs). Unused service methods: `inventory.service.ts:31-60` (getInventoryDetail/checkAvailability/reserveStock/releaseStock); `product.service.ts` getActiveProducts/getById/search/deleteMedia; `userService.getMyProfile/deleteAccount`; `storeService.updateOnboardingStep/getSettings/updateSettings`.

**P3:** `storefrontService.updateColors` (deprecated), `updateDecorator`, `searchProducts` (dupe); `merchantService.deleteMyAccount`; `categoryService.getById`; `cartService.previewCheckout`; `/stream/stock` unused; three overlapping `/me` endpoints (consolidate; `UserController.getMyProfile` redundant).

---

## 11. FINAL GAP REPORT (Phase 12)

### Summary Counts
- **Total backend endpoints audited:** ~110
- **Fully Connected:** ~62
- **Partially Connected:** ~28
- **Not Connected:** ~20 (plus 3 phantom frontend calls to non-existent backend routes: reorder, payments/store, plus unified auth unused)
- **Missing frontend features:** 45+ (see §3)
- **Broken end-to-end flows:** 5 (Checkout/Order, Payment, Storefront render, Notifications SSE, Inventory display) of 7 traced
- **Security issues:** 14 (5×P0, 4×P1, 4×P2, 2×P3 incl. docker overlap)
- **Contract mismatches:** 55+ distinct (see §5)

### Priority Matrix

**P0 (must fix before any release):**
1. Rotate + externalize hardcoded secrets (jwt.secret, SMTP, DB, Groq) — `application.properties:12,21,35`, `.env.local:4`
2. Remove ProtectedRoute legacy-token RBAC bypass — `ProtectedRoute.tsx:90-113`
3. Authenticate + rate-limit AI proxy — `app/api/ai/chat/route.ts`
4. Payment `status` vs `paymentStatus` field — `payment.types.ts:79`, `payment/result/page.tsx:63`, `PaymentsPage.tsx:184,246`
5. Add backend `GET /payments/store/{storeId}` — `PaymentController.java`
6. Add backend `POST /orders/{orderId}/reorder` (or remove UI) — `OrderController.java`
7. Auth headers on getOrderById/cancelOrder — `account/orders/[id]/page.tsx:56,110`
8. Auth headers on confirmPayment/refundPayment — `PaymentsPage.tsx:188,196`
9. Checkout backend-cart reconciliation / send items — `checkout/page.tsx:68`
10. Admin verify/delete merchant wrong ID + DTO — `admin/merchants/page.tsx:55,65`, `MerchantDTOs.java:19`
11. change-password field `oldPassword`→`currentPassword` — `settings/page.tsx:102`
12. Admin categories must use ADMIN auth — `admin/categories/page.tsx:119`
13. Reviews ownership `String()` coercion — `ReviewCard.tsx:24`, `ReviewList.tsx:68`
14. Inventory strategy enum + InventoryResponse fields + history field names — `inventory.types.ts:10`, `InventoryPage.tsx:51-55,302-325`
15. Backend search storeId scoping — `ProductService.java:142`
16. CatalogDTOs.ProductResponse images (storefront images) — `CatalogDTOs.java:17-27`
17. Product stock update path (UpdateProductRequest) — `ProductDTOs.java:34-40`
18. RabbitMQ consumers call `SseService.sendToUser` — `*NotificationConsumer.java`
19. Public storefront render pages/components — `useStore.ts:137-164`, `store/[slug]/page.tsx`
20. AdminStoreResponse enriched DTO — `StoreDTOs.java:59-70`
21. Signup uses backend (remove localStorage mock) — `app/page.tsx`, `.env:13`

**P1:** JWT→httpOnly cookies + refresh rotation + shorten TTL; admin seed hardening; Dockerfiles + DB env + postgres/upload volumes; login/signup via httpClient; customer signup min-8; cart `priceAtAdd`; wishlist move-to-cart; cart race (await POST); admin orders Page `number`; canCancel PENDING-only; analytics/customers/dashboard off localStorage; customer useWallet auth headers; rating-filter real data; `@Transactional(readOnly)` on updateTheme; verify search public auth; settings → backend; StoreResponse logo/brandName; inventory badges via stockStatus; SSE merchant subscriber; effect-dep auth-header refs; wishlist sync deps; leaked listeners.

**P2:** healthchecks/depends_on/CORS-from-config/image-host/env-split; confirmation live fetch; merchant drawer real shipping/tax; wishlist response types; CheckoutRequest shape; upload via httpClient; useProductSearch hydration; notification enum + LocalDateTime serialization; orphaned cross-store category UI; onboarding-step persist; payment detail UIs; remove superseded local-store modules.

**P3:** pin image tags; public /stream/stock auth/scope; delete `lib/api.ts`, deprecated/dupe service methods, UnifiedAuthController; consolidate `/me` endpoints; decorator-edit UI; metaDescription field.

### Dependency-Ordered Implementation Plan

**Phase 0 — Secrets & Auth Hardening (blockers; do first)**
1. Rotate jwt.secret, SMTP password, DB password, Groq key; move to env vars with no inline defaults (`application.properties`, `.env.local`).
2. Add Jackson `write-dates-as-timestamps=false` + JavaTimeModule globally (fixes ALL `LocalDateTime` → ISO string mismatches: notifications, orders, users, payments).
3. Remove ProtectedRoute legacy-token bypass; gate solely on verified session + deny on missing role.
4. Authenticate + rate-limit AI proxy; server-defined system prompt.
5. Move JWT to httpOnly cookies; shorten access TTL; implement refresh-token rotation; harden admin seeder.

**Phase 1 — Contract Alignment (unblocks every consumer)**
6. Standardize the `ApiResponse`/`ErrorResponse` envelope (`details`→`fieldErrors`, drop phantom `timestamp`).
7. Fix the payment `status` field name across DTO/types/consumers.
8. Align enums: inventory strategy (`RESERVED`/`FLASH`), wallet TransactionType, notification types, order status case/values, AdminOrderStatus.
9. Add/align missing DTO fields: AdminMerchant (`merchantId`, etc.), AdminStore (merchantName/email/counts), CatalogDTOs `images`, InventoryResponse (isLowStock/isOutOfStock/productName/…), StoreResponse `logo`/`brandName`, wallet `isActive`, payment currency/gateway/failureReason/paidAt, inventory history field names.
10. Rename change-password field; sync password min-lengths to 8.

**Phase 2 — Backend Endpoint Gaps**
11. Implement `GET /payments/store/{storeId}` and `POST /orders/{orderId}/reorder`.
12. Add storeId filter to product search; (optionally) add server-side search filters/paging.
13. Add stock-update capability to product update (or inventory adjust endpoint).
14. Wire `SseService.sendToUser` into RabbitMQ consumers.
15. Fix `@Transactional(readOnly=true)` on `updateTheme`; ensure `/stores/*/products/search` is public.

**Phase 3 — Wire Existing Endpoints / Fix Calls**
16. Add auth headers to getOrderById, cancelOrder, confirmPayment, refundPayment, customer useWallet.
17. Admin verify/delete merchant pass `merchantId`; admin categories use ADMIN auth.
18. Reviews ownership coercion; cart PUT/DELETE await cartItemId; cart `priceAtAdd`; wishlist move-to-cart + response types.
19. Checkout: reconcile local→backend cart (or send items); read payment `redirectUrl`; confirmation live fetch.
20. Settings → `getSettings`/`updateSettings`; onboarding-step persist; storefront public render of pages/components.

**Phase 4 — Replace Mock Layer (largest, depends on Phase 1–3)**
21. Replace signup/login local-store with `authService` (`app/page.tsx`).
22. Replace dashboard/analytics/customers localStorage with backend orders; remove `useFlowmerceOrders`/`useFlowmerceStore`, `analytics-from-orders.ts`, `customers-from-orders.ts`, `dashboard-metrics.ts`, `apply-checkout.ts`, `auth-local.ts`, `catalog-sync.ts`, `settings-storage.ts`.
23. Persist onboarding catalog (StepCatalog) to backend.

**Phase 5 — Robustness, Infra & Cleanup**
24. Adopt TanStack Query/SWR for the flagged hooks; fix leaked listeners, stale closures, effect deps.
25. Dockerfiles + compose services, volumes (pgdata, uploads), healthchecks, depends_on, env-driven CORS/API URLs, pinned image tags, localhost image host.
26. Delete dead code (`lib/api.ts`, `UnifiedAuthController`, deprecated/dupe service methods); consolidate `/me` endpoints; add decorator-edit + metaDescription UI; SSE merchant/stock subscribers; harden upload (extension allowlist, `Content-Disposition: attachment`).