'use client'

import { formatPrice } from '@/components/store/store-types'
import type { OrderPaymentSummary } from '@/types/order.types'

type Props = {
  summary: OrderPaymentSummary
  textColor: string
}

/**
 * Payment totals breakdown — subtotal, shipping, tax, discounts, total.
 * Pure presentational, no service calls.
 */
export default function OrderSummary({ summary, textColor }: Props) {
  const rows: { label: string; value: number; bold?: boolean; hide?: boolean }[] = [
    { label: 'Subtotal',  value: summary.subtotal },
    { label: 'Shipping',  value: summary.shipping, hide: summary.shipping === 0 },
    { label: 'Tax',       value: summary.tax,      hide: summary.tax === 0 },
    { label: 'Discount',  value: -summary.discount, hide: summary.discount === 0 },
    { label: 'Total',     value: summary.total, bold: true },
  ]

  return (
    <dl style={{ margin: 0 }}>
      {rows
        .filter((r) => !r.hide)
        .map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: row.bold ? '10px 0 0' : '6px 0',
              borderTop: row.bold ? '1.5px solid #e5e7eb' : 'none',
              marginTop: row.bold ? 4 : 0,
            }}
          >
            <dt style={{ fontSize: row.bold ? 15 : 14, fontWeight: row.bold ? 700 : 400, color: row.bold ? textColor : '#666' }}>
              {row.label}
            </dt>
            <dd
              style={{
                fontSize: row.bold ? 16 : 14,
                fontWeight: row.bold ? 700 : 500,
                color: row.label === 'Discount' ? '#16a34a' : textColor,
                margin: 0,
              }}
            >
              {row.label === 'Discount' && row.value < 0 ? '-' : ''}
              {formatPrice(Math.abs(row.value))}
            </dd>
          </div>
        ))}

      {/* Shipping note */}
      {summary.shipping === 0 && (
        <p style={{ fontSize: 12, color: '#16a34a', margin: '4px 0 0' }}>Free shipping</p>
      )}

      {/* Payment method */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
        <dt style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>Payment method</dt>
        <dd style={{ fontSize: 14, fontWeight: 500, color: textColor, margin: 0 }}>
          {summary.paymentMethod}
        </dd>
      </div>
    </dl>
  )
}
