'use client'

import {
  buildChartFromOrders,
  computeMetrics,
  topProductsFromCategories,
} from '@/lib/local-store/dashboard-metrics'
import { useMerchantAuth } from '@/store/auth-store'
import { orderService } from '@/services/order.service'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { OrderRow } from '../orders/orders-data'
import { STATUS_CONFIG } from '../orders/orders-data'
import { S } from './dashboard-styles'
import { RevenueChart } from './RevenueChart'

function MetricCard({
  value,
  change,
  label,
  unit,
  active,
  onClick,
}: {
  value: number
  change: number
  label: string
  unit: string
  active: boolean
  onClick: () => void
}) {
  const positive = change >= 0
  return (
    <div style={{ ...S.metricCard, ...(active ? S.metricCardActive : {}) }} onClick={onClick}>
      <p style={S.metricLabel}>{label}</p>
      <p style={S.metricValue}>
        {unit === 'EGP' ? `${value.toLocaleString()} ` : value.toLocaleString()}
        <span style={S.metricUnit}>{unit === 'EGP' ? 'EGP' : unit}</span>
      </p>
      <p style={{ ...S.metricChange, color: positive ? '#3B6D11' : '#A32D2D' }}>
        {positive ? '▲' : '▼'} {Math.abs(change)}% vs last week
      </p>
    </div>
  )
}

function recentOrdersForOverview(orders: OrderRow[]): OrderRow[] {
  return [...orders]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5)
}

export function DashboardOverview() {
  const auth = useMerchantAuth()
  const isMobile = useIsMobile()
  const [liveOrders, setLiveOrders] = useState<OrderRow[] | null>(null)
  const [activeMetric, setActiveMetric] = useState<string>('revenue')

  useEffect(() => {
    if (!auth.storeId) return
    let cancelled = false

    orderService.getStoreOrders(auth.storeId, auth.getAuthHeader()).then((result) => {
      if (cancelled || !result.ok) return
      // Map backend MerchantOrderSummary[] → OrderRow[] for metric/chart helpers
      const rows: OrderRow[] = (result.data as import('@/types/order.types').MerchantOrderSummary[]).map((o) => ({
        id: String(o.orderId),
        customer: o.storeName ?? 'Customer',
        email: '',
        product: '',
        amount: o.total,
        total: o.total,
        status: (o.status?.toLowerCase() ?? 'pending') as OrderRow['status'],
        date: o.orderDate ? new Date(o.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        items: o.itemCount ?? 0,
        payment: 'cod',
        address: '',
      }))
      setLiveOrders(rows)
    })

    return () => { cancelled = true }
  }, [auth.storeId, auth.getAuthHeader])

  const orders = liveOrders ?? []

  const metrics = useMemo(() => computeMetrics(orders), [orders])
  const chart = useMemo(() => buildChartFromOrders(orders), [orders])
  const topProducts = useMemo(() => topProductsFromCategories([]), [])
  const recent = useMemo(() => recentOrdersForOverview(orders), [orders])

  const chartTotal =
    activeMetric === 'revenue'
      ? `${chart.reduce((s, d) => s + d.revenue, 0).toLocaleString()} EGP`
      : `${chart.reduce((s, d) => s + d.orders, 0)} orders`

  const maxTopRev = Math.max(1, ...topProducts.map((x) => x.revenue))

  const mobileGridOverride = isMobile
    ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : {}
  const mobileStackOverride = isMobile ? { gridTemplateColumns: '1fr' } : {}

  return (
    <>
      <div style={{ ...S.metricsGrid, ...mobileGridOverride }}>
        {Object.entries(metrics).map(([key, m]) => (
          <MetricCard
            key={key}
            value={m.value}
            change={m.change}
            label={m.label}
            unit={m.unit}
            active={activeMetric === key}
            onClick={() => setActiveMetric(key)}
          />
        ))}
      </div>

      <div style={{ ...S.middleRow, ...mobileStackOverride }}>
        <div style={S.chartCard}>
          <div style={S.chartHeader}>
            <div>
              <p style={S.cardTitle}>Revenue this week</p>
              <p style={S.cardSub}>Click a metric above to switch view (local data)</p>
            </div>
            <p style={S.chartTotal}>{chartTotal}</p>
          </div>
          <RevenueChart data={chart} activeMetric={activeMetric} />
          <div style={S.chartDays}>
            {chart.map((d, i) => (
              <span key={i} style={S.chartDay}>
                {d.day}
              </span>
            ))}
          </div>
        </div>

        <div style={S.alertsCard}>
          <div style={S.alertsHeader}>
            <p style={S.cardTitle}>✦ AI Insights</p>
            <span style={S.alertBadge}>0</span>
          </div>
          <div style={S.alertsList}>
            <p style={{ ...S.cardSub, margin: 0, padding: '8px 0' }}>
              No AI insights yet. Data will come from your backend when the API is connected.
            </p>
          </div>
        </div>
      </div>

      <div style={{ ...S.bottomRow, ...mobileStackOverride }}>
        <div style={S.ordersCard}>
          <div style={S.sectionHeader}>
            <p style={S.cardTitle}>Recent Orders</p>
            <Link href="/dashboard/orders" style={S.viewAllBtn}>
              View all →
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Order', 'Customer', 'Product', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} style={S.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#AAA', padding: 24 }}>
                    No orders yet. Orders you add (or sync from the API later) will appear here.
                  </td>
                </tr>
              )}
              {recent.map((order) => {
                const st = STATUS_CONFIG[order.status]
                return (
                  <tr key={order.id} style={S.tr}>
                    <td style={{ ...S.td, ...S.orderId }}>{order.id}</td>
                    <td style={S.td}>{order.customer}</td>
                    <td style={{ ...S.td, color: '#555' }}>{order.product}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{order.amount.toLocaleString()} EGP</td>
                    <td style={S.td}>
                      <span style={{ ...S.statusBadge, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#AAA' }}>{order.date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>

        <div style={S.productsCard}>
          <div style={S.sectionHeader}>
            <p style={S.cardTitle}>Top Products</p>
            <Link href="/dashboard/products" style={S.viewAllBtn}>
              Manage →
            </Link>
          </div>
          {topProducts.length === 0 ? (
            <p style={{ ...S.cardSub, margin: 0, padding: '12px 0' }}>
              No products yet. Add categories and products in Onboarding or Products.
            </p>
          ) : (
            <div style={S.productList}>
              {topProducts.map((p, i) => {
                const pct = Math.round((p.revenue / maxTopRev) * 100)
                return (
                  <div key={p.name + i} style={S.productRow}>
                    <div style={S.productRank}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.productMeta}>
                        <span style={S.productName}>{p.name}</span>
                        <span style={S.productCategory}>{p.category}</span>
                      </div>
                      <div style={S.productBar}>
                        <div style={{ ...S.productBarFill, width: `${pct}%` }} />
                      </div>
                      <div style={S.productStats}>
                        <span style={S.productStat}>{p.sales} sold</span>
                        <span style={S.productStat}>{p.stock} in stock</span>
                        <span style={{ ...S.productStat, color: '#B5905A', fontWeight: 600 }}>
                          {p.revenue.toLocaleString()} EGP
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
