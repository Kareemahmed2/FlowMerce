'use client'

import Link from 'next/link'
import { useStore, useCart } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { textOnBg, formatPrice } from '@/components/store/store-types'

// ── Quantity stepper ──────────────────────────────────────────────────────────
function Stepper({ value, min = 1, onMinus, onPlus }: { value: number; min?: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      border: '1.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden',
      userSelect: 'none',
    }}>
      <button
        type="button"
        onClick={onMinus}
        disabled={value <= min}
        style={{
          width: 34, height: 34, background: 'none', border: 'none',
          cursor: value <= min ? 'not-allowed' : 'pointer',
          color: value <= min ? '#c5c6cd' : '#1e293b',
          fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        className="stepper-btn"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span style={{
        width: 38, textAlign: 'center', fontSize: 13, fontWeight: 600,
        color: '#1e293b', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
        lineHeight: '34px',
      }}>
        {value}
      </span>
      <button
        type="button"
        onClick={onPlus}
        style={{
          width: 34, height: 34, background: 'none', border: 'none',
          cursor: 'pointer', color: '#1e293b',
          fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        className="stepper-btn"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, fontSize: 13 }}>
      {items.map((item, i) => (
        <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: '#c5c6cd' }}>/</span>}
          {item.href ? (
            <Link href={item.href} style={{ color: '#75777d', textDecoration: 'none', transition: 'color 0.15s' }} className="sf-breadcrumb-link">
              {item.label}
            </Link>
          ) : (
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export default function CartPage() {
  const store = useStore()
  const cart = useCart()

  const base = useStoreBase()
  const accent = store.colors.accent
  const shipping = cart.subtotal > 500 ? 0 : 50
  const total = cart.subtotal + shipping

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (cart.items.length === 0) {
    return (
      <div style={{ background: '#f7f9fb', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: '#eceef0', margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#75777d',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Your cart is empty
          </h2>
          <p style={{ color: '#75777d', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
            Looks like you haven&apos;t added anything yet.
          </p>
          <Link href={base || '/'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: accent, color: textOnBg(accent),
            padding: '12px 28px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
            transition: 'opacity 0.15s',
          }} className="store-cta-btn">
            Continue Shopping
          </Link>
        </div>
      </div>
    )
  }

  // ── Filled cart ─────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#f7f9fb', color: '#191c1e' }}>
      <div className="sf-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px 80px' }}>
        <Breadcrumb items={[{ label: 'Home', href: base || '/' }, { label: `Cart (${cart.itemCount})` }]} />

        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', margin: '0 0 36px', letterSpacing: '-0.02em' }}>
          Shopping Cart
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }} className="cart-grid">

          {/* ── Items list ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cart.items.map((item) => {
              const img = item.product.images?.[0] ?? null
              const unitPrice = item.priceAtAdd ?? parseFloat(item.product.price || '0')
              const lineTotal = unitPrice * item.quantity
              return (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex', gap: 16,
                    background: '#fff', borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(30,41,59,0.04)',
                    transition: 'box-shadow 0.2s',
                  }}
                  className="cart-item"
                >
                  {/* Image */}
                  <Link href={`${base}/product/${item.product.id}`} style={{ flexShrink: 0 }}>
                    <div style={{
                      width: 96, height: 96, borderRadius: 10,
                      overflow: 'hidden', background: '#f2f4f6',
                    }}>
                      {img ? (
                        <img src={img} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5c6cd' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Details */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#75777d', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                        {item.categoryName}
                      </span>
                      <Link href={`${base}/product/${item.product.id}`} style={{ textDecoration: 'none', color: '#1e293b' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '2px 0 4px', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.product.name}
                        </h3>
                      </Link>
                      <p style={{ fontSize: 12, color: '#75777d', margin: 0 }}>
                        {formatPrice(String(unitPrice))} each
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                      <Stepper
                        value={item.quantity}
                        onMinus={() => cart.updateQuantity(item.product.id, item.quantity - 1)}
                        onPlus={() => cart.updateQuantity(item.product.id, item.quantity + 1)}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                          {formatPrice(lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => cart.removeItem(item.product.id)}
                          style={{
                            background: 'none', border: 'none',
                            color: '#75777d', fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'color 0.15s', padding: 0,
                          }}
                          className="sf-remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Order summary ────────────────────────────────────────────── */}
          <div style={{
            background: '#fff',
            borderRadius: 16, padding: 28,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(30,41,59,0.05)',
            position: 'sticky', top: 88,
          }} className="cart-summary">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 20px', letterSpacing: '-0.01em' }}>
              Order Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: '#75777d' }}>Subtotal ({cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''})</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatPrice(cart.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: '#75777d' }}>Shipping</span>
                <span style={{ fontWeight: 600, color: shipping === 0 ? '#059669' : '#1e293b' }}>
                  {shipping === 0 ? 'Free' : formatPrice(shipping)}
                </span>
              </div>
              {shipping > 0 && (
                <p style={{ fontSize: 12, color: '#75777d', margin: 0, background: '#f2f4f6', borderRadius: 6, padding: '7px 10px' }}>
                  Add {formatPrice(500 - cart.subtotal)} more for free shipping
                </p>
              )}
            </div>

            <div style={{ borderTop: '1.5px solid #e2e8f0', paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#1e293b', letterSpacing: '-0.02em' }}>
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            <Link
              href={`${base}/checkout`}
              style={{
                display: 'block', textAlign: 'center',
                background: accent, color: textOnBg(accent),
                padding: '14px 24px', borderRadius: 10,
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
              className="store-cta-btn"
            >
              Proceed to Checkout
            </Link>

            <Link href={base || '/'} style={{
              display: 'block', textAlign: 'center', marginTop: 12,
              color: '#75777d', fontSize: 13, textDecoration: 'none',
              transition: 'color 0.15s',
            }} className="sf-back-link">
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .store-cta-btn:hover { opacity: 0.88 !important; }
        .sf-remove-btn:hover { color: #dc2626 !important; }
        .sf-back-link:hover { color: #1e293b !important; }
        .sf-breadcrumb-link:hover { color: #1e293b !important; }
        .stepper-btn:hover { background: #f2f4f6 !important; }
        @media (max-width: 768px) {
          .cart-grid { grid-template-columns: 1fr !important; }
          .cart-summary { position: static !important; }
          .cart-item { flex-direction: column; }
        }
      `}</style>
    </div>
  )
}
