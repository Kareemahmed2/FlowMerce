/**
 * Dev / fallback: derive customer metrics from `flowmerce_orders_v1`.
 * Replace with GET /merchants/customers (or similar) when the backend is ready.
 */

import type { OrderRow } from '@/components/merchant/orders/orders-data'
import type {
  CustomerRow,
  CustomerSegment,
  CustomerStatus,
} from '@/components/merchant/customers/customers-types'

const STALE_DAYS_AT_RISK = 90
const INACTIVE_DAYS = 180
const VIP_MIN_SPENT = 5000
const VIP_MIN_ORDERS = 10

const EGYPT_CITIES = [
  'Cairo',
  'Alexandria',
  'Giza',
  'Sharm El Sheikh',
  'Luxor',
  'Aswan',
  'Mansoura',
  'Tanta',
  'Assiut',
  'Zagazig',
  'Ismailia',
  'Port Said',
  'Suez',
  'Hurghada',
]

function parseTime(dateStr: string): number {
  const t = Date.parse(dateStr)
  return Number.isFinite(t) ? t : NaN
}

function formatYmd(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

function daysBetween(a: number, b: number): number {
  return Math.floor(Math.abs(a - b) / (24 * 60 * 60 * 1000))
}

function cityFromAddress(address: string): string {
  const a = address.trim()
  if (!a) return '—'
  const lower = a.toLowerCase()
  for (const c of EGYPT_CITIES) {
    if (lower.includes(c.toLowerCase())) return c
  }
  const parts = a.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length) return parts[parts.length - 1]!
  return '—'
}

function stableCustomerId(email: string): string {
  const e = email.toLowerCase().trim()
  let h = 2166136261
  for (let i = 0; i < e.length; i++) {
    h ^= e.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `cust_${(h >>> 0).toString(16)}`
}

function countsTowardRevenue(o: OrderRow): boolean {
  return o.status !== 'cancelled' && o.status !== 'refunded'
}

function deriveSegmentAndStatus(
  orderCount: number,
  totalSpent: number,
  lastOrderTime: number | undefined,
  now: number
): { segment: CustomerSegment; status: CustomerStatus } {
  const last = lastOrderTime
  let segment: CustomerSegment
  let status: CustomerStatus

  if (last !== undefined && Number.isFinite(last)) {
    const stale = daysBetween(now, last) >= STALE_DAYS_AT_RISK
    if (stale) {
      segment = 'at_risk'
    } else if (orderCount >= 7) {
      segment = 'loyal'
    } else if (orderCount >= 3) {
      segment = 'regular'
    } else {
      segment = 'new'
    }

    const veryOld = daysBetween(now, last) >= INACTIVE_DAYS
    if (veryOld) {
      status = 'inactive'
    } else if (totalSpent >= VIP_MIN_SPENT || orderCount >= VIP_MIN_ORDERS) {
      status = 'vip'
    } else {
      status = 'active'
    }
  } else {
    segment = orderCount >= 3 ? 'regular' : 'new'
    status = totalSpent >= VIP_MIN_SPENT || orderCount >= VIP_MIN_ORDERS ? 'vip' : 'active'
  }

  return { segment, status }
}

/**
 * Aggregate orders by customer email into {@link CustomerRow} rows.
 */
export function buildCustomersFromOrders(orders: OrderRow[], nowMs: number = Date.now()): CustomerRow[] {
  const byEmail = new Map<string, OrderRow[]>()
  for (const o of orders) {
    const key = o.email.toLowerCase().trim()
    if (!key) continue
    const list = byEmail.get(key) ?? []
    list.push(o)
    byEmail.set(key, list)
  }

  const rows: CustomerRow[] = []

  for (const [, list] of byEmail) {
    const email = list[0]!.email
    const times = list.map((o) => parseTime(o.date)).filter((t) => Number.isFinite(t))
    const minT = times.length ? Math.min(...times) : NaN
    const maxT = times.length ? Math.max(...times) : NaN

    const sortedByDate = [...list].sort((a, b) => parseTime(b.date) - parseTime(a.date))
    const name = sortedByDate[0]?.customer ?? list[0]!.customer

    const orderCount = list.length
    const totalSpent = list.filter(countsTowardRevenue).reduce((s, o) => s + o.amount, 0)

    const lastOrder =
      Number.isFinite(maxT) ? formatYmd(maxT) : '—'
    const joinDate = Number.isFinite(minT) ? formatYmd(minT) : '—'

    const { segment, status } = deriveSegmentAndStatus(
      orderCount,
      totalSpent,
      Number.isFinite(maxT) ? maxT : undefined,
      nowMs
    )

    const city = cityFromAddress(sortedByDate[0]?.address ?? list[0]!.address)

    rows.push({
      id: stableCustomerId(email),
      name,
      email,
      phone: '—',
      city,
      orders: orderCount,
      totalSpent,
      lastOrder,
      joinDate,
      status,
      segment,
    })
  }

  return rows
}
