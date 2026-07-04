'use client'

/**
 * Customer order detail page — /store/[slug]/account/orders/[id]
 *
 * Client component — uses useParams() which does not require Suspense.
 * Loads the order on mount via orderService.getOrderById().
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore, useCart } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { orderService } from '@/services/order.service'
import { parseAuthError } from '@/lib/errors'
import { formatPrice, textOnBg } from '@/components/store/store-types'
import OrderStatusBadge from '@/components/store/orders/OrderStatusBadge'
import OrderTimeline from '@/components/store/orders/OrderTimeline'
import OrderItemsTable from '@/components/store/orders/OrderItemsTable'
import OrderSummary from '@/components/store/orders/OrderSummary'
import type { CustomerOrder } from '@/types/order.types'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const store = useStore()
  const cart = useCart()
  const auth = useCustomerAuth()

  const base = useStoreBase()
  const accent = store.colors.accent
  const bg = store.colors.background
  const text = store.colors.text
  const card = store.colors.card

  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const categoriesRef = useRef(store.categories)
  categoriesRef.current = store.categories

  // ── Load order ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError('')

    // INT-12: pass auth header — backend GET /orders/{id} requires BUYER JWT.
    orderService
      .getOrderById(id, categoriesRef.current, auth.getAuthHeader())
      .then((result) => {
        if (!cancelled) {
          setOrder(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(parseAuthError(err).message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (!auth.isLoggedIn) {
    return (
      <div style={{ background: bg, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px', color: text }}>Sign in to view order details</h2>
          <Link href={`${base}/login`} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '13px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <OrderDetailSkeleton bg={bg} card={card} />

  // ── Error / Not found ──────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div style={{ background: bg, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: text }}>{error ? 'Something went wrong' : 'Order not found'}</h2>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px' }}>{error || "This order doesn’t exist or doesn’t belong to your account."}</p>
          <Link href={`${base}/account/orders`} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Back to Orders
          </Link>
        </div>
      </div>
    )
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    setCancelling(true)
    setActionFeedback(null)
    // INT-13: pass auth header — POST /orders/{id}/cancel requires BUYER JWT.
    const result = await orderService.cancelOrder(order.id, auth.getAuthHeader())
    setCancelling(false)
    setConfirmCancel(false)
    if (result.ok) {
      setOrder((prev) => prev ? { ...prev, status: 'cancelled', canCancel: false, timeline: prev.timeline } : prev)
      setActionFeedback({ type: 'success', msg: 'Order cancelled successfully.' })
    } else {
      setActionFeedback({ type: 'error', msg: result.error })
    }
  }

  const handleReorder = async () => {
    setReordering(true)
    setActionFeedback(null)
    const result = await orderService.getReorderItems(order.id, categoriesRef.current)
    setReordering(false)
    if (!result.ok) {
      setActionFeedback({ type: 'error', msg: result.error })
      return
    }
    let added = 0
    for (const item of result.data) {
      if (item.productId === null) continue
      for (const category of categoriesRef.current) {
        const product = category.products.find((p) => p.id === item.productId)
        if (product) { cart.addItem(product, category.name); added++; break }
      }
    }
    setActionFeedback({
      type: added > 0 ? 'success' : 'error',
      msg: added > 0 ? `${added} item${added > 1 ? 's' : ''} added to your cart.` : 'Items are no longer available.',
    })
    if (added > 0) router.push(`${base}/cart`)
  }

  const sectionCard: React.CSSProperties = {
    background: card, borderRadius: 14, padding: '22px 24px',
    border: '1px solid #00000008', marginBottom: 20,
  }
  const sectionHeading: React.CSSProperties = {
    fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: text,
  }

  return (
    <div style={{ background: bg, color: text, minHeight: '70vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 24px 64px' }}>

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#999', flexWrap: 'wrap' }}>
          <Link href={base || '/'} style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={`${base}/account/orders`} style={{ color: '#999', textDecoration: 'none' }}>Orders</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: text, fontWeight: 500 }}>{order.orderNumber}</span>
        </nav>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Order {order.orderNumber}
            </h1>
            <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
              Placed on{' '}
              <time dateTime={order.placedAt}>
                {new Date(order.placedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            </p>
          </div>
          <OrderStatusBadge status={order.status} size="md" />
        </div>

        {/* ── Feedback ────────────────────────────────────────────────────── */}
        {actionFeedback && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14,
              background: actionFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: actionFeedback.type === 'success' ? '#16a34a' : '#dc2626',
            }}
          >
            {actionFeedback.msg}
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {order.canReorder && (
            <button type="button" onClick={handleReorder} disabled={reordering} aria-busy={reordering}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: accent, color: textOnBg(accent), fontSize: 14, fontWeight: 600, cursor: reordering ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: reordering ? 0.7 : 1 }}>
              {reordering ? 'Adding to cart…' : 'Reorder'}
            </button>
          )}
          {order.canCancel && !confirmCancel && (
            <button type="button" onClick={() => setConfirmCancel(true)}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #fecaca', background: 'none', color: '#dc2626', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel Order
            </button>
          )}
          {confirmCancel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, color: text }}>Cancel this order?</span>
              <button type="button" onClick={handleCancel} disabled={cancelling}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: cancelling ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'none', color: '#555', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                No
              </button>
            </div>
          )}
        </div>

        {/* ── Timeline ────────────────────────────────────────────────────── */}
        <div style={sectionCard}>
          <h2 style={sectionHeading}>Order Status</h2>
          <OrderTimeline events={order.timeline} accent={accent} />
        </div>

        {/* ── Items ───────────────────────────────────────────────────────── */}
        <div style={sectionCard}>
          <h2 style={sectionHeading}>
            Items
            <span style={{ fontSize: 13, fontWeight: 400, color: '#aaa', marginLeft: 8 }}>
              ({order.items.length})
            </span>
          </h2>
          <OrderItemsTable items={order.items} accent={accent} textColor={text} cardBg={card} />
        </div>

        {/* ── Two-column: shipping + summary ────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20 }}>
          {/* Shipping address */}
          <div style={sectionCard}>
            <h2 style={sectionHeading}>Shipping Address</h2>
            <address style={{ fontStyle: 'normal', fontSize: 14, color: '#666', lineHeight: 1.7 }}>
              <strong style={{ color: text }}>{order.shippingAddress.fullName}</strong><br />
              {order.shippingAddress.street}<br />
              {order.shippingAddress.city}<br />
              {order.shippingAddress.country}
            </address>
            {order.shipment.trackingNumber && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 2px' }}>Tracking</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: text, margin: 0 }}>
                  {order.shipment.carrier} · {order.shipment.trackingNumber}
                </p>
              </div>
            )}
          </div>

          {/* Payment summary */}
          <div style={sectionCard}>
            <h2 style={sectionHeading}>Payment</h2>
            <OrderSummary summary={order.paymentSummary} textColor={text} />
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function OrderDetailSkeleton({ bg, card }: { bg: string; card: string }) {
  return (
    <div aria-busy="true" aria-label="Loading order details" style={{ background: bg, minHeight: '70vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 24px 64px' }}>
        <div style={{ width: 200, height: 28, background: '#e5e7eb', borderRadius: 8, marginBottom: 8 }} />
        <div style={{ width: 140, height: 14, background: '#e5e7eb', borderRadius: 4, marginBottom: 28 }} />
        {[320, 260, 200].map((w, i) => (
          <div key={i} style={{ background: card, borderRadius: 14, padding: '22px 24px', marginBottom: 20, border: '1px solid #00000008' }}>
            <div style={{ width: 120, height: 16, background: '#e5e7eb', borderRadius: 4, marginBottom: 18 }} />
            <div style={{ width: `${w}px`, height: 12, background: '#e5e7eb', borderRadius: 4 }} />
          </div>
        ))}
      </div>
      <style>{`[aria-busy="true"] * { animation: od-pulse 1.5s ease-in-out infinite; } @keyframes od-pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
