import type { BackendOrderStatus } from '@/types/order.types'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type OrderRow = {
  id: string
  customer: string
  email: string
  product: string
  items: number
  /** Subtotal before shipping and tax. */
  amount: number
  /** INT-43: real shipping cost from backend (0 if unknown / summary-only). */
  shipping?: number
  /** INT-43: real tax from backend (0 if unknown / summary-only). */
  tax?: number
  status: OrderStatus
  payment: string
  date: string
  address: string
}

export const STATUS_CONFIG: Record<
  OrderStatus,
  { bg: string; color: string; border: string; label: string; icon: string }
> = {
  pending:   { bg: '#FAEEDA', color: '#854F0B', border: '#EF9F27', label: 'Pending',   icon: '◎' },
  confirmed: { bg: '#FFF9E6', color: '#7A6200', border: '#D4A903', label: 'Confirmed', icon: '✓' },
  shipped:   { bg: '#E6F1FB', color: '#185FA5', border: '#378ADD', label: 'Shipped',   icon: '▷' },
  delivered: { bg: '#EAF3DE', color: '#3B6D11', border: '#639922', label: 'Delivered', icon: '✓' },
  cancelled: { bg: '#FCEBEB', color: '#A32D2D', border: '#E24B4A', label: 'Cancelled', icon: '×' },
  refunded:  { bg: '#EEEDFE', color: '#534AB7', border: '#7F77DD', label: 'Refunded',  icon: '↩' },
}

export const ALL_STATUSES = [
  'all',
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:   'confirmed',
  confirmed: 'shipped',
  shipped:   'delivered',
}

// ── Backend ↔ Frontend status mapping ────────────────────────────────────────

export function backendToFrontendStatus(s: BackendOrderStatus): OrderStatus {
  switch (s) {
    case 'PENDING':   return 'pending'
    case 'CONFIRMED': return 'confirmed'
    case 'SHIPPED':   return 'shipped'
    case 'DELIVERED': return 'delivered'
    case 'CANCELLED': return 'cancelled'
  }
}

/** Returns null for 'refunded' since backend has no refunded order status. */
export function frontendToBackendStatus(s: OrderStatus): BackendOrderStatus | null {
  switch (s) {
    case 'pending':   return 'PENDING'
    case 'confirmed': return 'CONFIRMED'
    case 'shipped':   return 'SHIPPED'
    case 'delivered': return 'DELIVERED'
    case 'cancelled': return 'CANCELLED'
    case 'refunded':  return null
  }
}
