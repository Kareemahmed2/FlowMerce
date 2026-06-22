/**
 * Maps backend-aggregated customer summaries (GET /orders/store/{storeId}/customers)
 * into the dashboard's CustomerRow presentation shape — segment/status/city are
 * derived here since the backend only returns raw facts (counts, totals, dates).
 */

import type { MerchantCustomerSummary } from '@/types/order.types'
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

function cityFromAddress(address: string | null): string {
  const a = (address ?? '').trim()
  if (!a) return '—'
  const lower = a.toLowerCase()
  for (const c of EGYPT_CITIES) {
    if (lower.includes(c.toLowerCase())) return c
  }
  const parts = a.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length) return parts[parts.length - 1]!
  return '—'
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

export function buildCustomersFromSummaries(
  summaries: MerchantCustomerSummary[],
  nowMs: number = Date.now()
): CustomerRow[] {
  return summaries.map((s) => {
    const lastT = parseTime(s.lastOrderDate)
    const joinT = parseTime(s.joinDate)

    const { segment, status } = deriveSegmentAndStatus(
      s.ordersCount,
      s.totalSpent,
      Number.isFinite(lastT) ? lastT : undefined,
      nowMs
    )

    return {
      id: String(s.customerId),
      name: s.name,
      email: s.email,
      phone: s.phone ?? '—',
      city: cityFromAddress(s.lastShippingAddress),
      orders: s.ordersCount,
      totalSpent: s.totalSpent,
      lastOrder: Number.isFinite(lastT) ? formatYmd(lastT) : '—',
      joinDate: Number.isFinite(joinT) ? formatYmd(joinT) : '—',
      status,
      segment,
    }
  })
}
