'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { orderService } from '@/services/order.service'
import { textOnBg, formatPrice } from '@/components/store/store-types'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const store = useStore()
  const auth = useCustomerAuth()

  const name = searchParams.get('name') || 'there'
  const base = useStoreBase()
  const accent = store.colors.accent
  const rawOrderId = searchParams.get('orderId')
  const orderId = rawOrderId
    ? (rawOrderId.startsWith('#') ? rawOrderId : `#${rawOrderId}`)
    : `#FM-${Math.random().toString(36).slice(2).toUpperCase()}`

  // INT-42: fetch the real order total from the backend instead of relying on
  // the query-param value, which may differ if the backend applied taxes/shipping.
  const [total, setTotal] = useState(searchParams.get('total') || '0')

  useEffect(() => {
    if (!rawOrderId || !auth.isLoggedIn) return
    orderService
      .getOrderById(rawOrderId, null, auth.getAuthHeader())
      .then((order) => {
        if (order?.paymentSummary?.total) {
          setTotal(String(order.paymentSummary.total))
        }
      })
      .catch(() => { /* keep query-param fallback */ })
  }, [rawOrderId, auth])

  return (
    <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '60vh' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        {/* Success icon */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#22c55e15', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Thank you, {name}!
        </h1>
        <p style={{ fontSize: 16, color: '#666', margin: '0 0 32px', lineHeight: 1.6 }}>
          Your order has been placed successfully. We&apos;ll notify you when it ships.
        </p>

        {/* Order details card */}
        <div style={{
          background: store.colors.card, borderRadius: 16, padding: 28,
          border: '1px solid #00000008', textAlign: 'left', marginBottom: 32,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 12, color: '#999', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Order ID</p>
              <p style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>{orderId}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: '#999', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</p>
              <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: accent }}>{formatPrice(total)}</p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Order Confirmed</p>
                <p style={{ fontSize: 12, color: '#999', margin: 0 }}>We&apos;ve received your order</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: '#999' }}>Shipping</p>
                <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>Preparing your package</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: '#999' }}>Delivered</p>
                <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>Estimated 3-5 business days</p>
              </div>
            </div>
          </div>
        </div>

        <Link href={base || '/'} style={{
          display: 'inline-block',
          background: accent, color: textOnBg(accent),
          padding: '14px 32px', borderRadius: 10,
          fontSize: 15, fontWeight: 600, textDecoration: 'none',
          transition: 'opacity 0.2s',
        }}>
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  )
}
