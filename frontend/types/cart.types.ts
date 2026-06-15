/**
 * Cart & Checkout types — aligned with Spring Boot CartManagement module.
 * Keep in sync with: CartDTOs.java, CheckoutService.java
 *
 * TODO(BACKEND-INTEGRATION): Validate field names against actual JSON responses.
 */

import type { BackendPaymentMethod } from '@/types/payment.types'

// ── Cart item (server-persisted) ───────────────────────────────────────────────

export interface CartItemResponse {
  /** Backend-assigned PK — needed for PUT /cart/items/{cartItemId} */
  cartItemId: number
  productId: number
  productName: string
  productImage: string | null
  quantity: number
  /** Price snapshotted at time of add — not affected by later price changes */
  priceAtAdd: number
  /** Backend field name: subtotal (priceAtAdd × quantity) */
  subtotal: number
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export interface CartResponse {
  cartId: number
  storeId: number
  customerId: number
  items: CartItemResponse[]
  /** Backend field name: totalItems */
  totalItems: number
  subtotal: number
  /** ISO timestamp — cart expires if idle */
  expiresAt: string | null
}

// ── Checkout summary (from POST /cart/checkout) ───────────────────────────────

export interface CheckoutSummary {
  items: CartItemResponse[]
  subtotal: number
  tax: number
  shippingCost: number
  total: number
  paymentMethod: BackendPaymentMethod
  shippingAddress: string
  billingAddress: string
}

// ── Requests ──────────────────────────────────────────────────────────────────

/** POST /cart/items */
export interface AddToCartRequest {
  productId: number
  quantity: number
}

/** PUT /cart/items/{cartItemId} */
export interface UpdateQuantityRequest {
  quantity: number
}

/** POST /cart/checkout */
export interface CartCheckoutRequest {
  shippingAddress: string
  paymentMethod: string
  notes?: string
}

// ── Payment method types ───────────────────────────────────────────────────────
// Canonical definitions live in payment.types.ts — re-exported here so cart
// consumers can import from a single location without creating a circular dep.

export type { BackendPaymentMethod, FrontendPaymentMethod } from '@/types/payment.types'
