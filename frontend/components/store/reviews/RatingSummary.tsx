'use client'

import StarRating from './StarRating'
import type { RatingSummary as RatingSummaryType } from '@/types/review.types'

type Props = {
  summary: RatingSummaryType
  accent: string
}

export function computeSummary(reviews: { rating: number }[]): RatingSummaryType {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as RatingSummaryType['distribution']
  if (reviews.length === 0) return { average: 0, totalCount: 0, distribution: dist }

  let total = 0
  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
    dist[star]++
    total += r.rating
  }

  return {
    average: Math.round((total / reviews.length) * 10) / 10,
    totalCount: reviews.length,
    distribution: dist,
  }
}

export default function RatingSummary({ summary, accent }: Props) {
  const { average, totalCount, distribution } = summary

  if (totalCount === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        padding: '20px 0 24px',
        borderBottom: '1px solid #f3f4f6',
        marginBottom: 24,
      }}
      aria-label="Overall rating summary"
    >
      {/* Big average */}
      <div style={{ textAlign: 'center', minWidth: 100 }}>
        <div
          style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: '#1a1a1a', letterSpacing: '-0.03em' }}
          aria-hidden="true"
        >
          {average.toFixed(1)}
        </div>
        <StarRating rating={average} size={18} />
        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          {totalCount} {totalCount === 1 ? 'review' : 'reviews'}
        </div>
      </div>

      {/* Distribution bars */}
      <div
        style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}
        aria-label="Rating distribution"
      >
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = distribution[star]
          const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
          return (
            <div
              key={star}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              aria-label={`${star} stars: ${count} reviews (${pct}%)`}
            >
              <span style={{ fontSize: 12, color: '#555', width: 14, textAlign: 'right', flexShrink: 0 }}>
                {star}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="#f59e0b"
                />
              </svg>
              <div
                style={{
                  flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: accent,
                    borderRadius: 4,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: '#888', width: 28, flexShrink: 0, textAlign: 'right' }}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
