'use client'

type Props = {
  /** 0–5, supports decimals for half-star rendering */
  rating: number
  /** Pixel size of each star */
  size?: number
  /** Show numeric value alongside the stars */
  showValue?: boolean
  /** Accessible label override */
  ariaLabel?: string
}

/**
 * Read-only star rating display.
 * Renders full, half, and empty stars based on the decimal rating value.
 * Use StarPicker (inside ReviewForm) for interactive star selection.
 */
export default function StarRating({
  rating,
  size = 16,
  showValue = false,
  ariaLabel,
}: Props) {
  const clipped = Math.min(5, Math.max(0, rating))

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `Rating: ${clipped.toFixed(1)} out of 5 stars`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
    >
      {[1, 2, 3, 4, 5].map((pos) => {
        const fill = clipped >= pos ? 'full' : clipped >= pos - 0.5 ? 'half' : 'empty'
        return <Star key={pos} fill={fill} size={size} />
      })}
      {showValue && (
        <span
          aria-hidden="true"
          style={{ fontSize: size * 0.85, fontWeight: 600, color: '#555', marginLeft: 4 }}
        >
          {clipped.toFixed(1)}
        </span>
      )}
    </span>
  )
}

// ── Internal star shape ────────────────────────────────────────────────────────

type StarFill = 'full' | 'half' | 'empty'

function Star({ fill, size }: { fill: StarFill; size: number }) {
  const id = `half-${size}` // gradient id; same value across stars is intentional

  if (fill === 'full') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="#f59e0b"
          stroke="#f59e0b"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (fill === 'half') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d1d5db" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={`url(#${id})`}
          stroke="#e5e7eb"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // empty
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="#e5e7eb"
        stroke="#d1d5db"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
