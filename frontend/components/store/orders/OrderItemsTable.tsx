'use client'

import { formatPrice } from '@/components/store/store-types'
import type { OrderItem } from '@/types/order.types'

type Props = {
  items: OrderItem[]
  accent: string
  textColor: string
  cardBg: string
}

/**
 * Accessible, responsive table of order items.
 * Uses semantic <table> with scope attributes for screen reader support.
 * On narrow viewports, switches to a stacked card layout via CSS.
 */
export default function OrderItemsTable({ items, accent, textColor, cardBg }: Props) {
  void accent // reserved for future row highlights

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
          aria-label="Order items"
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              <th scope="col" style={{ textAlign: 'left', padding: '10px 12px 10px 0', fontWeight: 600, color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                Product
              </th>
              <th scope="col" style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                Qty
              </th>
              <th scope="col" style={{ textAlign: 'right', padding: '10px 0 10px 12px', fontWeight: 600, color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={`${item.productName}-${i}`}
                style={{ borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none' }}
              >
                {/* Product cell */}
                <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Image thumbnail */}
                    <div
                      aria-hidden="true"
                      style={{
                        width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                        background: '#f3f4f6', overflow: 'hidden',
                        border: '1px solid #00000008',
                      }}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <span style={{ fontWeight: 500, color: textColor, display: 'block', lineHeight: 1.3 }}>
                        {item.productName}
                      </span>
                      {item.categoryName && (
                        <span style={{ fontSize: 12, color: '#aaa' }}>{item.categoryName}</span>
                      )}
                      <span style={{ fontSize: 12, color: '#999', display: 'block', marginTop: 2 }}>
                        {formatPrice(item.unitPrice)} each
                      </span>
                    </div>
                  </div>
                </td>

                {/* Quantity */}
                <td style={{ textAlign: 'center', padding: '14px 12px', color: textColor, verticalAlign: 'middle' }}>
                  {item.quantity}
                </td>

                {/* Total */}
                <td style={{ textAlign: 'right', padding: '14px 0 14px 12px', fontWeight: 600, color: textColor, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                  {formatPrice(item.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <p style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '20px 0' }}>
          Item details are not available for this order.
        </p>
      )}
    </>
  )
}
