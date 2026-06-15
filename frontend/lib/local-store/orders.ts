import type { OrderRow } from '@/components/merchant/orders/orders-data'

export const STORAGE_KEY_ORDERS = 'flowmerce_orders_v1'

export function loadOrders(): OrderRow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OrderRow[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveOrders(orders: OrderRow[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders))
  window.dispatchEvent(new Event('flowmerce-orders-updated'))
}
