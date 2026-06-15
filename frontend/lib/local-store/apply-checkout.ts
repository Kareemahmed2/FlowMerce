import type { OrderRow } from '@/components/merchant/orders/orders-data'
import type { CatalogCategory, CatalogProduct } from '@/components/merchant/onboarding/types'
import { loadOrders, saveOrders } from './orders'
import type { PersistedStorePayload } from './store'
import { loadPersistedStore, savePersistedStore } from './store'
import { storeEvents } from '@/lib/store-events'

export type CheckoutCartLine = {
  product: CatalogProduct
  quantity: number
}

export type CheckoutFormSnapshot = {
  firstName: string
  lastName: string
  email: string
  address: string
  city: string
  paymentMethod: string
}

/**
 * Validates cart lines against persisted catalog, decrements stock where tracked,
 * persists the store, and appends a merchant order row.
 */
export function completeCheckoutFromCart(
  lines: CheckoutCartLine[],
  form: CheckoutFormSnapshot,
  totals: { subtotal: number; shipping: number; total: number }
): { ok: true } | { ok: false; message: string } {
  if (typeof window === 'undefined') {
    return { ok: false, message: 'Checkout is only available in the browser.' }
  }

  const payload = loadPersistedStore()
  if (!payload) {
    return { ok: false, message: 'Store data is not available.' }
  }

  const categories: CatalogCategory[] = payload.categories.map((cat) => ({
    ...cat,
    products: cat.products.map((p) => ({ ...p })),
  }))

  const findProduct = (id: number): { c: number; p: number } | null => {
    for (let ci = 0; ci < categories.length; ci++) {
      const pi = categories[ci].products.findIndex((x) => x.id === id)
      if (pi >= 0) return { c: ci, p: pi }
    }
    return null
  }

  for (const line of lines) {
    const loc = findProduct(line.product.id)
    if (!loc) {
      return {
        ok: false,
        message: `Product "${line.product.name}" is no longer available.`,
      }
    }
    const p = categories[loc.c].products[loc.p]
    const tracked = p.stock !== undefined
    if (tracked && (p.stock ?? 0) < line.quantity) {
      return {
        ok: false,
        message: `Not enough stock for "${p.name}". Only ${p.stock} left.`,
      }
    }
  }

  for (const line of lines) {
    const loc = findProduct(line.product.id)
    if (!loc) continue
    const p = categories[loc.c].products[loc.p]
    if (p.stock !== undefined) {
      const nextStock = Math.max(0, (p.stock ?? 0) - line.quantity)
      categories[loc.c].products[loc.p] = { ...p, stock: nextStock }
    }
  }

  const nextPayload: PersistedStorePayload = { ...payload, categories }
  savePersistedStore(nextPayload)

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)
  const order: OrderRow = {
    id: `ORD-${Date.now()}`,
    customer: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    email: form.email.trim(),
    product: lines.map((l) => l.product.name).join(', '),
    items: itemCount,
    amount: totals.total,
    status: 'pending',
    payment: form.paymentMethod,
    date: new Date().toISOString().slice(0, 10),
    address: `${form.address.trim()}, ${form.city.trim()}`,
  }

  const orders = loadOrders()
  saveOrders([order, ...orders])

  // Notify listeners (orders page, analytics) without tight coupling
  storeEvents.dispatch('orderCreated', { orderId: order.id, total: order.amount })

  return { ok: true }
}
