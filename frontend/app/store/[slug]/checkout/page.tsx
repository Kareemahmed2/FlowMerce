'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useStore, useCart } from '@/components/store/StoreProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { textOnBg, formatPrice, EMPTY_CHECKOUT } from '@/components/store/store-types'
import type { CheckoutForm } from '@/components/store/store-types'
import { orderService } from '@/services/order.service'
import { walletService } from '@/services/wallet.service'
import { toBackendPaymentMethod, PAYMENT_METHOD_CONFIG, getPaymentMethodLabel } from '@/types/payment.types'
import type { BackendPaymentMethod } from '@/types/payment.types'

// All working payment methods the backend supports + display config
const WORKING_METHODS: BackendPaymentMethod[] = [
  'COD',
  'BANK_TRANSFER',
  'INSTAPAY',
  'FAWRY_PAY',
  'FLOWMERCE_WALLET',
]

// Stub methods — shown as disabled until gateway is integrated
const STUB_METHODS: BackendPaymentMethod[] = ['STRIPE', 'PAYMOB']

export default function CheckoutPage() {
  const router = useRouter()
  const store = useStore()
  const cart = useCart()
  const auth = useCustomerAuth()

  const [form, setForm] = useState<CheckoutForm>(EMPTY_CHECKOUT)
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Real wallet balance (loaded when FLOWMERCE_WALLET is selected or on mount)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  // After order is placed we get real totals from the backend
  const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null)
  const [confirmedShipping, setConfirmedShipping] = useState<number | null>(null)

  const base = useStoreBase()
  const accent = store.colors.accent

  // Which methods the store owner has enabled (intersect with working methods)
  const enabledWorking = WORKING_METHODS.filter((m) =>
    store.payment.some((p) => toBackendPaymentMethod(p) === m || p === m)
  )
  // If store has no explicit config, show all working methods.
  const baseMethods = enabledWorking.length > 0 ? enabledWorking : WORKING_METHODS
  // FlowMerce Wallet stays available regardless of the merchant's gateway
  // toggles — it's the platform's own rail and the main payment method for now.
  const shownMethods = baseMethods.includes('FLOWMERCE_WALLET')
    ? baseMethods
    : ['FLOWMERCE_WALLET' as BackendPaymentMethod, ...baseMethods]

  // Stable per-checkout-attempt idempotency key — generated once and reused on
  // every submit, so a retry after a false client-side timeout doesn't create
  // a second real order if the first attempt actually succeeded server-side.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )

  // Load wallet balance when wallet method is selected
  useEffect(() => {
    if (form.paymentMethod !== 'FLOWMERCE_WALLET' || !auth.isLoggedIn) return
    setWalletLoading(true)
    walletService.getMyWallet(auth.getAuthHeader()).then((r) => {
      setWalletLoading(false)
      if (r.ok) setWalletBalance(Number(r.data.balance))
    })
  }, [form.paymentMethod, auth.isLoggedIn, auth.getAuthHeader])

  const upd = (field: keyof CheckoutForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required'
    if (!form.phone.trim()) e.phone = 'Required'
    if (!form.address.trim()) e.address = 'Required'
    if (!form.city.trim()) e.city = 'Required'
    if (!form.paymentMethod) e.paymentMethod = 'Choose a payment method'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate() || !store.storeId) return

    if (!auth.isLoggedIn) {
      setSubmitError('You must be signed in to place an order. Please sign in or create a customer account.')
      return
    }

    // Wallet balance check (client-side early warning)
    if (form.paymentMethod === 'FLOWMERCE_WALLET' && walletBalance !== null && walletBalance < cart.subtotal) {
      setSubmitError(`Insufficient wallet balance. Available: ${formatPrice(walletBalance)} EGP`)
      return
    }

    setSubmitError('')
    setSubmitting(true)

    const result = await orderService.placeOrder(
      {
        storeId: store.storeId,
        items: cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        shippingAddress: {
          fullName: `${form.firstName} ${form.lastName}`.trim(),
          street: form.address,
          city: form.city,
          country: 'Egypt',
        },
        phone: form.phone,
        paymentMethod: toBackendPaymentMethod(form.paymentMethod),
        notes: form.notes || undefined,
        idempotencyKey,
      },
      auth.getAuthHeader()
    )

    setSubmitting(false)

    if (!result.ok) {
      setSubmitError(result.error)
      return
    }

    cart.clearCart()

    const { orderId, total, redirectUrl } = result.data
    const orderTotal = total ?? cart.subtotal + 25 // backend returns real total incl. 25 EGP flat shipping

    // 1. Gateway redirect (Stripe/Paymob) — navigate away
    if (redirectUrl) {
      window.location.href = redirectUrl
      return
    }

    // 2. Wallet payment — completes immediately → confirmation
    if (toBackendPaymentMethod(form.paymentMethod) === 'FLOWMERCE_WALLET') {
      router.push(
        `${base}/confirmation?orderId=${encodeURIComponent(orderId)}&name=${encodeURIComponent(form.firstName)}&total=${orderTotal}`
      )
      return
    }

    // 3. COD / Bank Transfer / Fawry — stays PENDING, show payment/result page
    router.push(
      `${base}/payment/result?orderId=${encodeURIComponent(orderId)}&method=${encodeURIComponent(toBackendPaymentMethod(form.paymentMethod))}&total=${orderTotal}`
    )
  }

  if (cart.items.length === 0) {
    return (
      <div style={{ background: '#f7f9fb', color: '#191c1e', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Your cart is empty</h2>
          <p style={{ color: '#75777d', fontSize: 14, margin: '0 0 20px' }}>Add some items before checking out.</p>
          <Link href={base} style={{ color: accent, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>← Back to store</Link>
        </div>
      </div>
    )
  }

  const inputStyle = (field: keyof CheckoutForm): React.CSSProperties => ({
    width: '100%', padding: '11px 14px', borderRadius: 9,
    border: errors[field] ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    background: '#fff', color: '#1e293b', transition: 'border-color 0.15s',
  })
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#45474c', textTransform: 'uppercase', letterSpacing: '0.04em' }

  // Display totals: backend returns real values after order; before submit show estimate
  const displayShipping = confirmedShipping ?? 25  // backend flat rate
  const displayTotal = confirmedTotal ?? (cart.subtotal + displayShipping)

  return (
    <div style={{ background: '#f7f9fb', color: '#191c1e' }}>
      <div className="sf-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 32px 72px' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, fontSize: 13 }}>
          <Link href={base} style={{ color: '#75777d', textDecoration: 'none' }} className="sf-breadcrumb-link">Home</Link>
          <span style={{ color: '#c5c6cd' }}>/</span>
          <Link href={`${base}/cart`} style={{ color: '#75777d', textDecoration: 'none' }} className="sf-breadcrumb-link">Cart</Link>
          <span style={{ color: '#c5c6cd' }}>/</span>
          <span style={{ color: '#1e293b', fontWeight: 500 }}>Checkout</span>
        </nav>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', margin: '0 0 36px', letterSpacing: '-0.02em' }}>Checkout</h1>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 40, alignItems: 'start' }} className="checkout-grid">
          {/* ── Form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Contact */}
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 16px' }}>Contact Information</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="sf-two-col">
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input value={form.firstName} onChange={(e) => upd('firstName', e.target.value)} style={inputStyle('firstName')} placeholder="Ahmed" />
                  {errors.firstName && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.firstName}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input value={form.lastName} onChange={(e) => upd('lastName', e.target.value)} style={inputStyle('lastName')} placeholder="Hassan" />
                  {errors.lastName && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.lastName}</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }} className="sf-two-col">
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" value={form.email} onChange={(e) => upd('email', e.target.value)} style={inputStyle('email')} placeholder="ahmed@example.com" />
                  {errors.email && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.email}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Phone *</label>
                  <input value={form.phone} onChange={(e) => upd('phone', e.target.value)} style={inputStyle('phone')} placeholder="01xxxxxxxxx" />
                  {errors.phone && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.phone}</span>}
                </div>
              </div>
            </section>

            {/* Shipping */}
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 16px' }}>Shipping Address</h2>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Address *</label>
                <input value={form.address} onChange={(e) => upd('address', e.target.value)} style={inputStyle('address')} placeholder="Street, building, apartment" />
                {errors.address && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.address}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="sf-two-col">
                <div>
                  <label style={labelStyle}>City *</label>
                  <input value={form.city} onChange={(e) => upd('city', e.target.value)} style={inputStyle('city')} placeholder="Cairo" />
                  {errors.city && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.city}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Order Notes</label>
                  <input value={form.notes} onChange={(e) => upd('notes', e.target.value)} style={inputStyle('notes')} placeholder="Special instructions (optional)" />
                </div>
              </div>
            </section>

            {/* Payment */}
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 16px' }}>Payment Method</h2>
              {errors.paymentMethod && <span style={{ fontSize: 12, color: '#ef4444', display: 'block', marginBottom: 10 }}>{errors.paymentMethod}</span>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Working methods */}
                {shownMethods.map((m) => {
                  const cfg = PAYMENT_METHOD_CONFIG[m]
                  const isWallet = m === 'FLOWMERCE_WALLET'
                  const selected = form.paymentMethod === m
                  const insufficientBalance = isWallet && walletBalance !== null && walletBalance < cart.subtotal

                  return (
                    <label key={m} className={selected ? '' : 'payment-option'} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 16px', borderRadius: 10,
                      border: selected ? `2px solid ${accent}` : '1px solid #e5e7eb',
                      // Checkout payment cards stay white regardless of the storefront's
                      // theme (like the order summary card below) — store.colors.card can
                      // be dark in some themes, which made the unstyled label text
                      // (inherited dark) unreadable against it.
                      background: selected ? `${accent}08` : '#fff',
                      color: '#1e293b',
                      cursor: 'pointer',
                    }}>
                      <input
                        type="radio" name="payment" value={m}
                        checked={selected}
                        onChange={() => upd('paymentMethod', m)}
                        style={{ accentColor: accent, marginTop: 2 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{cfg?.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{cfg?.label ?? getPaymentMethodLabel(m)}</span>
                        </div>
                        {cfg?.subtitle && (
                          <p style={{ fontSize: 12, color: '#888', margin: '3px 0 0' }}>{cfg.subtitle}</p>
                        )}
                        {/* Wallet balance */}
                        {isWallet && selected && (
                          <p style={{ fontSize: 12, margin: '6px 0 0', color: insufficientBalance ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                            {walletLoading ? 'Loading balance…' :
                              walletBalance !== null
                                ? `Balance: ${formatPrice(walletBalance)} EGP${insufficientBalance ? ' — Insufficient' : ''}`
                                : auth.isLoggedIn ? 'Could not load balance' : 'Sign in to use wallet'}
                          </p>
                        )}
                        {/* Method-specific instructions */}
                        {selected && m === 'BANK_TRANSFER' && (
                          <p style={{ fontSize: 12, color: '#555', margin: '6px 0 0' }}>
                            Transfer instructions will be shown after placing your order.
                          </p>
                        )}
                        {selected && m === 'FAWRY_PAY' && (
                          <p style={{ fontSize: 12, color: '#555', margin: '6px 0 0' }}>
                            A Fawry reference code will be generated. Pay at any Fawry outlet within 24 hours.
                          </p>
                        )}
                        {selected && m === 'INSTAPAY' && (
                          <p style={{ fontSize: 12, color: '#555', margin: '6px 0 0' }}>
                            Transfer instructions will be shown after placing your order.
                          </p>
                        )}
                      </div>
                    </label>
                  )
                })}

                {/* Stub methods (disabled) */}
                {STUB_METHODS.map((m) => {
                  const cfg = PAYMENT_METHOD_CONFIG[m]
                  return (
                    <div key={m} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 10,
                      border: '1px solid #f0ece4', background: '#fafafa',
                      opacity: 0.5, cursor: 'not-allowed',
                    }}>
                      <input type="radio" disabled style={{ accentColor: '#ccc' }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{cfg?.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#999' }}>{cfg?.label ?? m}</span>
                          <span style={{ fontSize: 10, background: '#e5e7eb', color: '#888', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>Coming soon</span>
                        </div>
                        {cfg?.subtitle && <p style={{ fontSize: 12, color: '#bbb', margin: '2px 0 0' }}>{cfg.subtitle}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* ── Order Summary sidebar ── */}
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(30,41,59,0.05)',
            position: 'sticky', top: 88,
          }} className="checkout-summary">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 20px', letterSpacing: '-0.01em' }}>Your Order</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {cart.items.map((item) => (
                <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.product.images?.[0]
                        ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ color: '#ccc', fontSize: 16 }}>?</span>}
                    </span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: 13 }}>{item.product.name}</p>
                      <p style={{ margin: 0, color: '#999', fontSize: 12 }}>x{item.quantity}</p>
                    </div>
                  </div>
                  <span style={{ fontWeight: 600 }}>
                    {formatPrice((item.priceAtAdd ?? parseFloat(item.product.price || '0')) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{formatPrice(cart.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Shipping</span>
                <span style={{ fontWeight: 600 }}>{formatPrice(displayShipping)} EGP</span>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{formatPrice(displayTotal)}</span>
              </div>
            </div>

            {submitError && (
              <p style={{ margin: '16px 0 0', fontSize: 13, color: '#b91c1c', lineHeight: 1.4 }}>{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !store.storeId}
              style={{
                width: '100%', marginTop: 20, height: 50,
                background: submitting ? '#75777d' : accent,
                color: textOnBg(accent),
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'opacity 0.15s',
                letterSpacing: '-0.01em',
              }}
              className={submitting ? '' : 'store-cta-btn'}
            >
              {submitting ? 'Placing Order…' : `Place Order — ${formatPrice(displayTotal)}`}
            </button>

            {!auth.isLoggedIn && (
              <p style={{ fontSize: 12, color: '#888', textAlign: 'center', marginTop: 12 }}>
                <Link href={`${base}/login`} style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link> to save your order history.
              </p>
            )}
          </div>
        </form>
      </div>

      <style>{`
        .store-cta-btn:hover { opacity: 0.88 !important; }
        .sf-breadcrumb-link:hover { color: #1e293b !important; }
        .payment-option:hover { border-color: ${accent} !important; background: ${accent}08 !important; }
        @media (max-width: 768px) {
          .checkout-grid { grid-template-columns: 1fr !important; }
          .checkout-summary { position: static !important; }
        }
      `}</style>
    </div>
  )
}
