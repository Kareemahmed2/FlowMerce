'use client'

import type { FilterableKey, ProductFilterState } from '@/types/search.types'
import { SORT_LABELS } from '@/types/search.types'

type Props = {
  filters: ProductFilterState
  categoryName: string | undefined
  onClearFilter: (key: FilterableKey) => void
  onResetAll: () => void
  accent: string
}

interface FilterChip {
  key: FilterableKey
  label: string
}

/**
 * Displays active filters as dismissible chips.
 * Renders nothing when no filters are active.
 */
export default function ActiveFilters({
  filters,
  categoryName,
  onClearFilter,
  onResetAll,
  accent,
}: Props) {
  const chips: FilterChip[] = []

  if (filters.categoryId !== null) {
    chips.push({
      key: 'categoryId',
      label: `Category: ${categoryName ?? filters.categoryId}`,
    })
  }
  if (filters.minPrice !== null) {
    chips.push({ key: 'minPrice', label: `Min: ${filters.minPrice.toLocaleString()} EGP` })
  }
  if (filters.maxPrice !== null) {
    chips.push({ key: 'maxPrice', label: `Max: ${filters.maxPrice.toLocaleString()} EGP` })
  }
  if (filters.minRating !== null) {
    chips.push({ key: 'minRating', label: `${filters.minRating}★ & up` })
  }
  if (filters.inStockOnly) {
    chips.push({ key: 'inStockOnly', label: 'In Stock Only' })
  }

  if (chips.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Active filters"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
    >
      <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Filters:</span>

      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onClearFilter(chip.key)}
          aria-label={`Remove filter: ${chip.label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            border: `1.5px solid ${accent}40`,
            background: `${accent}12`,
            color: accent,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
        >
          {chip.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ))}

      <button
        type="button"
        onClick={onResetAll}
        aria-label="Clear all filters"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#888',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textDecoration: 'underline',
          padding: '4px 2px',
        }}
      >
        Clear all
      </button>
    </div>
  )
}
