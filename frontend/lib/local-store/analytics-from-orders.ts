/**
 * Analytics derived from `flowmerce_orders_v1` for local dev.
 * Replace with backend analytics / events when Spring Boot is connected.
 */

import type { OrderRow } from '@/components/merchant/orders/orders-data'

export type AnalyticsPeriod = '7d' | '30d'

export type DailyPoint = {
  label: string
  revenue: number
  orders: number
  /** Rough sessions proxy: orders × multiplier (until real traffic exists) */
  visitors: number
  /** orders / visitors × 100 for the day */
  conversion: number
}

export type TopProductRow = {
  name: string
  revenue: number
  sales: number
  /** Not available from orders alone */
  views: null
  conversion: null
}

export type FunnelStep = {
  label: string
  value: number
  pct: number
}

export type PaymentSplitRow = {
  method: string
  pct: number
  color: string
}

const PAYMENT_COLORS = ['#B5905A', '#185FA5', '#3B6D11', '#534AB7', '#854F0B', '#185050']

function countsTowardRevenue(o: OrderRow): boolean {
  return o.status !== 'cancelled' && o.status !== 'refunded'
}

function parseOrderTime(dateStr: string): number {
  const t = Date.parse(dateStr)
  return Number.isFinite(t) ? t : NaN
}

/** Start of local calendar day */
function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function formatDayLabel(d: Date, shortWeekday: boolean): string {
  if (shortWeekday) {
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const VISITOR_ESTIMATE_PER_ORDER = 20

/**
 * Last `dayCount` calendar days ending yesterday (or today inclusive — use last N days including today).
 * User expectation: "Last 7 days" = rolling window. Use inclusive of today.
 */
export function getRollingDayRanges(dayCount: number): { start: Date; end: Date } {
  const end = startOfDay(new Date())
  const start = startOfDay(addDays(end, -(dayCount - 1)))
  return { start, end }
}

export function filterOrdersInRange(orders: OrderRow[], start: Date, end: Date): OrderRow[] {
  const s = start.getTime()
  const e = end.getTime() + 24 * 60 * 60 * 1000 - 1
  return orders.filter((o) => {
    const t = parseOrderTime(o.date)
    return Number.isFinite(t) && t >= s && t <= e
  })
}

export function buildDailySeries(
  orders: OrderRow[],
  dayCount: 7 | 30,
  shortWeekdayLabels: boolean
): DailyPoint[] {
  const { start, end } = getRollingDayRanges(dayCount)
  const inRange = filterOrdersInRange(orders, start, end)

  const points: DailyPoint[] = []
  for (let i = 0; i < dayCount; i++) {
    const day = startOfDay(addDays(start, i))
    const dayStart = day.getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1

    const dayOrders = inRange.filter((o) => {
      const t = parseOrderTime(o.date)
      return Number.isFinite(t) && t >= dayStart && t <= dayEnd
    })

    const revenue = dayOrders.filter(countsTowardRevenue).reduce((s, o) => s + o.amount, 0)
    const orderN = dayOrders.length
    const visitors = Math.max(orderN * VISITOR_ESTIMATE_PER_ORDER, orderN > 0 ? orderN + 5 : 0)
    const conversion = visitors > 0 ? Math.round((orderN / visitors) * 10000) / 100 : 0

    points.push({
      label: formatDayLabel(day, shortWeekdayLabels),
      revenue,
      orders: orderN,
      visitors,
      conversion,
    })
  }

  return points
}

export function sumDaily(points: DailyPoint[]): {
  revenue: number
  orders: number
  visitors: number
} {
  return points.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.revenue,
      orders: acc.orders + p.orders,
      visitors: acc.visitors + p.visitors,
    }),
    { revenue: 0, orders: 0, visitors: 0 }
  )
}

export function conversionPercent(orders: number, visitors: number): string {
  if (visitors <= 0) return '0.0'
  return ((orders / visitors) * 100).toFixed(1)
}

export function aggregateTotalsForRange(orders: OrderRow[], start: Date, end: Date) {
  const slice = filterOrdersInRange(orders, start, end)
  const revenue = slice.filter(countsTowardRevenue).reduce((s, o) => s + o.amount, 0)
  const orderN = slice.length
  const visitors = Math.max(orderN * VISITOR_ESTIMATE_PER_ORDER, orderN > 0 ? orderN + 5 : 0)
  return { revenue, orders: orderN, visitors }
}

/** Compare current window vs previous window of same length */
function periodConversionRate(orders: OrderRow[], start: Date, end: Date): number {
  const t = aggregateTotalsForRange(orders, start, end)
  if (t.visitors <= 0) return 0
  return (t.orders / t.visitors) * 100
}

export function periodChangePct(
  orders: OrderRow[],
  dayCount: 7 | 30,
  field: 'revenue' | 'orders' | 'visitors' | 'conversion'
): number | null {
  const { start: curStart } = getRollingDayRanges(dayCount)
  const curEnd = startOfDay(new Date())
  const prevEnd = addDays(curStart, -1)
  const prevStart = addDays(curStart, -dayCount)

  if (field === 'conversion') {
    const a = periodConversionRate(orders, curStart, curEnd)
    const b = periodConversionRate(orders, prevStart, prevEnd)
    if (b === 0 && a === 0) return null
    if (b === 0) return null
    return ((a - b) / b) * 100
  }

  const cur = aggregateTotalsForRange(orders, curStart, curEnd)
  const prev = aggregateTotalsForRange(orders, prevStart, prevEnd)

  const a = field === 'revenue' ? cur.revenue : field === 'orders' ? cur.orders : cur.visitors
  const b = field === 'revenue' ? prev.revenue : field === 'orders' ? prev.orders : prev.visitors
  if (b === 0 && a === 0) return null
  if (b === 0) return null
  return ((a - b) / b) * 100
}

export function topProductsFromOrders(orders: OrderRow[], limit = 5): TopProductRow[] {
  const inPeriod = orders.filter((o) => countsTowardRevenue(o))
  const byName = new Map<string, { revenue: number; sales: number }>()
  for (const o of inPeriod) {
    const key = o.product.trim() || 'Unknown'
    const cur = byName.get(key) ?? { revenue: 0, sales: 0 }
    cur.revenue += o.amount
    cur.sales += 1
    byName.set(key, cur)
  }
  return [...byName.entries()]
    .map(([name, v]) => ({
      name,
      revenue: v.revenue,
      sales: v.sales,
      views: null,
      conversion: null,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

/** Funnel estimates tied to order count O (deterministic, not random). */
export function buildFunnelFromOrderCount(orderCount: number): FunnelStep[] {
  const O = Math.max(orderCount, 0)
  if (O === 0) {
    return [
      { label: 'Store Visitors', value: 0, pct: 0 },
      { label: 'Product Views', value: 0, pct: 0 },
      { label: 'Added to Cart', value: 0, pct: 0 },
      { label: 'Checkout Started', value: 0, pct: 0 },
      { label: 'Orders Placed', value: 0, pct: 0 },
    ]
  }

  const visitors = Math.round(O * 24)
  const productViews = Math.round(visitors * 0.62)
  const cart = Math.round(visitors * 0.19)
  const checkout = Math.max(Math.round(visitors * 0.085), O)
  const placed = O

  const V = Math.max(visitors, 1)
  return [
    { label: 'Store Visitors', value: visitors, pct: 100 },
    { label: 'Product Views', value: productViews, pct: Math.round((productViews / V) * 1000) / 10 },
    { label: 'Added to Cart', value: cart, pct: Math.round((cart / V) * 1000) / 10 },
    { label: 'Checkout Started', value: checkout, pct: Math.round((checkout / V) * 1000) / 10 },
    { label: 'Orders Placed', value: placed, pct: Math.round((placed / V) * 1000) / 10 },
  ]
}

export function paymentSplitFromOrders(orders: OrderRow[]): PaymentSplitRow[] {
  const slice = orders.filter((o) => countsTowardRevenue(o))
  const byPay = new Map<string, number>()
  let total = 0
  for (const o of slice) {
    const m = o.payment.trim() || 'Other'
    byPay.set(m, (byPay.get(m) ?? 0) + o.amount)
    total += o.amount
  }
  if (total <= 0) return []

  return [...byPay.entries()]
    .map(([method, amt], i) => ({
      method,
      pct: Math.round((amt / total) * 1000) / 10,
      color: PAYMENT_COLORS[i % PAYMENT_COLORS.length]!,
    }))
    .sort((a, b) => b.pct - a.pct)
}
