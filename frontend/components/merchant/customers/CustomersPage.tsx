'use client'

import { buildCustomersFromSummaries } from '@/lib/local-store/customers-from-summaries'
import { useMerchantAuth } from '@/store/auth-store'
import { orderService } from '@/services/order.service'
import { useIsMobile } from '@/hooks/use-mobile'
import { useEffect, useMemo, useState } from 'react'
import type { MerchantCustomerSummary } from '@/types/order.types'
import {
  SEGMENT_CONFIG,
  STATUS_CONFIG,
  type CustomerRow,
  type CustomerSegment,
  type CustomerSortKey,
} from './customers-types'
import { C } from './customers-styles'

const SEGMENT_FILTERS: Array<'all' | CustomerSegment> = [
  'all',
  'loyal',
  'regular',
  'new',
  'at_risk',
]

function segmentInsightText(c: CustomerRow): string {
  const seg = SEGMENT_CONFIG[c.segment]
  const extra =
    c.segment === 'loyal'
      ? 'High-value customer. Consider VIP perks or early access.'
      : c.segment === 'regular'
        ? 'Consistent buyer. A loyalty discount could push them to loyal.'
        : c.segment === 'new'
          ? 'New customer. Follow up with a welcome offer.'
          : 'No recent activity. Send a re-engagement campaign.'
  return `${seg.desc} — ${extra}`
}

function CustomerDrawer({
  customer,
  onClose,
}: {
  customer: CustomerRow | null
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  if (!customer) return null
  const seg = SEGMENT_CONFIG[customer.segment]
  const sta = STATUS_CONFIG[customer.status]
  const initials = customer.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const avgOrder = customer.orders > 0 ? Math.round(customer.totalSpent / customer.orders) : 0

  return (
    <>
      <div style={C.backdrop} onClick={onClose} role="presentation" />
      <div style={{ ...C.drawer, ...(isMobile ? { width: '100vw', left: 0 } : {}) }}>
        <div style={C.drawerHead}>
          <div style={C.drawerAvatar}>{initials}</div>
          <div style={{ flex: 1 }}>
            <p style={C.drawerName}>{customer.name}</p>
            <p style={C.drawerEmail}>{customer.email}</p>
          </div>
          <button type="button" style={C.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div style={C.drawerBadgeRow}>
          <span style={{ ...C.pill, background: sta.bg, color: sta.color }}>{sta.label}</span>
          <span style={{ ...C.pill, background: seg.bg, color: seg.color }}>{seg.label}</span>
        </div>

        <div style={C.drawerMetrics}>
          {(
            [
              { label: 'Total Spent', value: `${customer.totalSpent.toLocaleString()} EGP` },
              { label: 'Total Orders', value: String(customer.orders) },
              { label: 'Avg Order', value: `${avgOrder.toLocaleString()} EGP` },
            ] as const
          ).map((m, i) => (
            <div key={i} style={C.drawerMetricCard}>
              <p style={C.drawerMetricLabel}>{m.label}</p>
              <p style={C.drawerMetricValue}>{m.value}</p>
            </div>
          ))}
        </div>

        <div style={C.drawerSection}>
          <p style={C.sectionTitle}>Contact Info</p>
          {(
            [
              ['Phone', customer.phone],
              ['City', customer.city],
              ['Member since', customer.joinDate],
              ['Last order', customer.lastOrder],
            ] as const
          ).map(([k, v]) => (
            <div key={k} style={C.infoRow}>
              <span style={C.infoKey}>{k}</span>
              <span style={C.infoVal}>{v}</span>
            </div>
          ))}
        </div>

        <div style={C.drawerSection}>
          <p style={C.sectionTitle}>Segment Insight</p>
          <p style={C.segInsight}>{segmentInsightText(customer)}</p>
        </div>
      </div>
    </>
  )
}

export function CustomersPage() {
  const auth = useMerchantAuth()
  const [summaries, setSummaries] = useState<MerchantCustomerSummary[] | null>(null)

  useEffect(() => {
    if (!auth.storeId) return
    let cancelled = false
    orderService.getStoreCustomers(auth.storeId, auth.getAuthHeader()).then((r) => {
      if (cancelled || !r.ok) return
      setSummaries(r.data)
    })
    return () => { cancelled = true }
  }, [auth.storeId, auth.getAuthHeader])

  const customers = useMemo(() => buildCustomersFromSummaries(summaries ?? []), [summaries])

  const [search, setSearch] = useState('')
  const [segFilter, setSegFilter] = useState<(typeof SEGMENT_FILTERS)[number]>('all')
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const [sortBy, setSortBy] = useState<CustomerSortKey>('totalSpent')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const newThisMonth = customers.filter((c) => {
      const t = Date.parse(c.joinDate)
      return Number.isFinite(t) && t >= startOfMonth
    }).length

    return {
      total: customers.length,
      vip: customers.filter((c) => c.status === 'vip').length,
      newThisMonth,
      atRisk: customers.filter((c) => c.segment === 'at_risk').length,
      revenue: customers.reduce((s, c) => s + c.totalSpent, 0),
    }
  }, [customers])

  const filtered = useMemo(() => {
    let r = customers
    if (segFilter !== 'all') r = r.filter((c) => c.segment === segFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) => {
      const va = a[sortBy]
      const vb = b[sortBy]
      if (typeof va === 'number' && typeof vb === 'number') {
        if (va < vb) return sortDir === 'asc' ? -1 : 1
        if (va > vb) return sortDir === 'asc' ? 1 : -1
        return 0
      }
      const sa = String(va)
      const sb = String(vb)
      if (sa < sb) return sortDir === 'asc' ? -1 : 1
      if (sa > sb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [customers, search, segFilter, sortBy, sortDir])

  const handleSort = (col: CustomerSortKey) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const SortIco = ({ col }: { col: CustomerSortKey }) => (
    <span style={{ fontSize: 10, color: sortBy === col ? '#B5905A' : '#CCC', marginLeft: 3 }}>
      {sortBy !== col ? '⇅' : sortDir === 'asc' ? '↑' : '↓'}
    </span>
  )

  const columns: { key: CustomerSortKey; label: string }[] = [
    { key: 'name', label: 'Customer' },
    { key: 'city', label: 'City' },
    { key: 'orders', label: 'Orders' },
    { key: 'totalSpent', label: 'Total Spent' },
    { key: 'lastOrder', label: 'Last Order' },
    { key: 'segment', label: 'Segment' },
    { key: 'status', label: 'Status' },
  ]

  return (
    <div style={C.page}>
      <div style={C.statsGrid}>
        {(
          [
            { label: 'Total Customers', value: String(stats.total), color: null as string | null },
            { label: 'VIP Customers', value: String(stats.vip), color: '#854F0B' },
            { label: 'New This Month', value: String(stats.newThisMonth), color: null },
            { label: 'At Risk', value: String(stats.atRisk), color: '#A32D2D' },
            {
              label: 'Lifetime Value',
              value: `${stats.revenue.toLocaleString()} EGP`,
              color: '#B5905A',
            },
          ] as const
        ).map((s, i) => (
          <div key={i} style={C.statCard}>
            <p style={C.statLabel}>{s.label}</p>
            <p style={{ ...C.statValue, ...(s.color ? { color: s.color } : {}) }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={C.toolbar}>
        <input
          style={C.searchInput}
          placeholder="Search name, email, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers"
        />
        <div style={C.segTabs}>
          {SEGMENT_FILTERS.map((seg) => (
            <button
              key={seg}
              type="button"
              style={{ ...C.segTab, ...(segFilter === seg ? C.segTabActive : {}) }}
              onClick={() => setSegFilter(seg)}
            >
              {seg === 'all'
                ? 'All'
                : seg === 'at_risk'
                  ? 'At Risk'
                  : seg.charAt(0).toUpperCase() + seg.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={C.tableWrap}>
        <div style={{ overflowX: 'auto' }}>
        <table style={C.table}>
          <thead>
            <tr style={C.thead}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ ...C.th, cursor: 'pointer' }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIco col={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={C.emptyRow}>
                  {customers.length === 0
                    ? 'No customers yet — they will appear here once your store receives its first order.'
                    : 'No customers match your filters.'}
                </td>
              </tr>
            )}
            {filtered.map((c, i) => {
              const seg = SEGMENT_CONFIG[c.segment]
              const sta = STATUS_CONFIG[c.status]
              const initials = c.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
              return (
                <tr
                  key={c.id}
                  style={{ ...C.tr, ...(i % 2 !== 0 ? C.trAlt : {}) }}
                  onClick={() => setSelected(c)}
                >
                  <td style={C.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={C.miniAvatar}>{initials}</div>
                      <div>
                        <p style={C.custName}>{c.name}</p>
                        <p style={C.custEmail}>{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...C.td, color: '#888' }}>{c.city}</td>
                  <td style={{ ...C.td, fontWeight: 600 }}>{c.orders}</td>
                  <td style={{ ...C.td, fontWeight: 600, color: '#B5905A' }}>
                    {c.totalSpent.toLocaleString()} EGP
                  </td>
                  <td style={{ ...C.td, color: '#AAA' }}>{c.lastOrder}</td>
                  <td style={C.td}>
                    <span style={{ ...C.pill, background: seg.bg, color: seg.color }}>{seg.label}</span>
                  </td>
                  <td style={C.td}>
                    <span style={{ ...C.pill, background: sta.bg, color: sta.color }}>{sta.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
