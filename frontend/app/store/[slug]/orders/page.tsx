'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg } from '@/components/store/store-types'
import { orderService } from '@/services/order.service'
import type { OrderListItem } from '@/types/order.types'

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  confirmed:  { bg: '#dbeafe', color: '#1e40af', label: 'Confirmed' },
  processing: { bg: '#e0e7ff', color: '#3730a3', label: 'Processing' },
  shipped:    { bg: '#ede9fe', color: '#4c1d95', label: 'Shipped' },
  delivered:  { bg: '#dcfce7', color: '#166534', label: 'Delivered' },
  cancelled:  { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
  refunded:   { bg: '#f3f4f6', color: '#374151', label: 'Refunded' },
}

export default function CustomerOrdersPage() {
  const router = useRouter()
  const store = useStore()
  const auth = useCustomerAuth()

  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const base = useStoreBase()
  const accent = store.colors.accent
  const bg = store.colors.background
  const text = store.colors.text
  const card = store.colors.card ?? '#fff'

  // Redirect if not logged in
  useEffect(() => {
    if (!auth.isLoggedIn) router.replace(`${base}/login`)
  }, [auth.isLoggedIn, base, router])

  // Load orders
  useEffect(() => {
    if (!auth.isLoggedIn) return
    let cancelled = false
    setLoading(true)

    const email = auth.customer?.email ?? ''
    const headers = auth.getAuthHeader?.() ?? {}

    orderService.getCustomerOrders(email, {}, headers).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.ok) setOrders(result.data.orders)
      else setError(result.error)
    })

    return () => { cancelled = true }
  }, [auth.isLoggedIn, auth.customer?.email])

  if (!auth.isLoggedIn) return null

  const cardStyle: React.CSSProperties = {
    background: card,
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 12,
  }

  return (
    <div style={{ background: bg, color: text, minHeight: '70vh', padding: '40px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <Link href={`${base}/profile`} style={{ color: accent, textDecoration: 'none', fontSize: 14 }}>
            ← Profile
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>My Orders</h1>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>Loading your orders…</div>
        )}

        {error && !loading && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: 16, borderRadius: 10, fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>No orders yet</p>
            <p style={{ color: '#999', marginBottom: 24 }}>Your orders will appear here once you make a purchase.</p>
            <Link
              href={base}
              style={{
                display: 'inline-block', background: accent, color: textOnBg(accent),
                padding: '12px 28px', borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 15,
              }}
            >
              Start Shopping
            </Link>
          </div>
        )}

        {!loading && orders.map((order) => {
          const statusCfg = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending
          return (
            <div key={order.id} style={cardStyle}>
              {/* Order header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px' }}>{order.orderNumber}</p>
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
                    {new Date(order.placedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <span style={{
                  background: statusCfg.bg, color: statusCfg.color,
                  fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                }}>
                  {statusCfg.label}
                </span>
              </div>

              {/* Item preview */}
              <p style={{ fontSize: 14, color: '#555', margin: '0 0 12px' }}>{order.itemPreview}</p>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  {order.itemCount} item{order.itemCount !== 1 ? 's' : ''} · {order.paymentMethod}
                </span>
                <span style={{ fontSize: 17, fontWeight: 800 }}>
                  {order.total.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, color: '#999' }}>EGP</span>
                </span>
              </div>

              {/* Cancel */}
              {order.canCancel && (
                <button
                  type="button"
                  style={{
                    marginTop: 12, width: '100%', padding: '9px',
                    background: 'none', border: '1px solid #fca5a5',
                    borderRadius: 8, color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                  onClick={async () => {
                    const headers = auth.getAuthHeader?.() ?? {}
                    const r = await orderService.cancelOrder(order.id, headers)
                    if (r.ok) {
                      setOrders((prev) => prev.map((o) =>
                        o.id === order.id ? { ...o, status: 'cancelled' as const, canCancel: false } : o
                      ))
                    }
                  }}
                >
                  Cancel Order
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
