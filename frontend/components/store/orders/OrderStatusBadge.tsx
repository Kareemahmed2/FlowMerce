'use client'

import { ORDER_STATUS_CONFIG } from '@/types/order.types'
import type { CustomerOrderStatus } from '@/types/order.types'

type Props = {
  status: CustomerOrderStatus
  /** 'sm' for table/card inline use; 'md' (default) for standalone display */
  size?: 'sm' | 'md'
}

/**
 * Single source of truth for order status rendering.
 * All status color/label logic lives here — nowhere else.
 */
const FALLBACK_CONFIG = {
  label: 'Unknown',
  bg: '#f3f4f6',
  color: '#555',
  border: '#d1d5db',
  icon: '○',
}

export default function OrderStatusBadge({ status, size = 'md' }: Props) {
  // Fallback ensures unknown/legacy statuses never throw at runtime
  const cfg = ORDER_STATUS_CONFIG[status] ?? FALLBACK_CONFIG
  const padding = size === 'sm' ? '2px 8px' : '4px 12px'
  const fontSize = size === 'sm' ? 11 : 12

  return (
    <span
      aria-label={`Order status: ${cfg.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding,
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        fontSize,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: size === 'sm' ? 9 : 10 }}>
        {cfg.icon}
      </span>
      {cfg.label}
    </span>
  )
}
