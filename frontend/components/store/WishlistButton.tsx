'use client'

import { useState } from 'react'
import { useWishlistSafe } from '@/store/wishlist-store'
import type { WishlistItemMeta } from '@/types/wishlist.types'

type Props = {
  productId: number
  meta: WishlistItemMeta
  /** Pixel size for the heart icon */
  size?: number
  /**
   * 'overlay' — floats in the top-right corner of a product card image.
   * 'inline'  — renders as a full button with label (e.g. on product detail page).
   */
  variant?: 'overlay' | 'inline'
}

export default function WishlistButton({
  productId,
  meta,
  size = 18,
  variant = 'overlay',
}: Props) {
  // useWishlistSafe returns null outside WishlistProvider (e.g. a card rendered
  // outside the store layout). Render nothing rather than throwing.
  const wishlist = useWishlistSafe()

  // localPending: fast-path guard that prevents a second click before the React
  // state from the store's pendingIds update has had a chance to propagate.
  const [localPending, setLocalPending] = useState(false)

  if (!wishlist) return null

  // Suppress the button until wishlist hydration completes.
  // Without this, products already in the wishlist would briefly show a hollow
  // heart (isInWishlist returns false before localStorage is read).
  if (!wishlist.isHydrated) {
    // overlay: position:absolute — null causes no layout shift
    if (variant === 'overlay') return null
    // inline: render an invisible placeholder to reserve space and prevent reflow
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '11px 18px',
          borderRadius: 10,
          border: '1px solid transparent',
          minWidth: 152, // approximate width of "Save to Wishlist"
          opacity: 0,
          pointerEvents: 'none',
          flexShrink: 0,
        }}
      />
    )
  }

  const inWishlist = wishlist.isInWishlist(productId)
  // Authoritative pending: covers the case where two buttons reference the same
  // productId (e.g. a product appears in both a card and a detail view).
  const storePending = wishlist.pendingIds.has(productId)
  const isPending = localPending || storePending

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isPending) return
    setLocalPending(true)
    try {
      if (inWishlist) {
        await wishlist.removeItem(productId)
      } else {
        await wishlist.addItem(productId, meta)
      }
    } finally {
      setLocalPending(false)
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(4px)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isPending ? 'wait' : 'pointer',
    zIndex: 2,
    boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    padding: 0,
  }

  const inlineStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 18px',
    borderRadius: 10,
    border: `1px solid ${inWishlist ? '#fecaca' : '#e5e7eb'}`,
    background: inWishlist ? '#fef2f2' : 'transparent',
    cursor: isPending ? 'wait' : 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: inWishlist ? '#dc2626' : '#555',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={
        inWishlist
          ? `Remove ${meta.productName} from wishlist`
          : `Add ${meta.productName} to wishlist`
      }
      aria-pressed={inWishlist}
      style={variant === 'overlay' ? overlayStyle : inlineStyle}
    >
      {isPending ? (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={inWishlist ? '#dc2626' : '#aaa'}
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ animation: 'spin 0.75s linear infinite' }}
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={inWishlist ? '#dc2626' : 'none'}
          stroke={inWishlist ? '#dc2626' : '#888'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transition: 'fill 0.2s, stroke 0.2s' }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )}
      {variant === 'inline' && (
        <span>{inWishlist ? 'Saved to Wishlist' : 'Save to Wishlist'}</span>
      )}
    </button>
  )
}
