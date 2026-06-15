'use client'

import { getPageNumbers } from '@/lib/pagination'
import type { PaginationMeta } from '@/lib/pagination'

type Props = {
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  accent: string
  textColor: string
}

/**
 * Pagination controls — prev/next + numbered page buttons.
 * Shows at most 7 page items with ellipsis for large page counts.
 * Fully keyboard-navigable.
 */
export default function SearchPagination({
  pagination,
  onPageChange,
  accent,
  textColor,
}: Props) {
  const { page, totalPages, isFirst, isLast, totalItems, startIndex, endIndex } = pagination

  if (totalItems === 0 || totalPages <= 1) return null

  const pages = getPageNumbers(page, totalPages)

  const btnBase: React.CSSProperties = {
    minWidth: 36,
    height: 36,
    borderRadius: 8,
    border: '1.5px solid #e5e7eb',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    padding: '0 6px',
  }

  return (
    <nav
      aria-label="Search results pagination"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        paddingTop: 8,
      }}
    >
      {/* Results range */}
      <p
        aria-live="polite"
        aria-atomic="true"
        style={{ fontSize: 13, color: '#888', margin: 0 }}
      >
        Showing{' '}
        <strong style={{ color: textColor }}>{startIndex}–{endIndex}</strong>
        {' '}of{' '}
        <strong style={{ color: textColor }}>{totalItems}</strong> results
      </p>

      {/* Page buttons */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}
        role="list"
      >
        {/* Prev */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
          aria-label="Previous page"
          style={{
            ...btnBase,
            opacity: isFirst ? 0.35 : 1,
            cursor: isFirst ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === '...' ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden="true"
              style={{ padding: '0 4px', fontSize: 14, color: '#aaa' }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              style={{
                ...btnBase,
                background: p === page ? accent : 'transparent',
                borderColor: p === page ? accent : '#e5e7eb',
                color: p === page ? '#fff' : textColor,
                fontWeight: p === page ? 700 : 500,
              }}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
          aria-label="Next page"
          style={{
            ...btnBase,
            opacity: isLast ? 0.35 : 1,
            cursor: isLast ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
