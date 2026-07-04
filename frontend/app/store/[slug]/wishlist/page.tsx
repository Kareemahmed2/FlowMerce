'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useStore, useCart } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useWishlist } from '@/store/wishlist-store'
import { findProduct, textOnBg, formatPrice } from '@/components/store/store-types'
import type { WishlistItemResponse } from '@/types/wishlist.types'

export default function WishlistPage() {
  const { slug } = useParams<{ slug: string }>()
  const store = useStore()
  const cart = useCart()
  const wishlist = useWishlist()
  // INT-30: prefer the backend move-to-cart endpoint; fall back to local addItem if not logged in
  const handleAddToCart = (productId: number) => {
    if (wishlist.moveToCart) {
      void wishlist.moveToCart(productId)
    } else {
      const found = findProduct(store.categories, productId)
      if (found) cart.addItem(found.product, found.category.name)
    }
  }

  const base = useStoreBase()
  const accent = store.colors.accent

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (!wishlist.isHydrated) {
    return (
      <div style={{ background: '#f7f9fb', color: '#191c1e', minHeight: '70vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px' }}>
          <div style={{ width: 220, height: 30, background: '#eceef0', borderRadius: 8, marginBottom: 32 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <WishlistSkeleton key={i} cardBg="#fff" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (wishlist.items.length === 0) {
    return (
      <div
        style={{
          background: '#f7f9fb',
          color: '#191c1e',
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            Your wishlist is empty
          </h1>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 28px', lineHeight: 1.6 }}>
            Save products you love to revisit them anytime.
          </p>
          <Link
            href={base || '/'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: accent,
              color: textOnBg(accent),
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
              padding: '13px 28px',
              borderRadius: 10,
            }}
          >
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  // ── Wishlist grid ────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#f7f9fb', color: '#191c1e', minHeight: '70vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px 72px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
            My Wishlist
          </h1>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#75777d' }}>
            {wishlist.items.length} {wishlist.items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}
          role="list"
          aria-label="Wishlist items"
        >
          {wishlist.items.map((item) => (
            <WishlistItemCard
              key={item.productId}
              item={item}
              accent={accent}
              cardBg="#fff"
              textColor="#191c1e"
              base={base}
              slug={slug}
              onAddToCart={() => handleAddToCart(item.productId)}
              onRemove={() => wishlist.removeItem(item.productId)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

type CardProps = {
  item: WishlistItemResponse
  accent: string
  cardBg: string
  textColor: string
  base: string
  slug: string
  onAddToCart: () => void
  onRemove: () => void
}

function WishlistItemCard({
  item,
  accent,
  cardBg,
  textColor,
  base,
  onAddToCart,
  onRemove,
}: CardProps) {
  const outOfStock = item.availableStock === 0

  return (
    <article
      role="listitem"
      style={{
        background: cardBg,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(30,41,59,0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      className="sf-product-card"
    >
      {/* Product image */}
      <Link href={`${base}/product/${item.productId}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{
            aspectRatio: '1',
            background: item.productImage ? undefined : '#f3f4f6',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {item.productImage ? (
            <img
              src={item.productImage}
              alt={item.productName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          {outOfStock && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 6 }}>
                Out of Stock
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.productName} from wishlist`}
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.92)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          zIndex: 2,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Info */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Link
          href={`${base}/product/${item.productId}`}
          style={{ textDecoration: 'none', color: textColor }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
            {item.productName}
          </h2>
        </Link>

        <p style={{ fontSize: 16, fontWeight: 700, color: textColor, margin: 0 }}>
          {formatPrice(item.basePrice)}
        </p>

        {/* Stock indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: outOfStock ? '#ef4444' : '#22c55e',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: '#888' }}>
            {outOfStock ? 'Out of stock' : `${item.availableStock} in stock`}
          </span>
        </div>

        {/* Add to cart */}
        <button
          type="button"
          onClick={onAddToCart}
          disabled={outOfStock}
          style={{
            marginTop: 10,
            width: '100%',
            height: 40,
            background: outOfStock ? '#f3f4f6' : accent,
            color: outOfStock ? '#999' : textOnBg(accent),
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: outOfStock ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
            fontFamily: 'inherit',
          }}
        >
          Add to Cart
        </button>
      </div>
    </article>
  )
}

function WishlistSkeleton({ cardBg }: { cardBg: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        background: cardBg,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #00000008',
      }}
    >
      <div style={{ aspectRatio: '1', background: '#f3f4f6' }} />
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 15, background: '#f3f4f6', borderRadius: 6, width: '80%' }} />
        <div style={{ height: 20, background: '#f3f4f6', borderRadius: 6, width: '50%' }} />
        <div style={{ height: 12, background: '#f3f4f6', borderRadius: 6, width: '40%', marginTop: 2 }} />
        <div style={{ height: 40, background: '#f3f4f6', borderRadius: 8, marginTop: 4 }} />
      </div>
    </div>
  )
}
