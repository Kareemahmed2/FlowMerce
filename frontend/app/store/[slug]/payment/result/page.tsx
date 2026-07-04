'use client'

/**
 * Payment result page — shows pending/success/failed state based on payment method.
 * Route: /store/[slug]/payment/result?orderId={id}&method={method}&total={total}
 *
 * For gateway-redirect methods (Stripe/Paymob) — polls GET /payments/order/{orderId}.
 * For async manual methods (COD/BankTransfer/Fawry/Instapay) — shows pending state
 * with the real reference code fetched from the backend.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg, formatPrice } from '@/components/store/store-types'
import { paymentService } from '@/services/payment.service'
import type { PaymentResponse } from '@/types/payment.types'

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 15

// Methods that are PENDING until manual merchant confirmation or outlet payment
const MANUAL_METHODS = ['COD', 'BANK_TRANSFER', 'INSTAPAY', 'FAWRY_PAY']

type PageState = 'polling' | 'loading_ref' | 'success' | 'failed' | 'pending_confirmation' | 'error'

function PaymentResultContent() {
  const searchParams = useSearchParams()
  const store = useStore()
  const auth = useCustomerAuth()

  const orderId    = searchParams.get('orderId')
  const method     = searchParams.get('method') ?? 'COD'
  const totalParam = searchParams.get('total')
  const base       = useStoreBase()
  const accent     = store.colors.accent

  const isManual = MANUAL_METHODS.includes(method)

  const [pageState, setPageState] = useState<PageState>(() =>
    isManual ? 'loading_ref' : 'polling'
  )
  const [pollCount, setPollCount]     = useState(0)
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── For manual methods: fetch once to get the real reference code ──
  useEffect(() => {
    if (!isManual || !orderId) {
      if (isManual) setPageState('pending_confirmation')
      return
    }
    paymentService.getPaymentByOrder(Number(orderId), auth.getAuthHeader())
      .then((r) => {
        if (r.ok) setPaymentData(r.data)
        setPageState('pending_confirmation')
      })
      .catch(() => setPageState('pending_confirmation'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── For gateway methods (Stripe/Paymob): poll until COMPLETED/FAILED ──
  useEffect(() => {
    if (pageState !== 'polling' || !orderId) return

    const poll = async () => {
      const result = await paymentService.getPaymentByOrder(Number(orderId), auth.getAuthHeader())
      if (!result.ok) {
        clearInterval(intervalRef.current!)
        setPageState('error')
        return
      }
      setPaymentData(result.data)
      setPollCount((c) => c + 1)

      if (result.data.status === 'COMPLETED') {
        clearInterval(intervalRef.current!)
        setPageState('success')
      } else if (result.data.status === 'FAILED') {
        clearInterval(intervalRef.current!)
        setPageState('failed')
      } else if (pollCount >= MAX_POLL_ATTEMPTS) {
        clearInterval(intervalRef.current!)
        setPageState('pending_confirmation')
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Shared UI helpers ──────────────────────────────────────────────────────
  const iconCircle = (bg: string, content: React.ReactNode) => (
    <div style={{ width: 80, height: 80, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>
      {content}
    </div>
  )
  const primaryBtn = (href: string, label: string) => (
    <Link href={href} style={{ display: 'block', padding: '14px 0', background: accent, color: textOnBg(accent), borderRadius: 12, textAlign: 'center', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
      {label}
    </Link>
  )
  const secondaryBtn = (href: string, label: string) => (
    <Link href={href} style={{ display: 'block', padding: '13px 0', border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center', fontWeight: 500, fontSize: 14, color: '#555', textDecoration: 'none' }}>
      {label}
    </Link>
  )

  const refCode = paymentData?.transactionReference ?? null
  const total   = totalParam ? Number(totalParam) : null

  return (
    <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ background: store.colors.card, borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 460, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #00000008' }}>

        {/* Loading reference */}
        {pageState === 'loading_ref' && (
          <>
            {iconCircle(`${accent}18`, <div style={{ width: 32, height: 32, borderRadius: '50%', border: `4px solid ${accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />)}
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Finalising your order…</h2>
            <p style={{ fontSize: 14, color: '#666' }}>Please wait a moment.</p>
          </>
        )}

        {/* Polling */}
        {pageState === 'polling' && (
          <>
            {iconCircle(`${accent}18`, <div style={{ width: 32, height: 32, borderRadius: '50%', border: `4px solid ${accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />)}
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Processing Payment</h2>
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 8px', lineHeight: 1.6 }}>Please wait while we confirm your payment.</p>
            <p style={{ fontSize: 12, color: '#aaa' }}>Attempt {pollCount + 1} / {MAX_POLL_ATTEMPTS}</p>
          </>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <>
            {iconCircle('#f0fdf4', '✅')}
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 10px' }}>Payment Successful!</h2>
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.6 }}>Your order has been confirmed and is being prepared.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orderId && primaryBtn(`${base}/account/orders/${orderId}`, 'View Order Details')}
              {secondaryBtn(base || '/', 'Continue Shopping')}
            </div>
          </>
        )}

        {/* Failed */}
        {pageState === 'failed' && (
          <>
            {iconCircle('#fef2f2', '❌')}
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Payment Failed</h2>
            {paymentData?.failureReason && (
              <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{paymentData.failureReason}</p>
            )}
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.6 }}>No charges were made. You can try again.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {primaryBtn(`${base}/cart`, 'Try Again')}
              {secondaryBtn(base || '/', 'Back to Store')}
            </div>
          </>
        )}

        {/* Pending Confirmation */}
        {pageState === 'pending_confirmation' && (
          <>
            {/* COD */}
            {method === 'COD' && (
              <>
                {iconCircle('#f0fdf4', '🛵')}
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Order Confirmed!</h2>
                <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Pay with cash when your order is delivered.
                </p>
                {refCode && (
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#555', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Reference</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0F0E0C', margin: 0, fontFamily: 'monospace' }}>{refCode}</p>
                  </div>
                )}
              </>
            )}

            {/* Bank Transfer / InstaPay */}
            {(method === 'BANK_TRANSFER' || method === 'INSTAPAY') && (
              <>
                {iconCircle('#eff6ff', '🏦')}
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>
                  {method === 'INSTAPAY' ? 'InstaPay Transfer' : 'Bank Transfer'}
                </h2>
                <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Complete the transfer using the reference below. The merchant will confirm receipt.
                </p>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#555', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfer Details</p>
                  {refCode && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#666' }}>Reference</span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{refCode}</span>
                    </div>
                  )}
                  {total && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#666' }}>Amount</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{formatPrice(total)} EGP</span>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: '#aaa', margin: '8px 0 0', lineHeight: 1.5 }}>
                    Use the reference as the transfer note so the merchant can identify your payment.
                  </p>
                </div>
              </>
            )}

            {/* Fawry */}
            {method === 'FAWRY_PAY' && (
              <>
                {iconCircle('#fff7ed', '🧾')}
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Fawry Reference Generated</h2>
                <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Pay at any Fawry outlet within <strong>24 hours</strong>.
                </p>
                <div style={{ background: '#fff7ed', borderRadius: 10, padding: '14px 16px', marginBottom: 20, border: '1px solid #fed7aa' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fawry Reference Code</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: '#c2410c', margin: '0 0 8px', fontFamily: 'monospace', letterSpacing: 2 }}>
                    {refCode ?? '—'}
                  </p>
                  {total && <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>Amount: <strong>{formatPrice(total)} EGP</strong></p>}
                </div>
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Show this code at any Fawry outlet (Fawry Plus, pharmacies, kiosks).
                </p>
              </>
            )}

            {/* Fallback */}
            {!MANUAL_METHODS.includes(method) && (
              <>
                {iconCircle('#fff7ed', '🕐')}
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Awaiting Confirmation</h2>
                <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>Your order is placed and awaiting payment confirmation.</p>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orderId && primaryBtn(`${base}/account/orders/${orderId}`, 'Track My Order')}
              {secondaryBtn(base || '/', 'Continue Shopping')}
            </div>
          </>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <>
            {iconCircle('#fef2f2', '⚠️')}
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Something Went Wrong</h2>
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.6 }}>We couldn&apos;t verify your payment status. Please check your orders or contact support.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {primaryBtn(`${base}/account/orders`, 'View My Orders')}
              {secondaryBtn(base || '/', 'Back to Store')}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#555', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <PaymentResultContent />
    </Suspense>
  )
}
