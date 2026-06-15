'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useStore, useCart } from '@/components/store/StoreProvider'
import ProductCard from '@/components/store/ProductCard'
import WishlistButton from '@/components/store/WishlistButton'
import ReviewList from '@/components/store/reviews/ReviewList'
import RecentlyViewed from '@/components/store/RecentlyViewed'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import { findProduct, textOnBg, formatPrice } from '@/components/store/store-types'

// ── Quantity stepper (reused from cart style) ────────────────────────────────
function Stepper({ value, onMinus, onPlus }: { value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden',
    }}>
      <button type="button" onClick={onMinus} disabled={value <= 1}
        style={{ width: 42, height: 44, background: 'none', border: 'none', cursor: value <= 1 ? 'not-allowed' : 'pointer', color: value <= 1 ? '#c5c6cd' : '#1e293b', fontSize: 20 }}
        className="stepper-btn" aria-label="Decrease quantity"
      >−</button>
      <span style={{ width: 44, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#1e293b', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', lineHeight: '44px' }}>
        {value}
      </span>
      <button type="button" onClick={onPlus}
        style={{ width: 42, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#1e293b', fontSize: 20 }}
        className="stepper-btn" aria-label="Increase quantity"
      >+</button>
    </div>
  )
}

export default function ProductDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>()
  const store = useStore()
  const cart = useCart()

  const productId = parseInt(id, 10)
  const found = findProduct(store.categories, productId)

  const [selectedImg, setSelectedImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [addedAnim, setAddedAnim] = useState(false)

  const recentlyViewed = useRecentlyViewed(slug)
  const base = `/store/${slug}`
  const accent = store.colors.accent

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!found) {
    return (
      <div style={{ background: '#f7f9fb', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#eceef0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#75777d' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Product not found</h2>
          <p style={{ color: '#75777d', fontSize: 14, margin: '0 0 24px' }}>This product doesn&apos;t exist or was removed.</p>
          <Link href={base} style={{ color: accent, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>← Back to store</Link>
        </div>
      </div>
    )
  }

  const { product, category } = found
  const images = product.images.length > 0 ? product.images : [null]
  const related = category.products.filter((p) => p.id !== product.id).slice(0, 4)
  const isOutOfStock = product.stock !== undefined && product.stock <= 0

  // Track view
  const { addItem: addRecentView } = recentlyViewed
  useEffect(() => {
    addRecentView(product, category.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, slug])

  const handleAddToCart = () => {
    if (isOutOfStock) return
    for (let i = 0; i < qty; i++) cart.addItem(product, category.name)
    setAddedAnim(true)
    setTimeout(() => setAddedAnim(false), 2200)
  }

  return (
    <div style={{ background: '#f7f9fb', color: '#191c1e' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 0' }}>

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32, fontSize: 13 }}>
          <Link href={base} style={{ color: '#75777d', textDecoration: 'none' }} className="sf-breadcrumb-link">Home</Link>
          <span style={{ color: '#c5c6cd' }}>/</span>
          <Link href={`${base}/category/${category.id}`} style={{ color: '#75777d', textDecoration: 'none' }} className="sf-breadcrumb-link">{category.name}</Link>
          <span style={{ color: '#c5c6cd' }}>/</span>
          <span style={{ color: '#1e293b', fontWeight: 500 }}>{product.name}</span>
        </nav>

        {/* ── Product layout ──────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
          gap: 56, marginBottom: 72,
          alignItems: 'start',
        }}>
          {/* Gallery */}
          <div>
            {/* Main image */}
            <div style={{
              aspectRatio: '1', borderRadius: 16,
              overflow: 'hidden',
              background: '#fff',
              border: '1px solid #e2e8f0',
              marginBottom: 12,
              boxShadow: '0 1px 3px rgba(30,41,59,0.05)',
              position: 'relative',
            }}>
              {images[selectedImg] ? (
                <img
                  src={images[selectedImg]!}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.25s' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5c6cd' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImg(i)}
                    style={{
                      width: 68, height: 68, borderRadius: 10, overflow: 'hidden',
                      border: `2px solid ${i === selectedImg ? accent : '#e2e8f0'}`,
                      cursor: 'pointer', padding: 0, background: '#fff',
                      transition: 'border-color 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <img src={img} alt={`View ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Category + title */}
            <div>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#75777d', fontWeight: 600 }}>
                {category.name}
              </span>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: '8px 0 0', letterSpacing: '-0.02em', lineHeight: 1.2, color: '#1e293b' }}>
                {product.name}
              </h1>
            </div>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
                {formatPrice(product.price)}
              </span>
            </div>

            {/* Stock badge */}
            {product.stock !== undefined && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 12px', borderRadius: 99,
                background: isOutOfStock ? '#fef2f2' : '#ecfdf5',
                width: 'fit-content',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: isOutOfStock ? '#dc2626' : '#059669',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isOutOfStock ? '#dc2626' : '#059669' }}>
                  {isOutOfStock ? 'Out of stock' : `${product.stock} in stock`}
                </span>
              </div>
            )}

            {/* Description */}
            <p style={{
              fontSize: 15, color: '#45474c', lineHeight: 1.75, margin: 0,
              borderTop: '1px solid #e2e8f0', paddingTop: 20,
            }}>
              {product.description || 'No description available for this product.'}
            </p>

            {/* Quantity + CTA */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <Stepper
                  value={qty}
                  onMinus={() => setQty(Math.max(1, qty - 1))}
                  onPlus={() => setQty(qty + 1)}
                />
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  style={{
                    flex: 1, minWidth: 180, height: 48,
                    background: addedAnim ? '#059669' : (isOutOfStock ? '#e2e8f0' : accent),
                    color: addedAnim ? '#fff' : (isOutOfStock ? '#75777d' : textOnBg(accent)),
                    border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    transition: 'background 0.3s, transform 0.1s',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    letterSpacing: '-0.01em',
                  }}
                  className={isOutOfStock ? '' : 'sf-pdp-atc'}
                >
                  {addedAnim ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Added to cart!
                    </>
                  ) : isOutOfStock ? 'Out of stock' : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                      Add to Cart
                    </>
                  )}
                </button>
                <WishlistButton
                  productId={product.id}
                  meta={{
                    productName: product.name,
                    productImage: product.images?.[0] ?? null,
                    basePrice: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
                    availableStock: product.stock ?? 0,
                    isActive: true,
                  }}
                  size={20}
                  variant="inline"
                />
              </div>

              {/* Go to cart nudge */}
              {cart.itemCount > 0 && (
                <Link href={`${base}/cart`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: accent, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                }} className="sf-view-cart-link">
                  View cart ({cart.itemCount}) →
                </Link>
              )}
            </div>

            {/* Trust micro-features */}
            <div style={{
              borderTop: '1px solid #e2e8f0', paddingTop: 20,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {[
                { icon: '🚚', text: 'Free delivery on orders over 500 EGP' },
                { icon: '🔄', text: 'Easy 30-day returns' },
                { icon: '🔒', text: 'Secure checkout' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: '#45474c' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reviews section ──────────────────────────────────────────────────── */}
      <section style={{
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 32px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 24px', letterSpacing: '-0.01em' }}>
            Customer Reviews
          </h2>
          <ReviewList productId={product.id} accent={accent} />
        </div>
      </section>

      {/* ── Related products ─────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section style={{ background: '#eceef0', padding: '56px 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 28px', letterSpacing: '-0.01em' }}>
              You may also like
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {related.map((p) => (
                <ProductCard key={p.id} product={p} categoryName={category.name} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Recently viewed ──────────────────────────────────────────────────── */}
      <RecentlyViewed
        items={recentlyViewed.items}
        isHydrated={recentlyViewed.isHydrated}
        currentProductId={product.id}
        base={base}
        accent={accent}
        cardBg="#fff"
        textColor="#191c1e"
      />

      <style>{`
        .sf-breadcrumb-link:hover { color: #1e293b !important; }
        .stepper-btn:hover { background: #f2f4f6 !important; }
        .sf-pdp-atc:hover { filter: brightness(0.92); }
        .sf-pdp-atc:active { transform: scale(0.98); }
        .sf-view-cart-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}
