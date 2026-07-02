import type { CatalogCategory } from '@/components/merchant/onboarding/types'
import type { OrderRow } from '@/components/merchant/orders/orders-data'
import { periodChangePct } from './analytics-from-orders'

export type MetricComputed = {
  value: number
  change: number
  label: string
  unit: string
}

export type ChartPoint = { day: string; revenue: number; orders: number }

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function computeMetrics(orders: OrderRow[]): Record<string, MetricComputed> {
  const revenue = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((s, o) => s + o.amount, 0)
  const orderCount = orders.length
  const customers = new Set(orders.map((o) => o.email)).size

  const revenueChange = Math.round((periodChangePct(orders, 7, 'revenue') ?? 0) * 10) / 10
  const ordersChange = Math.round((periodChangePct(orders, 7, 'orders') ?? 0) * 10) / 10

  return {
    revenue: { value: revenue, change: revenueChange, label: 'Total Revenue', unit: 'EGP' },
    orders: { value: orderCount, change: ordersChange, label: 'Total Orders', unit: '' },
    customers: { value: customers, change: 0, label: 'Customers', unit: '' },
    conversion: { value: 0, change: 0, label: 'Conversion Rate', unit: '%' },
  }
}

/** Last 7 calendar days (rolling), matched by `order.date` (YYYY-MM-DD). */
export function buildChartFromOrders(orders: OrderRow[]): ChartPoint[] {
  const result: ChartPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const label = WEEKDAY_SHORT[d.getDay()]
    const dayOrders = orders.filter((o) => o.date === iso)
    const revenue = dayOrders
      .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
      .reduce((s, o) => s + o.amount, 0)
    result.push({ day: label, revenue, orders: dayOrders.length })
  }
  return result
}

export type TopProductRow = {
  name: string
  category: string
  stock: number
  sales: number
  revenue: number
}

export function topProductsFromCategories(categories: CatalogCategory[], limit = 4): TopProductRow[] {
  const rows: TopProductRow[] = []
  for (const c of categories) {
    for (const p of c.products) {
      const price = Number(p.price) || 0
      const sales = p.sales ?? 0
      const stock = p.stock ?? 0
      rows.push({
        name: p.name,
        category: c.name,
        stock,
        sales,
        revenue: price * sales,
      })
    }
  }
  return rows.sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}
