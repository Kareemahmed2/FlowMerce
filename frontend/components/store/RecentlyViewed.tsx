'use client'

import Link from 'next/link'
import type { RecentlyViewedItem } from '@/hooks/useRecentlyViewed'
import { formatPrice } from '@/components/store/store-types'

type Props = {
  items: RecentlyViewedItem[]
  isHydrated?: boolean
  currentProductId: number
  base: string
  accent: string
  cardBg: string
  textColor: string
}

/**
 * Displays recently viewed products, excluding the currently viewed one.
 * Pure presentational — all data from props.
 */
export default function RecentlyViewed({
  items,
  isHydrated = true,
  currentProductId,
  base,
  accent,
  cardBg,
  textColor,
}: Props) {
  // Don't render before hydration — avoids blank→populated flash
  if (!isHydrated) return null

  const displayItems = items
    .filter((i) => i.productId !== currentProductId)
    .slice(0, 6)

  if (displayItems.length === 0) return null

  return (
    <section
      aria-label="Recently viewed products"
      style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 64px' }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          margin: '0 0 20px',
          letterSpacing: '-0.01em',
          color: textColor,
        }}
      >
        Recently Viewed
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 16,
        }}
        role="list"
      >
        {displayItems.map((item) => (
          <article key={item.productId} role="listitem">
            <Link href={`${base}/product/${item.productId}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                style={{
                  background: cardBg,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #00000008',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                className="rv-card"
              >
                {/* Thumbnail */}
                <div
                  style={{
                    aspectRatio: '1',
                    background: '#f3f4f6',
                    overflow: 'hidden',
                  }}
                >
                  {item.productImage ? (
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#d1d5db',
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '10px 12px 12px' }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: textColor,
                      margin: '0 0 4px',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.productName}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: accent, margin: 0 }}>
                    {formatPrice(item.price)}
                  </p>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>

      <style>{`.rv-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }`}</style>
    </section>
  )
}
