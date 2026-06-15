'use client'

import { useState } from 'react'
import Link from 'next/link'
import OrderStatusBadge from './OrderStatusBadge'
import { formatPrice } from '@/components/store/store-types'
import type { OrderListItem } from '@/types/order.types'

type Props = {
  order: OrderListItem
  base: string
  accent: string
  cardBg: string
  textColor: string
  onCancel: (id: string) => Promise<{ ok: boolean; message?: string }>
  onReorder: (id: string) => Promise<{ ok: boolean; addedCount: number; message?: string }>
}

export default function OrderCard({
  order,
  base,
  accent,
  cardBg,
  textColor,
  onCancel,
  onReorder,
}: Props) {
  const [cancelling, setCancelling] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  const handleCancel = async () => {
    setCancelling(true)
    setFeedback(null)
    const result = await onCancel(order.id)
    setCancelling(false)
    setConfirmCancel(false)
    if (!result.ok) setFeedback({ type: 'error', msg: result.message ?? 'Failed to cancel.' })
  }

  const handleReorder = async () => {
    setReordering(true)
    setFeedback(null)
    const result = await onReorder(order.id)
    setReordering(false)
    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.message ?? 'Could not reorder.' })
    } else {
      setFeedback({ type: 'success', msg: result.message ?? 'Added to cart.' })
    }
  }

  const placedDate = new Date(order.placedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <article
      aria-label={`Order ${order.orderNumber}`}
      style={{
        background: cardBg,
        borderRadius: 14,
        border: '1px solid #00000008',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Link
            href={`${base}/account/orders/${order.id}`}
            style={{ fontSize: 15, fontWeight: 700, color: textColor, textDecoration: 'none' }}
          >
            {order.orderNumber}
          </Link>
          <p style={{ fontSize: 12, color: '#aaa', margin: '2px 0 0' }}>
            Placed <time dateTime={order.placedAt}>{placedDate}</time>
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Items preview + total */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontSize: 14, color: '#666', margin: 0, flex: 1 }}>
          {order.itemPreview}
          {order.itemCount > 1 && (
            <span style={{ fontSize: 12, color: '#aaa', marginLeft: 6 }}>
              ({order.itemCount} {order.itemCount === 1 ? 'item' : 'items'})
            </span>
          )}
        </p>
        <span style={{ fontSize: 16, fontWeight: 700, color: textColor }}>
          {formatPrice(order.total)}
        </span>
      </div>

      {/* Feedback message */}
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          style={{
            fontSize: 12,
            color: feedback.type === 'error' ? '#dc2626' : '#16a34a',
            margin: 0,
            padding: '6px 10px',
            background: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
            borderRadius: 6,
          }}
        >
          {feedback.msg}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link
          href={`${base}/account/orders/${order.id}`}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb',
            fontSize: 13, fontWeight: 600, color: textColor, textDecoration: 'none',
          }}
        >
          View Details
        </Link>

        <button
          type="button"
          onClick={handleReorder}
          disabled={reordering}
          aria-busy={reordering}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: accent, color: '#fff',
            fontSize: 13, fontWeight: 600,
            cursor: reordering ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: reordering ? 0.7 : 1,
          }}
        >
          {reordering ? 'Adding…' : 'Reorder'}
        </button>

        {order.canCancel && !confirmCancel && (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1.5px solid #fecaca', background: 'none',
              fontSize: 13, fontWeight: 600, color: '#dc2626',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        )}

        {confirmCancel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#555' }}>Cancel this order?</span>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                padding: '6px 12px', borderRadius: 6,
                background: '#dc2626', border: 'none',
                color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: cancelling ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {cancelling ? '…' : 'Yes, Cancel'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              style={{
                padding: '6px 10px', borderRadius: 6,
                background: 'none', border: '1px solid #e5e7eb',
                color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              No
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
