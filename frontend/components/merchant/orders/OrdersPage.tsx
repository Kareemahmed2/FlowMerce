'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMerchantAuth } from '@/store/auth-store'
import { orderService } from '@/services/order.service'
import type { MerchantOrderResponse, MerchantOrderSummary } from '@/types/order.types'
import { formatOrderAddress } from '@/types/order.types'
import {
  ALL_STATUSES,
  NEXT_STATUS,
  STATUS_CONFIG,
  backendToFrontendStatus,
  frontendToBackendStatus,
  type OrderRow,
  type OrderStatus,
} from './orders-data'
import { O } from './orders-styles'

// ── Backend → OrderRow mappers ───────────────────────────────────────────────

function summaryToRow(s: MerchantOrderSummary): OrderRow {
  return {
    id: `ORD-${s.orderId}`,
    customer: `Customer #${s.orderId}`,
    email: '',
    product: s.itemCount === 1 ? '1 item' : `${s.itemCount} items`,
    items: s.itemCount,
    amount: Number(s.total),
    shipping: 0,  // not available in summary — will be replaced when detail loads
    tax: 0,
    status: backendToFrontendStatus(s.status),
    payment: '—',
    date: s.orderDate,
    address: '',
  }
}

function detailToRow(d: MerchantOrderResponse): OrderRow {
  const productNames = d.items.map((i) => i.productName)
  const preview =
    productNames.length === 0
      ? 'Order'
      : productNames.length === 1
        ? productNames[0]
        : `${productNames[0]} +${productNames.length - 1} more`
  return {
    id: `ORD-${d.orderId}`,
    customer: d.customerName,
    email: '',
    product: preview,
    items: d.items.reduce((s, i) => s + i.quantity, 0),
    // INT-43: use subtotal (before shipping+tax) so the drawer line items add up correctly
    amount: Number(d.subtotal ?? d.total),
    shipping: Number(d.shippingCost ?? 0),
    tax: Number(d.tax ?? 0),
    status: backendToFrontendStatus(d.status),
    payment: d.paymentMethod,
    date: d.orderDate,
    address: formatOrderAddress(d.shippingAddress),
  }
}

type SortKey = 'id' | 'customer' | 'product' | 'amount' | 'date' | 'payment'

function OrderDrawer({
  order,
  onClose,
  onStatusChange,
}: {
  order: OrderRow | null
  onClose: () => void
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
}) {
  if (!order) return null
  const st = STATUS_CONFIG[order.status]
  const next = NEXT_STATUS[order.status]

  return (
    <>
      <div style={O.backdrop} onClick={onClose} role="presentation" />
      <div style={O.drawer}>
        <div style={O.drawerHeader}>
          <div>
            <p style={O.drawerOrderId}>{order.id}</p>
            <p style={O.drawerDate}>{order.date}</p>
          </div>
          <button type="button" style={O.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={{ ...O.drawerStatusBanner, background: st.bg, borderLeft: `4px solid ${st.border}` }}>
          <span style={{ color: st.color, fontSize: 14 }}>{st.icon}</span>
          <div>
            <p style={{ ...O.drawerStatusLabel, color: st.color }}>Order Status</p>
            <p style={{ ...O.drawerStatusValue, color: st.color }}>{st.label}</p>
          </div>
          {next && (
            <button
              type="button"
              style={{ ...O.markBtn, background: st.border, color: '#fff' }}
              onClick={() => onStatusChange(order.id, next)}
            >
              Mark as {STATUS_CONFIG[next].label} →
            </button>
          )}
        </div>

        <div style={O.drawerSection}>
          <p style={O.drawerSectionTitle}>Customer</p>
          <div style={O.drawerRow}>
            <div style={O.customerAvatar}>
              {order.customer
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <p style={O.drawerCustomerName}>{order.customer}</p>
              <p style={O.drawerCustomerEmail}>{order.email}</p>
            </div>
          </div>
          <p style={O.drawerAddress}>📍 {order.address}</p>
        </div>

        <div style={O.drawerSection}>
          <p style={O.drawerSectionTitle}>Items</p>
          <div style={O.drawerItemCard}>
            <div style={O.drawerItemThumb} />
            <div style={{ flex: 1 }}>
              <p style={O.drawerItemName}>{order.product}</p>
              <p style={O.drawerItemMeta}>Qty: {order.items}</p>
            </div>
            <p style={O.drawerItemPrice}>{order.amount.toLocaleString()} EGP</p>
          </div>
        </div>

        <div style={O.drawerSection}>
          <p style={O.drawerSectionTitle}>Payment</p>
          <div style={O.drawerPaymentRows}>
            {(
              [
                ['Method', order.payment],
                ['Subtotal', `${order.amount.toLocaleString()} EGP`],
                // INT-43: use real shipping + tax from backend (not hardcoded 50 EGP / 14%)
                ['Shipping', `${(order.shipping ?? 0).toLocaleString()} EGP`],
                ['Tax', `${(order.tax ?? 0).toLocaleString()} EGP`],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} style={O.drawerPayRow}>
                <span style={O.drawerPayKey}>{k}</span>
                <span style={O.drawerPayVal}>{v}</span>
              </div>
            ))}
            <div
              style={{
                ...O.drawerPayRow,
                borderTop: '1px solid #E8E4DE',
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <span style={{ ...O.drawerPayKey, fontWeight: 700, color: '#0F0E0C' }}>Total</span>
              <span style={{ ...O.drawerPayVal, fontWeight: 700, color: '#B5905A', fontSize: 15 }}>
                {(order.amount + (order.shipping ?? 0) + (order.tax ?? 0)).toLocaleString()} EGP
              </span>
            </div>
          </div>
        </div>

        {(order.status === 'delivered' || order.status === 'shipped') && (
          <div style={O.drawerActions}>
            <button type="button" style={O.actionBtnSecondary}>
              🧾 Download Invoice
            </button>
            {order.status === 'delivered' && (
              <button
                type="button"
                style={O.actionBtnDanger}
                onClick={() => onStatusChange(order.id, 'refunded')}
              >
                ↩ Refund Order
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export function OrdersPage() {
  const auth = useMerchantAuth()
  const storeId = auth.storeId

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = async () => {
    if (storeId === null) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const result = await orderService.getStoreOrders(storeId, auth.getAuthHeader())
    if (result.ok) {
      setOrders(result.data.map(summaryToRow))
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  const [activeFilter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelected] = useState<OrderRow | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const PER_PAGE = 8

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      shipped: orders.filter((o) => o.status === 'shipped').length,
      revenue: orders
        .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
        .reduce((s, o) => s + o.amount, 0),
    }
  }, [orders])

  const filtered = useMemo(() => {
    let res = orders
    if (activeFilter !== 'all') {
      res = res.filter((o) => o.status === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      res = res.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q)
      )
    }
    res = [...res].sort((a, b) => {
      let va: string | number = a[sortBy] as string | number
      let vb: string | number = b[sortBy] as string | number
      if (sortBy === 'amount') {
        va = a.amount
        vb = b.amount
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return res
  }, [orders, activeFilter, search, sortBy, sortDir])

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const backendStatus = frontendToBackendStatus(newStatus)
    if (backendStatus === null) {
      // 'refunded' has no backend equivalent — bail out (refund flow is in PaymentsPage).
      return
    }
    const numericId = Number(orderId.replace('ORD-', ''))

    // Optimistic update
    const previous = orders
    const next = orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    setOrders(next)
    setSelected((prev) => (prev?.id === orderId ? { ...prev, status: newStatus } : prev))

    const result = await orderService.updateOrderStatus(
      numericId,
      { status: backendStatus },
      auth.getAuthHeader()
    )
    if (!result.ok) {
      // Rollback on failure
      setOrders(previous)
      setSelected((prev) =>
        prev?.id === orderId
          ? { ...prev, status: previous.find((o) => o.id === orderId)?.status ?? prev.status }
          : prev
      )
      setError(result.error)
    }
  }

  // Fetch full order details when a row is opened.
  const handleSelectOrder = async (row: OrderRow) => {
    setSelected(row) // open drawer immediately with summary data
    if (storeId === null) return
    const numericId = Number(row.id.replace('ORD-', ''))
    const result = await orderService.getStoreOrderDetails(
      storeId,
      numericId,
      auth.getAuthHeader()
    )
    if (result.ok) {
      const enriched = detailToRow(result.data)
      setSelected((prev) => (prev?.id === row.id ? enriched : prev))
      setOrders((prev) => prev.map((o) => (o.id === row.id ? enriched : o)))
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortBy !== col ? (
      <span style={O.sortIcon}>⇅</span>
    ) : (
      <span style={{ ...O.sortIcon, color: '#B5905A' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
    )

  const columns: { key: SortKey | 'status' | 'payment' | 'actions'; label: string; sortable: boolean }[] =
    [
      { key: 'id', label: 'Order ID', sortable: true },
      { key: 'customer', label: 'Customer', sortable: true },
      { key: 'product', label: 'Product', sortable: true },
      { key: 'amount', label: 'Amount', sortable: true },
      { key: 'status', label: 'Status', sortable: false },
      { key: 'payment', label: 'Payment', sortable: true },
      { key: 'date', label: 'Date', sortable: true },
      { key: 'actions', label: '', sortable: false },
    ]

  if (storeId === null) {
    return (
      <div style={{ ...O.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#0F0E0C' }}>
            No store yet
          </p>
          <p style={{ fontSize: 13, color: '#888' }}>
            Finish creating your store to start receiving orders.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ ...O.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid #e9ecef', borderTopColor: '#0F0E0C', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...O.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div role="alert" style={{ textAlign: 'center', maxWidth: 480, background: '#FCEBEB', color: '#A32D2D', borderRadius: 12, padding: 24, border: '1px solid #F7C1C1' }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>Could not load orders</p>
          <p style={{ fontSize: 13, margin: '0 0 14px' }}>{error}</p>
          <button type="button" style={O.filterTab} onClick={() => void loadAll()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={O.page}>
      <div style={O.summaryStrip}>
        {[
          { label: 'Total Orders', value: stats.total, unit: '', accent: false },
          { label: 'Pending', value: stats.pending, unit: '', accent: stats.pending > 0 },
          { label: 'In Transit', value: stats.shipped, unit: '', accent: false },
          { label: 'Revenue', value: stats.revenue.toLocaleString(), unit: 'EGP', accent: false },
        ].map((s, i) => (
          <div key={i} style={O.summaryCard}>
            <p style={O.summaryLabel}>{s.label}</p>
            <p style={{ ...O.summaryValue, ...(s.accent ? { color: '#854F0B' } : {}) }}>
              {s.value} <span style={O.summaryUnit}>{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div style={O.toolbar}>
        <div style={O.filterTabs}>
          {ALL_STATUSES.map((f) => {
            const count =
              f === 'all' ? orders.length : orders.filter((o) => o.status === f).length
            return (
              <button
                key={f}
                type="button"
                style={{ ...O.filterTab, ...(activeFilter === f ? O.filterTabActive : {}) }}
                onClick={() => {
                  setFilter(f)
                  setPage(1)
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span
                  style={{
                    ...O.filterCount,
                    ...(activeFilter === f ? O.filterCountActive : {}),
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <input
          style={O.searchInput}
          placeholder="Search order, customer, product…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div style={O.tableWrap}>
        <table style={O.table}>
          <thead>
            <tr style={O.thead}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    ...O.th,
                    ...(col.sortable ? { cursor: 'pointer' } : {}),
                  }}
                  onClick={() => col.sortable && handleSort(col.key as SortKey)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {col.sortable && <SortIcon col={col.key as SortKey} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={8} style={O.emptyRow}>
                  No orders found
                </td>
              </tr>
            )}
            {paginated.map((order, i) => {
              const st = STATUS_CONFIG[order.status]
              const nextSt = NEXT_STATUS[order.status]
              return (
                <tr
                  key={order.id}
                  style={{ ...O.tr, ...(i % 2 === 0 ? {} : O.trAlt) }}
                  onClick={() => handleSelectOrder(order)}
                >
                  <td style={{ ...O.td, ...O.orderId }}>{order.id}</td>
                  <td style={O.td}>
                    <div style={O.customerCell}>
                      <div style={O.miniAvatar}>
                        {order.customer
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p style={O.customerName}>{order.customer}</p>
                        <p style={O.customerEmail}>{order.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={O.td}>{order.product}</td>
                  <td style={{ ...O.td, fontWeight: 600 }}>{order.amount.toLocaleString()} EGP</td>
                  <td style={O.td}>
                    <span style={{ ...O.statusPill, background: st.bg, color: st.color }}>
                      {st.icon} {st.label}
                    </span>
                  </td>
                  <td style={{ ...O.td, color: '#666' }}>{order.payment}</td>
                  <td style={{ ...O.td, color: '#AAA' }}>{order.date}</td>
                  <td style={O.td} onClick={(e) => e.stopPropagation()}>
                    <div style={O.rowActions}>
                      <button
                        type="button"
                        style={O.rowBtn}
                        onClick={() => handleSelectOrder(order)}
                        title="View details"
                      >
                        ⊙
                      </button>
                      {nextSt && (
                        <button
                          type="button"
                          style={{
                            ...O.rowBtn,
                            color: STATUS_CONFIG[nextSt].color,
                          }}
                          onClick={() => handleStatusChange(order.id, nextSt)}
                          title={`Mark as ${nextSt}`}
                        >
                          ▷
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={O.pagination}>
          <span style={O.paginationInfo}>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div style={O.paginationBtns}>
            <button
              type="button"
              style={O.pageBtn}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ←
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
              <button
                key={p}
                type="button"
                style={{ ...O.pageBtn, ...(p === page ? O.pageBtnActive : {}) }}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              style={O.pageBtn}
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </button>
          </div>
        </div>
      )}

      <OrderDrawer
        order={selectedOrder}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
