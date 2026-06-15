'use client'

import Link from 'next/link'
import type { OrderStatusFilter } from '@/types/order.types'
import { ORDER_STATUS_CONFIG } from '@/types/order.types'

type Props = {
  statusFilter: OrderStatusFilter
  hasActiveFilters: boolean
  onResetFilters: () => void
  base: string
  accent: string
  textColor: string
}

export default function EmptyOrdersState({
  statusFilter,
  hasActiveFilters,
  onResetFilters,
  base,
  accent,
  textColor,
}: Props) {
  const filteredStatus =
    statusFilter !== 'all' ? ORDER_STATUS_CONFIG[statusFilter].label : null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '52px 24px', gap: 16 }}
    >
      <div aria-hidden="true" style={{ width: 72, height: 72, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: textColor }}>
          {filteredStatus ? `No ${filteredStatus} orders` : 'No orders yet'}
        </h2>
        <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.6, maxWidth: 320 }}>
          {hasActiveFilters
            ? 'Try changing the status filter to see more orders.'
            : "When you place an order, it'll appear here."}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              padding: '10px 20px', borderRadius: 10,
              border: `1.5px solid ${accent}`, background: 'transparent',
              color: accent, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Show All Orders
          </button>
        )}
        <Link
          href={base}
          style={{
            padding: '10px 20px', borderRadius: 10,
            border: 'none', background: accent, color: '#fff',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Start Shopping
        </Link>
      </div>
    </div>
  )
}
