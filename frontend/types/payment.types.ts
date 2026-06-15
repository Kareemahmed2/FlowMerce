/**
 * Payment types — aligned with Spring Boot PaymentManagement module.
 * Keep in sync with: PaymentDTOs.java, PaymentGatewayAdapter.java
 *
 * TODO(BACKEND-INTEGRATION): Validate enums and field names against actual responses.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

/**
 * Canonical payment method strings — matched by the backend gateway adapters.
 * These are the ONLY strings the backend recognises for payment processing.
 * Use these when storing the merchant's enabled methods and when placing orders.
 */
export type BackendPaymentMethod =
  | 'STRIPE'
  | 'PAYMOB'
  | 'FAWRY_PAY'
  | 'BANK_TRANSFER'
  | 'INSTAPAY'
  | 'COD'
  | 'FLOWMERCE_WALLET'

/** Alias kept for backwards compatibility with existing usages. */
export type FrontendPaymentMethod = BackendPaymentMethod

/** Display config for each gateway — used in settings and checkout UI. */
export const PAYMENT_METHOD_CONFIG: Record<
  BackendPaymentMethod,
  { label: string; subtitle: string; icon: string; category: 'online' | 'cash' | 'transfer' | 'wallet' }
> = {
  STRIPE:           { label: 'Credit / Debit Card',  subtitle: 'Visa, Mastercard, Amex via Stripe',       icon: '💳', category: 'online'   },
  PAYMOB:           { label: 'Paymob',               subtitle: 'Egyptian cards and online payments',      icon: '🏧', category: 'online'   },
  FAWRY_PAY:        { label: 'Fawry',                subtitle: 'Cash payments at Fawry outlets',          icon: '🧾', category: 'cash'     },
  BANK_TRANSFER:    { label: 'Bank Transfer',         subtitle: 'Manual transfer to IBAN / account',      icon: '🏦', category: 'transfer' },
  INSTAPAY:         { label: 'InstaPay',             subtitle: 'Instant bank transfers via InstaPay',     icon: '⚡', category: 'transfer' },
  COD:              { label: 'Cash on Delivery',      subtitle: 'Customer pays on delivery',              icon: '💵', category: 'cash'     },
  FLOWMERCE_WALLET: { label: 'FlowMerce Wallet',     subtitle: 'Deduct from customer digital wallet',     icon: '💰', category: 'wallet'   },
}

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'

/** Returns the backend string for a method value (handles both old lowercase and new uppercase). */
export function toBackendPaymentMethod(method: string): BackendPaymentMethod {
  const upper = method.toUpperCase()
  // Map legacy lowercase frontend keys to canonical backend strings
  const legacyMap: Record<string, BackendPaymentMethod> = {
    STRIPE: 'STRIPE', CREDIT_CARD: 'STRIPE',
    PAYMOB: 'PAYMOB',
    FAWRY: 'FAWRY_PAY', FAWRY_PAY: 'FAWRY_PAY', FAWRYPAY: 'FAWRY_PAY',
    BANK_TRANSFER: 'BANK_TRANSFER',
    INSTAPAY: 'INSTAPAY',
    COD: 'COD', CASH_ON_DELIVERY: 'COD',
    FLOWMERCE_WALLET: 'FLOWMERCE_WALLET', WALLET: 'FLOWMERCE_WALLET',
    E_WALLET: 'FLOWMERCE_WALLET', MEEZA: 'FLOWMERCE_WALLET',
  }
  return legacyMap[upper] ?? 'COD'
}

/** Lookup display label — falls back gracefully for unknown strings. */
export function getPaymentMethodLabel(method: string): string {
  const config = PAYMENT_METHOD_CONFIG[toBackendPaymentMethod(method)]
  return config?.label ?? method
}

// ── Payment entity ────────────────────────────────────────────────────────────

export interface PaymentResponse {
  paymentId: number
  orderId: number
  amount: number
  paymentMethod: BackendPaymentMethod
  /** CON-3/INT-15: backend serializes this field as `status` (not `paymentStatus`). */
  status: PaymentStatus
  /** ISO 4217 currency code (e.g. EGP, USD). */
  currency: string | null
  /** Gateway identifier used to process the payment. */
  gateway: string | null
  /** Gateway-provided transaction reference (Stripe charge ID, Paymob order ID, etc.) */
  transactionReference: string | null
  /** Hosted payment page URL — redirect buyer here for card/online payments */
  redirectUrl: string | null
  /** Populated when status is FAILED. */
  failureReason: string | null
  /** ISO timestamp of successful payment, if completed. */
  paidAt: string | null
  /** ISO timestamp */
  createdAt: string
}

// ── Requests ──────────────────────────────────────────────────────────────────

/** POST /payments/initiate */
export interface InitiatePaymentRequest {
  orderId: number
  amount: number
  paymentMethod: BackendPaymentMethod
  /** UUID — used by backend for idempotency (prevents double charges on retry) */
  idempotencyKey: string
}

/** POST /payments/{paymentId}/confirm — merchant confirms COD or bank transfer */
export interface ConfirmPaymentRequest {
  reference?: string
  note?: string
}

/** POST /payments/{paymentId}/refund */
export interface RefundRequest {
  amount: number
  reason: string
}

// ── Status display config ──────────────────────────────────────────────────────

export interface PaymentStatusConfig {
  label: string
  bg: string
  color: string
  border: string
}

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, PaymentStatusConfig> = {
  PENDING:             { label: 'Pending',             bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  PROCESSING:          { label: 'Processing',          bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  COMPLETED:           { label: 'Completed',           bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  FAILED:              { label: 'Failed',              bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  REFUNDED:            { label: 'Refunded',            bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  PARTIALLY_REFUNDED:  { label: 'Partial Refund',      bg: '#fdf4ff', color: '#86198f', border: '#f0abfc' },
}
