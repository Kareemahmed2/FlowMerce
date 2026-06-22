/**
 * Customer-facing order types.
 *
 * These are distinct from the merchant-facing `OrderRow` (orders-data.ts):
 *  - `OrderRow` is the persistence model (minimal, shared with the merchant dashboard).
 *  - `CustomerOrder` is the presentation model (rich, scoped to the storefront).
 *
 * TODO(BACKEND-INTEGRATION): Align with the Spring Boot OrderController DTOs.
 * The status union intentionally includes 'confirmed' and 'processing' — states
 * that the backend lifecycle supports even though the current localStorage mock
 * only uses the five legacy OrderRow statuses.
 */

import type { PaginationMeta } from '@/lib/pagination'
import type { BackendPaymentMethod } from '@/types/payment.types'

// ── Status enums ───────────────────────────────────────────────────────────────

export type CustomerOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export const CUSTOMER_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const satisfies readonly CustomerOrderStatus[]

/**
 * Frontend-facing payment status for customer order display.
 * Distinct from BackendPaymentStatus ('PENDING'|'COMPLETED'|...) in payment.types.ts
 * which mirrors the backend PaymentStatus enum directly.
 */
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial'

/** @deprecated Use OrderPaymentStatus — renamed to avoid collision with payment.types.ts PaymentStatus */
export type PaymentStatus = OrderPaymentStatus

export type FulfillmentStatus =
  | 'unfulfilled'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'cancelled'

// ── Status display config ──────────────────────────────────────────────────────

export interface StatusConfig {
  label: string
  bg: string
  color: string
  border: string
  /** Single-glyph icon for compact badge rendering. */
  icon: string
}

/**
 * Single source of truth for status colors and labels.
 * No status rendering should happen outside of OrderStatusBadge.
 * Immutable — add new statuses by extending this record.
 */
export const ORDER_STATUS_CONFIG: Record<CustomerOrderStatus, StatusConfig> = {
  pending:    { label: 'Pending',    bg: '#FAEEDA', color: '#854F0B', border: '#EF9F27', icon: '◎' },
  confirmed:  { label: 'Confirmed',  bg: '#FFF9E6', color: '#7A6200', border: '#D4A903', icon: '✓' },
  processing: { label: 'Processing', bg: '#EFF6FF', color: '#1D4ED8', border: '#3B82F6', icon: '⟳' },
  shipped:    { label: 'Shipped',    bg: '#E6F1FB', color: '#185FA5', border: '#378ADD', icon: '▷' },
  delivered:  { label: 'Delivered',  bg: '#EAF3DE', color: '#3B6D11', border: '#639922', icon: '✓' },
  cancelled:  { label: 'Cancelled',  bg: '#FCEBEB', color: '#A32D2D', border: '#E24B4A', icon: '×' },
  refunded:   { label: 'Refunded',   bg: '#EEEDFE', color: '#534AB7', border: '#7F77DD', icon: '↩' },
}

// ── Sub-entities ───────────────────────────────────────────────────────────────

export interface OrderItem {
  /** null for legacy orders where productId was not stored at checkout time. */
  productId: number | null
  productName: string
  categoryName: string
  unitPrice: number
  quantity: number
  totalPrice: number
  imageUrl: string | null
}

export interface OrderAddress {
  fullName: string
  street: string
  city: string
  country: string
}

export interface OrderPaymentSummary {
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  paymentStatus: PaymentStatus
}

export interface OrderShipment {
  carrier: string | null
  trackingNumber: string | null
  estimatedDelivery: string | null
  shippedAt: string | null
}

// ── Timeline ───────────────────────────────────────────────────────────────────

export type TimelineEventStatus = 'completed' | 'current' | 'pending' | 'skipped'

export interface OrderTimelineEvent {
  id: string
  /** The order status milestone this event represents. */
  orderStatus: CustomerOrderStatus
  label: string
  description: string
  /** ISO timestamp — null for future/pending events. */
  timestamp: string | null
  eventStatus: TimelineEventStatus
}

// ── Full order ─────────────────────────────────────────────────────────────────

export interface CustomerOrder {
  id: string
  /** Human-readable order number, e.g. "#10042". */
  orderNumber: string
  customerName: string
  customerEmail: string
  status: CustomerOrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  items: OrderItem[]
  shippingAddress: OrderAddress
  paymentSummary: OrderPaymentSummary
  shipment: OrderShipment
  timeline: OrderTimelineEvent[]
  placedAt: string
  updatedAt: string
  /** Order can be cancelled by the customer (only when pending/confirmed). */
  canCancel: boolean
  canReorder: boolean
}

// ── List item (summary for cards) ──────────────────────────────────────────────

/** Lighter shape used on the orders list page — avoids loading full item details. */
export interface OrderListItem {
  id: string
  orderNumber: string
  status: CustomerOrderStatus
  placedAt: string
  total: number
  itemCount: number
  /** e.g. "Red T-Shirt" or "Red T-Shirt + 2 more" */
  itemPreview: string
  paymentMethod: string
  canCancel: boolean
}

// ── Filter / sort ──────────────────────────────────────────────────────────────

export type OrderSortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

export const ORDER_SORT_OPTIONS = [
  'date_desc',
  'date_asc',
  'amount_desc',
  'amount_asc',
] as const satisfies readonly OrderSortOption[]

export const ORDER_SORT_LABELS: Record<OrderSortOption, string> = {
  date_desc:   'Newest First',
  date_asc:    'Oldest First',
  amount_desc: 'Amount: High to Low',
  amount_asc:  'Amount: Low to High',
}

export type OrderStatusFilter = CustomerOrderStatus | 'all'

export interface OrderFilterState {
  status: OrderStatusFilter
  sort: OrderSortOption
  page: number
  pageSize: number
}

export const DEFAULT_ORDER_FILTER: Readonly<OrderFilterState> = {
  status: 'all',
  sort: 'date_desc',
  page: 1,
  pageSize: 10,
}

/** URL param key → filter field mapping (mirrors search.types.ts pattern). */
export const ORDER_PARAM_KEYS = ['status', 'sort', 'page', 'size'] as const
export type OrderParamKey = (typeof ORDER_PARAM_KEYS)[number]

// ── Merchant order types (mirror backend OrderDTOs.java) ──────────────────────

/** Backend Order.OrderStatus enum — UPPERCASE in JSON */
export type BackendOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export const BACKEND_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const satisfies readonly BackendOrderStatus[]

/** Returned by GET /orders/store/{storeId} and GET /orders/me */
export interface MerchantOrderSummary {
  orderId: number
  status: BackendOrderStatus
  total: number
  itemCount: number
  orderDate: string
  storeName: string
}

/** Returned by GET /orders/store/{storeId}/customers — one row per distinct customer. */
export interface MerchantCustomerSummary {
  customerId: number
  name: string
  email: string
  phone: string | null
  lastShippingAddress: string | null
  ordersCount: number
  totalSpent: number
  lastOrderDate: string
  joinDate: string
}

export interface MerchantOrderItemResponse {
  orderItemId: number
  productId: number
  productName: string
  quantity: number
  price: number
  discount: number
  tax: number
  subtotal: number
}

/** Returned by GET /orders/store/{storeId}/{orderId} */
export interface MerchantOrderResponse {
  orderId: number
  customerId: number
  customerName: string
  storeId: number
  storeName: string
  status: BackendOrderStatus
  items: MerchantOrderItemResponse[]
  subtotal: number
  tax: number
  shippingCost: number
  total: number
  shippingAddress: string
  billingAddress: string
  paymentMethod: string
  invoiceNumber: string
  orderDate: string
}

export interface UpdateOrderStatusRequest {
  status: BackendOrderStatus
}

// ── Place order ────────────────────────────────────────────────────────────────

export interface PlaceOrderRequest {
  storeId: number
  items: Array<{ productId: number; quantity: number }>
  shippingAddress: {
    fullName: string
    street: string
    city: string
    country: string
  }
  phone: string
  paymentMethod: BackendPaymentMethod
  notes?: string
  /** Optional idempotency key — auto-generated in live mode if not provided */
  idempotencyKey?: string
}

/**
 * Backend stores `shippingAddress` / `billingAddress` as plain `String` columns.
 * Frontend sends a structured object (stringified on the wire), reads a string back.
 * This helper safely parses either a JSON-stringified object or a free-form string.
 */
export function parseOrderAddress(raw: string | null | undefined): {
  fullName?: string
  street?: string
  city?: string
  country?: string
  raw: string
} {
  const safe = raw ?? ''
  if (!safe) return { raw: '' }
  // Try JSON first (the format we POST in D2)
  try {
    const parsed = JSON.parse(safe)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      return {
        fullName: typeof obj.fullName === 'string' ? obj.fullName : undefined,
        street:   typeof obj.street   === 'string' ? obj.street   : undefined,
        city:     typeof obj.city     === 'string' ? obj.city     : undefined,
        country:  typeof obj.country  === 'string' ? obj.country  : undefined,
        raw: safe,
      }
    }
  } catch {
    /* not JSON — fall through */
  }
  // Fall back: comma-split (legacy "street, city, country" format)
  const parts = safe.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      street: parts[0],
      city: parts[1],
      country: parts[2],
      raw: safe,
    }
  }
  return { raw: safe }
}

/** Format a parsed address back to a human-readable single-line string. */
export function formatOrderAddress(raw: string | null | undefined): string {
  const a = parseOrderAddress(raw)
  const lines = [a.fullName, a.street, [a.city, a.country].filter(Boolean).join(', ')].filter(Boolean)
  return lines.length > 0 ? lines.join(' · ') : a.raw
}

export interface OrderConfirmationResponse {
  orderId: string
  orderNumber: string
  status: CustomerOrderStatus
  total: number
  paymentMethod: BackendPaymentMethod
  /** Non-null for online payments — redirect customer to gateway */
  redirectUrl: string | null
}

// ── Response types ─────────────────────────────────────────────────────────────

export interface OrderListResponse {
  orders: OrderListItem[]
  pagination: PaginationMeta
  totalOrders: number
}

export interface OrderDetailsResponse {
  order: CustomerOrder
}

// ── Hook return type ───────────────────────────────────────────────────────────

export interface UseCustomerOrdersReturn {
  filters: OrderFilterState
  status: 'idle' | 'loading' | 'success' | 'error'
  response: OrderListResponse | null
  error: string
  hasOrders: boolean
  hasActiveFilters: boolean
  setStatusFilter: (status: OrderStatusFilter) => void
  setSort: (sort: OrderSortOption) => void
  goToPage: (page: number) => void
  resetFilters: () => void
  refreshOrders: () => void
  cancelOrder: (orderId: string) => Promise<{ ok: boolean; message?: string }>
  reorder: (orderId: string) => Promise<{ ok: boolean; addedCount: number; message?: string }>
}
