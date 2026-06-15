# Payment Service — Development Report

**Date:** 2026-05-25  
**Module:** `PaymentManagement`  
**Package:** `com.example.flowmerceproject.PaymentManagement`

---

## 1. Overview

The Payment Service finalises the order placement sequence. When a buyer checks out, the system now:

1. Validates the cart and reserves stock (CheckoutService)
2. Creates the order and generates an invoice (OrderService)
3. Initiates a payment via the selected gateway adapter (PaymentService)

All three steps happen in a single `POST /api/orders/place` call. The response bundles both the order and the payment result.

---

## 2. Architecture

### 2.1 Gateway Adapter Pattern (Strategy)

Six adapters implement `PaymentGatewayAdapter`:

| Adapter | Supported Methods | Behaviour |
|---|---|---|
| `WalletSimulationAdapter` | `FLOWMERCE_WALLET`, `WALLET`, `MEEZA`, `E_WALLET` | Synchronously debits customer wallet, credits merchant wallet — returns `COMPLETED` |
| `CashOnDeliveryAdapter` | `COD`, `CASH_ON_DELIVERY` | Returns `PENDING` with COD reference number |
| `BankTransferAdapter` | `BANK_TRANSFER`, `INSTAPAY` | Returns `PENDING` with bank details |
| `StripeAdapter` | `STRIPE` | Stub — returns `FAILED` (not configured) until `STRIPE_SECRET_KEY` env var is set |
| `PaymobAdapter` | `PAYMOB` | Stub — returns `FAILED` (not configured) until `PAYMOB_API_KEY` is set |
| `FawryAdapter` | `FAWRY_PAY`, `FAWRY` | Stub — returns `FAILED` until `FAWRY_MERCHANT_CODE` + `FAWRY_SECURITY_KEY` are set |

Spring injects `List<PaymentGatewayAdapter>` into `PaymentServiceImpl`. The service calls `adapter.supports(paymentMethod)` and picks the first match. Adding a new gateway requires only implementing the interface — no service changes.

### 2.2 Idempotency

Every payment request carries an `idempotencyKey` (UUID). The flow:

```
Client sends request with idempotencyKey
  → Redis lookup: payment:idempotency:{key}
  → Cache hit  → return existing payment (no double charge)
  → Cache miss → process normally
                 → cache {paymentId, status} with 24h TTL
```

If the client does not supply a key, the server generates one (UUID). The key is also stored on the `Payment` entity with a `UNIQUE` DB constraint as a second safety net.

### 2.3 Wallet Simulation

Wallets are created on first use:

- **Customer wallet:** starts at **100,000 EGP** (simulation seed)
- **Merchant wallet:** starts at **0 EGP**

When a `FLOWMERCE_WALLET` payment is made:
1. `WalletSimulationAdapter` calls `walletService.debitCustomer()` — balance check + debit
2. Calls `walletService.creditMerchant()` — credit
3. Both operations record a `WalletTransaction` row (type, reference, balance-after, description)

Refunds reverse the wallet movement: `creditCustomer` + `debitMerchant`.

### 2.4 RabbitMQ Events

Exchange: `flowmerce.payment` (topic)

| Routing Key | Trigger |
|---|---|
| `payment.initiated` | Any payment created in PENDING/PROCESSING state |
| `payment.succeeded` | Wallet payment completed, or merchant confirms COD/bank |
| `payment.failed` | Gateway returns failure |
| `payment.refunded` | Merchant issues a refund |
| `wallet.debited` | (reserved, wired in config) |
| `wallet.credited` | (reserved, wired in config) |

Two durable queues:
- `payment.notifications` — binds `payment.*` and `wallet.*`
- `payment.webhooks` — binds `payment.*`

RabbitMQ publish is non-critical: a publish failure logs a warning but does not roll back the transaction.

### 2.5 SSE Notifications

In addition to RabbitMQ, `SseService.sendAccountActivity()` is called for real-time browser notifications:
- Buyer: "Payment of X EGP completed/failed for order #N"
- Merchant: "Payment of X EGP received for order #N"

---

## 3. New Files

### Entities
| File | Table |
|---|---|
| `entity/Payment.java` | `payments` (extended existing table) |
| `entity/Wallet.java` | `wallets` (new) |
| `entity/WalletTransaction.java` | `wallet_transactions` (new) |

### Repository
| File | Key Query Methods |
|---|---|
| `repository/PaymentRepository.java` | `findByOrder_OrderId`, `findByIdempotencyKey` |
| `repository/WalletRepository.java` | `findByCustomer_CustomerId`, `findByMerchant_MerchantId` |
| `repository/WalletTransactionRepository.java` | `findByWallet_WalletIdOrderByCreatedAtDesc` |

### Gateway Adapters
- `gateway/PaymentGatewayAdapter.java` — interface
- `gateway/GatewayResult.java` — result DTO
- `gateway/CashOnDeliveryAdapter.java`
- `gateway/BankTransferAdapter.java`
- `gateway/WalletSimulationAdapter.java`
- `gateway/StripeAdapter.java` — stub with TODO
- `gateway/PaymobAdapter.java` — stub with TODO
- `gateway/FawryAdapter.java` — stub with TODO

### Services & Config
- `service/PaymentServiceImpl.java` — main orchestrator
- `service/WalletService.java` — wallet CRUD + debit/credit
- `event/PaymentEventPublisher.java` — RabbitMQ publisher
- `config/PaymentRabbitMQConfig.java` — exchange + queues

### DTOs
- `dto/PaymentDTOs.java` — all request/response DTOs incl. `OrderPlaceResponse`

### Controllers
- `controller/PaymentController.java` — 5 endpoints
- `controller/WalletController.java` — 5 endpoints

---

## 4. Modified Files

| File | Change |
|---|---|
| `OrderManagement/controller/OrderController.java` | `placeOrder` now calls `paymentService.initiatePayment` and returns `OrderPlaceResponse` |
| `CartManagement/dto/CartDTOs.java` | Added `idempotencyKey` field to `CheckoutRequest` |
| `PaymentManagement/dto/PaymentDTOs.java` | Added `@Builder` to `InitiatePaymentRequest` |
| `pom.xml` | Added `spring-boot-starter-amqp` runtime dependency |
| `application.properties` | Added RabbitMQ connection config + payment gateway env vars |
| `FlowMerce.postman_collection.json` | Added Orders (8), Payments (5), Wallets (5) requests |

---

## 5. API Endpoints

### Orders (`/api/orders`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/orders/place` | BUYER | Checkout + auto-payment (returns order + payment) |
| GET | `/api/orders/me` | BUYER | My order history |
| GET | `/api/orders/{orderId}` | BUYER | Order detail |
| POST | `/api/orders/{orderId}/cancel` | BUYER | Cancel order |
| GET | `/api/orders/store/{storeId}` | MERCHANT | Store order list |
| GET | `/api/orders/store/{storeId}/{orderId}` | MERCHANT | Store order detail |
| PUT | `/api/orders/{orderId}/status` | MERCHANT | Update order status |
| GET | `/api/orders/admin/all` | ADMIN | Paginated all orders |

### Payments (`/payments`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/initiate` | BUYER | Initiate payment for existing order |
| GET | `/payments/{paymentId}` | Any | Get payment detail |
| GET | `/payments/order/{orderId}` | Any | Get payment by order |
| POST | `/payments/{paymentId}/confirm` | MERCHANT | Confirm COD / bank transfer |
| POST | `/payments/{paymentId}/refund` | MERCHANT | Issue partial or full refund |

### Wallets (`/wallets`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/wallets/me` | BUYER | My wallet balance |
| POST | `/wallets/me/topup` | BUYER | Simulation top-up |
| GET | `/wallets/me/transactions` | BUYER | My transaction history |
| GET | `/wallets/store/{storeId}` | MERCHANT | Store wallet balance |
| GET | `/wallets/store/{storeId}/transactions` | MERCHANT | Store transaction history |

---

## 6. Payment Flow (Happy Path — Wallet)

```
POST /api/orders/place  { storeId, shippingAddress, paymentMethod: "FLOWMERCE_WALLET" }
  1. CheckoutService.processCheckout()
     ├─ Validate stock  (throws if insufficient)
     └─ Reserve stock in Redis atomically
  2. OrderService.createOrder()
     ├─ Persist Order + OrderItems
     ├─ Generate Invoice (INV-YYYY-NNNNN)
     └─ Confirm stock (Redis reservation → DB sold)
  3. PaymentServiceImpl.initiatePayment()
     ├─ Idempotency check (Redis)
     ├─ Save Payment [PENDING]
     ├─ WalletSimulationAdapter.process()
     │   ├─ walletService.debitCustomer()   → customer balance ↓
     │   └─ walletService.creditMerchant()  → merchant balance ↑
     ├─ Update Payment [COMPLETED] + paidAt
     ├─ Cache idempotency key (24h)
     ├─ publishSucceeded() → RabbitMQ
     └─ SSE notifications → buyer + merchant

Response: { order: {...}, payment: { status: "COMPLETED", ... } }
```

---

## 7. Connecting Real Gateways

To activate a real gateway, set the corresponding environment variable and implement the stub:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...

# Paymob
PAYMOB_API_KEY=...

# Fawry
FAWRY_MERCHANT_CODE=...
FAWRY_SECURITY_KEY=...
```

Each adapter file has `// TODO` comments marking the exact integration points. No other code changes are required.

---

## 8. Known Limitations

- The `OrderController` path is `/api/orders/...` (with `/api` prefix) but all other controllers use the context-path `/api/v1` without double prefix. This path was carried from the original implementation and works as-is; a future cleanup could normalise the mapping.
- Stripe / Paymob / Fawry adapters return `FAILED` when keys are missing — no redirect URL is generated. Frontend should check `payment.status` and `payment.failureReason`.
- Wallet balances are not concurrency-locked beyond Hibernate optimistic locking. For production, `SELECT ... FOR UPDATE` or a Redis distributed lock should be added to `debitCustomer`.
