'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminService } from '@/services/admin.service'
import { useMerchantAuth } from '@/store/auth-store'
import { ADMIN_ORDER_STATUS_CONFIG } from '@/types/admin.types'
import type { AdminOrderSummary, AdminOrderStatus } from '@/types/admin.types'
import { getPageNumbers } from '@/lib/pagination'

const PAGE_SIZE = 15

const METHOD_LABELS: Record<string, string> = {
  COD: 'Cash on Delivery', FLOWMERCE_WALLET: 'Wallet', BANK_TRANSFER: 'Bank Transfer',
  STRIPE: 'Stripe', PAYMOB: 'Paymob', FAWRY_PAY: 'Fawry',
}

const S = {
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  search:  { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 14, outline: 'none', fontFamily: 'inherit' } as const,
  table:   { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e9ecef' },
  th:      { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #f0f0f0', background: '#fafafa' },
  td:      { padding: '14px 16px', fontSize: 13, color: '#0F0E0C', borderBottom: '1px solid #f7f7f7' } as const,
  filterBtn: (active: boolean) => ({ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: active ? '2px solid #1e1b4b' : '1px solid #e9ecef', background: active ? '#1e1b4b' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer' }),
  pageBtn: (active: boolean, disabled = false) => ({ minWidth: 36, height: 36, borderRadius: 8, border: active ? '2px solid #1e1b4b' : '1px solid #e9ecef', background: active ? '#1e1b4b' : '#fff', color: active ? '#fff' : disabled ? '#ccc' : '#555', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }),
}

const STATUS_FILTERS: Array<'ALL' | AdminOrderStatus> = ['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']

export default function AdminOrdersPage() {
  const auth = useMerchantAuth()
  const [orders, setOrders] = useState<AdminOrderSummary[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminOrderStatus>('ALL')

  const load = useCallback(async (page: number) => {
    setLoading(true)
    const result = await adminService.getAllOrders(page, PAGE_SIZE, auth.getAuthHeader())
    if (result.ok) {
      setOrders(result.data.content)
      setTotalElements(result.data.totalElements)
      setTotalPages(result.data.totalPages)
      setCurrentPage(result.data.currentPage)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(0) }, [load])

  const displayed = useMemo(() => {
    let result = statusFilter === 'ALL' ? orders : orders.filter((o) => o.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((o) => o.customerEmail.toLowerCase().includes(q) || o.storeName.toLowerCase().includes(q) || String(o.orderId).includes(q))
    }
    return result
  }, [orders, search, statusFilter])

  const pageNumbers = getPageNumbers(currentPage + 1, totalPages)

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e9ecef', minWidth: 140 }}>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Total Orders</p>
          <p style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#1e1b4b' }}>{totalElements.toLocaleString()}</p>
        </div>
        {(['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as AdminOrderStatus[]).map((s) => {
          const cfg = ADMIN_ORDER_STATUS_CONFIG[s]
          return (
            <div key={s} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e9ecef', minWidth: 120 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{cfg.label}</p>
              <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: cfg.color }}>{orders.filter((o) => o.status === s).length}</p>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email, store, order ID…" style={S.search} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.slice(0, 5).map((f) => (
            <button key={f} style={S.filterBtn(statusFilter === f)} onClick={() => setStatusFilter(f)}>
              {f === 'ALL' ? 'All' : ADMIN_ORDER_STATUS_CONFIG[f as AdminOrderStatus]?.label ?? f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e9ecef', borderTopColor: '#1e1b4b', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Order ID', 'Customer', 'Store', 'Items', 'Total', 'Method', 'Status', 'Date'].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#aaa', padding: '40px 0' }}>No orders found.</td></tr>
                ) : displayed.map((o) => {
                  const sc = ADMIN_ORDER_STATUS_CONFIG[o.status] ?? { label: o.status, color: '#888', bg: '#f3f4f6' }
                  return (
                    <tr key={o.orderId} className="admin-tr">
                      <td style={{ ...S.td, fontWeight: 700, color: '#1e1b4b' }}>#{o.orderId}</td>
                      <td style={S.td}>
                        <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 2px' }}>Customer #{o.customerId}</p>
                        <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{o.customerEmail}</p>
                      </td>
                      <td style={{ ...S.td, color: '#555' }}>{o.storeName}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>{o.itemCount}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>
                        EGP {o.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...S.td, fontSize: 12, color: '#888' }}>
                        {METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}
                      </td>
                      <td style={S.td}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>
                        {new Date(o.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button style={S.pageBtn(false, currentPage === 0)} disabled={currentPage === 0} onClick={() => load(currentPage - 1)}>‹</button>
              {pageNumbers.map((p, i) =>
                p === '...'
                  ? <span key={`dots-${i}`} style={{ padding: '0 6px', color: '#ccc' }}>…</span>
                  : <button key={p} style={S.pageBtn(currentPage === Number(p) - 1)} onClick={() => load(Number(p) - 1)}>{p}</button>
              )}
              <button style={S.pageBtn(false, currentPage >= totalPages - 1)} disabled={currentPage >= totalPages - 1} onClick={() => load(currentPage + 1)}>›</button>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 12 }}>
            Showing {displayed.length} of {totalElements} orders · Page {currentPage + 1} of {totalPages}
          </p>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .admin-tr:hover td { background: #fafafa; }
      `}</style>
    </div>
  )
}
