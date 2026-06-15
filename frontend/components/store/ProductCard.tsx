'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { CatalogProduct } from '@/components/merchant/onboarding/types'
import { useStore, useCart } from './StoreProvider'
import WishlistButton from './WishlistButton'
import { textOnBg, formatPrice } from './store-types'

type Props = {
  product: CatalogProduct
  categoryName: string
  /** Show "New" badge */
  isNew?: boolean
}

export default function ProductCard({ product, categoryName, isNew }: Props) {
  const { slug } = useParams<{ slug: string }>()
  const store = useStore()
  const cart = useCart()

  const accent = store.colors.accent
  const textColor = store.colors.text
  const imgSrc = product.images?.[0] ?? null
  const href = `/store/${slug}/product/${product.id}`

  const isOutOfStock = product.stock !== undefined && product.stock <= 0

  return (
    <article
      className="sf-product-card"
      style={{
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid transparent',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.25s, border-color 0.25s, transform 0.25s',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* ── Image area ────────────────────────────────────────────────── */}
      <Link href={href} style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
        <div
          style={{
            aspectRatio: '1',
            background: '#f2f4f6',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.name}
              className="sf-product-img"
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.45s ease' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5c6cd' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}

          {/* Badges */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {isNew && (
              <span style={{
                background: accent, color: textOnBg(accent),
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>New</span>
            )}
            {isOutOfStock && (
              <span style={{
                background: '#1e293b', color: '#fff',
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>Sold out</span>
            )}
          </div>

          {/* Hover action overlay */}
          <div
            className="sf-product-overlay"
            style={{
              position: 'absolute', top: 12, right: 12,
              display: 'flex', flexDirection: 'column', gap: 6,
              opacity: 0, transition: 'opacity 0.2s',
            }}
          >
            <WishlistButton
              productId={product.id}
              meta={{
                productName: product.name,
                productImage: imgSrc,
                basePrice: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
                availableStock: product.stock ?? 0,
                isActive: true,
              }}
              size={16}
              variant="overlay"
            />
          </div>
        </div>
      </Link>

      {/* ── Info ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{
          fontSize: 11, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: '#75777d', fontWeight: 500,
        }}>
          {categoryName}
        </span>

        <Link href={href} style={{ textDecoration: 'none', color: textColor }}>
          <h3 style={{
            fontSize: 14, fontWeight: 600, margin: '2px 0 0', lineHeight: 1.35, color: '#1e293b',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {product.name}
          </h3>
        </Link>

        {product.description && (
          <p style={{
            fontSize: 13, color: '#75777d', margin: 0, lineHeight: 1.45, flex: 1,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {product.description}
          </p>
        )}

        {/* Price + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
            {formatPrice(product.price)}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault()
              if (!isOutOfStock) cart.addItem(product, categoryName)
            }}
            disabled={isOutOfStock}
            style={{
              background: 'none',
              border: `1.5px solid ${isOutOfStock ? '#c5c6cd' : '#1e293b'}`,
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12, fontWeight: 600,
              color: isOutOfStock ? '#c5c6cd' : '#1e293b',
              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
              transition: 'background 0.18s, color 0.18s, border-color 0.18s',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap',
            }}
            className={isOutOfStock ? '' : 'sf-add-btn'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {isOutOfStock ? 'Sold out' : 'Add to cart'}
          </button>
        </div>
      </div>

      <style>{`
        .sf-product-card:hover {
          box-shadow: 0 10px 30px rgba(30,41,59,0.1), 0 4px 10px rgba(30,41,59,0.04);
          border-color: rgba(30,41,59,0.12) !important;
          transform: translateY(-3px);
        }
        .sf-product-card:hover .sf-product-img { transform: scale(1.06); }
        .sf-product-card:hover .sf-product-overlay { opacity: 1 !important; }
        .sf-add-btn:hover {
          background: #1e293b !important;
          color: #fff !important;
        }
      `}</style>
    </article>
  )
}
