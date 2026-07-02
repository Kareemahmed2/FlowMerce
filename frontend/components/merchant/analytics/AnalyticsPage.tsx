'use client'

import { useMerchantAuth } from '@/store/auth-store'
import { orderService } from '@/services/order.service'
import {
  buildDailySeries,
  buildFunnelFromOrderCount,
  conversionPercent,
  filterOrdersInRange,
  getRollingDayRanges,
  paymentSplitFromOrders,
  periodChangePct,
  sumDaily,
  topProductsFromOrders,
  type AnalyticsPeriod,
} from '@/lib/local-store/analytics-from-orders'
import { useEffect, useMemo, useState } from 'react'
import { A } from './analytics-styles'
import { BarChart, LineChart, type ChartMetric } from './AnalyticsCharts'

type KpiKey = 'revenue' | 'orders' | 'visitors' | 'conversion'

function formatMetricLabel(m: ChartMetric): string {
  if (m === 'conversion') return 'Conversion'
  return m.charAt(0).toUpperCase() + m.slice(1)
}

export function AnalyticsPage() {
  const auth = useMerchantAuth()
  const [liveOrders, setLiveOrders] = useState<import('@/components/merchant/orders/orders-data').OrderRow[] | null>(null)

  useEffect(() => {
    if (!auth.storeId) return
    let cancelled = false
    orderService.getStoreOrders(auth.storeId, auth.getAuthHeader()).then((r) => {
      if (cancelled || !r.ok) return
      import('@/types/order.types').then(() => {
        const rows = (r.data as import('@/types/order.types').MerchantOrderSummary[]).map((o) => ({
          id: String(o.orderId), customer: o.customerName ?? '', email: '', product: '', items: o.itemCount ?? 0,
          amount: o.total, status: (o.status?.toLowerCase() ?? 'pending') as 'pending',
          payment: o.paymentMethod?.toLowerCase() ?? 'cod',
          date: o.orderDate ? new Date(o.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          address: '',
        }))
        if (!cancelled) setLiveOrders(rows as import('@/components/merchant/orders/orders-data').OrderRow[])
      })
    })
    return () => { cancelled = true }
  }, [auth.storeId, auth.getAuthHeader])

  const orders = liveOrders ?? []
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d')
  const [metric, setMetric] = useState<ChartMetric>('revenue')

  const dayCount = period === '7d' ? 7 : 30

  const ordersInPeriod = useMemo(() => {
    const { start, end } = getRollingDayRanges(dayCount)
    return filterOrdersInRange(orders, start, end)
  }, [orders, dayCount])

  const data = useMemo(
    () => buildDailySeries(orders, dayCount, period === '7d'),
    [orders, dayCount, period]
  )

  const totals = useMemo(() => {
    const s = sumDaily(data)
    const conv = conversionPercent(s.orders, s.visitors)
    return {
      revenue: s.revenue,
      orders: s.orders,
      visitors: s.visitors,
      conversion: conv,
    }
  }, [data])

  const topProducts = useMemo(() => topProductsFromOrders(ordersInPeriod, 5), [ordersInPeriod])

  const funnel = useMemo(() => buildFunnelFromOrderCount(ordersInPeriod.length), [ordersInPeriod.length])

  const paymentSplit = useMemo(() => paymentSplitFromOrders(ordersInPeriod), [ordersInPeriod])

  const kpiDefs = useMemo(() => {
    const dc = dayCount
    return [
      {
        key: 'revenue' as const,
        label: 'Revenue',
        value: `${totals.revenue.toLocaleString()} EGP`,
        change: periodChangePct(orders, dc, 'revenue'),
      },
      {
        key: 'orders' as const,
        label: 'Orders',
        value: String(totals.orders),
        change: periodChangePct(orders, dc, 'orders'),
      },
      {
        key: 'visitors' as const,
        label: 'Visitors (est.)',
        value: totals.visitors.toLocaleString(),
        change: periodChangePct(orders, dc, 'visitors'),
      },
      {
        key: 'conversion' as const,
        label: 'Conv. Rate',
        value: `${totals.conversion}%`,
        change: periodChangePct(orders, dc, 'conversion'),
      },
    ]
  }, [orders, totals, dayCount])

  const maxRev = topProducts[0]?.revenue ?? 1

  return (
    <div style={A.page}>
      <p style={{ fontSize: 11, color: '#AAA', margin: 0 }}>
        Data from your orders (localStorage in dev). Connect the backend for live traffic and product views.
      </p>

      <div style={A.periodRow}>
        <div style={A.periodTabs}>
          {(['7d', '30d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              style={{ ...A.periodTab, ...(period === p ? A.periodTabActive : {}) }}
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
      </div>

      <div style={A.kpiRow}>
        {kpiDefs.map((k) => (
          <div
            key={k.key}
            role="button"
            tabIndex={0}
            style={{ ...A.kpiCard, ...(metric === k.key ? A.kpiCardActive : {}) }}
            onClick={() => setMetric(k.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setMetric(k.key)
              }
            }}
          >
            <p style={A.kpiLabel}>{k.label}</p>
            <p style={A.kpiValue}>{k.value}</p>
            <p
              style={{
                ...A.kpiChange,
                color:
                  k.change === null ? '#AAA' : k.change >= 0 ? '#3B6D11' : '#A32D2D',
              }}
            >
              {k.change === null
                ? 'vs prior period —'
                : `${k.change >= 0 ? '▲' : '▼'} ${Math.abs(k.change).toFixed(1)}%`}
            </p>
          </div>
        ))}
      </div>

      <div style={A.chartCard}>
        <div style={A.chartHead}>
          <div>
            <p style={A.cardTitle}>{formatMetricLabel(metric)} over time</p>
            <p style={A.cardSub}>Click a KPI above to switch metric</p>
          </div>
          <div style={A.metricToggle}>
            {(['revenue', 'orders', 'visitors'] as const).map((m) => (
              <button
                key={m}
                type="button"
                style={{ ...A.metricBtn, ...(metric === m ? A.metricBtnActive : {}) }}
                onClick={() => setMetric(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {period === '7d' ? (
          <BarChart data={data} metric={metric} />
        ) : (
          <LineChart data={data} metric={metric} />
        )}
      </div>

      <div style={A.midRow}>
        <div style={A.card}>
          <p style={A.cardTitle}>Top Products</p>
          <p style={A.cardSub}>By revenue in this period</p>
          {topProducts.length === 0 ? (
            <p style={A.emptyHint}>No product sales in this period yet.</p>
          ) : (
            <div style={A.productList}>
              {topProducts.map((p, i) => {
                const pct = Math.round((p.revenue / maxRev) * 100)
                return (
                  <div key={p.name} style={A.productRow}>
                    <span style={A.rank}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={A.productMeta}>
                        <span style={A.productName}>{p.name}</span>
                        <span style={A.productRevenue}>{p.revenue.toLocaleString()} EGP</span>
                      </div>
                      <div style={A.barBg}>
                        <div style={{ ...A.barFill, width: `${pct}%` }} />
                      </div>
                      <div style={A.productStats}>
                        <span style={A.stat}>{p.sales} sold</span>
                        <span style={A.stat}>Views —</span>
                        <span style={{ ...A.stat, color: '#185FA5' }}>Conv. —</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={A.card}>
          <p style={A.cardTitle}>Conversion Funnel</p>
          <p style={A.cardSub}>Estimated from order volume (full analytics via API later)</p>
          <div style={A.funnel}>
            {funnel.map((f, i) => (
              <div key={f.label} style={A.funnelStep}>
                <div style={A.funnelLabelRow}>
                  <span style={A.funnelLabel}>{f.label}</span>
                  <span style={A.funnelValue}>{f.value.toLocaleString()}</span>
                </div>
                <div style={A.funnelBarBg}>
                  <div
                    style={{
                      ...A.funnelBarFill,
                      width: `${f.pct}%`,
                      background: `hsl(${30 + i * 10}, ${60 - i * 4}%, ${45 + i * 3}%)`,
                    }}
                  />
                </div>
                <span style={A.funnelPct}>{f.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={A.bottomRow}>
        <div style={A.card}>
          <div style={A.chartHead}>
            <div>
              <p style={A.cardTitle}>Visitors (est.)</p>
              <p style={A.cardSub}>{totals.visitors.toLocaleString()} this period</p>
            </div>
          </div>
          <LineChart data={data} metric="visitors" color="#185FA5" />
        </div>

        <div style={A.card}>
          <div style={A.chartHead}>
            <div>
              <p style={A.cardTitle}>Orders</p>
              <p style={A.cardSub}>{totals.orders} this period</p>
            </div>
          </div>
          <LineChart data={data} metric="orders" color="#3B6D11" />
        </div>

        <div style={A.card}>
          <p style={A.cardTitle}>Payment Methods</p>
          <p style={A.cardSub}>Revenue split</p>
          {paymentSplit.length === 0 ? (
            <p style={A.emptyHint}>No paid orders in this period.</p>
          ) : (
            <div style={A.paymentList}>
              {paymentSplit.map((p, i) => (
                <div key={`${p.method}-${i}`} style={A.paymentRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: p.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={A.paymentMethod}>{p.method}</span>
                  </div>
                  <div style={{ flex: 1, margin: '0 12px' }}>
                    <div style={A.payBarBg}>
                      <div
                        style={{
                          ...A.payBarFill,
                          width: `${Math.min(p.pct, 100)}%`,
                          background: p.color,
                        }}
                      />
                    </div>
                  </div>
                  <span style={A.paymentPct}>{p.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
