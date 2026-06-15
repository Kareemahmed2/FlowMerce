'use client'

type Props = {
  query: string
  hasActiveFilters: boolean
  onResetFilters: () => void
  onClearQuery: () => void
  accent: string
  base: string
}

/**
 * Empty state shown when the search returns zero results.
 * Surfaces actionable suggestions based on what caused the empty state.
 */
export default function EmptySearchState({
  query,
  hasActiveFilters,
  onResetFilters,
  onClearQuery,
  accent,
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 16,
      }}
    >
      {/* Illustration */}
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em', color: '#1a1a1a' }}>
          No products found
          {query ? (
            <>
              {' for '}
              <em style={{ fontStyle: 'normal', color: accent }}>&ldquo;{query}&rdquo;</em>
            </>
          ) : null}
        </h2>
        <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.6, maxWidth: 360 }}>
          {hasActiveFilters
            ? 'Try removing some filters to see more results.'
            : query
            ? 'Check your spelling or try different keywords.'
            : 'No products are available right now.'}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: `1.5px solid ${accent}`,
              background: 'transparent',
              color: accent,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Clear Filters
          </button>
        )}
        {query && (
          <button
            type="button"
            onClick={onClearQuery}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1.5px solid #e5e7eb',
              background: 'transparent',
              color: '#555',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Clear Search
          </button>
        )}
      </div>
    </div>
  )
}
