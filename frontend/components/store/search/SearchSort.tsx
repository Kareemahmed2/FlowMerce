'use client'

import type { ProductSearchSort } from '@/types/search.types'
import { SEARCH_SORT_OPTIONS, SORT_LABELS } from '@/types/search.types'

type Props = {
  value: ProductSearchSort
  onChange: (sort: ProductSearchSort) => void
  accent: string
  textColor: string
}

/**
 * Sort order selector.
 * Uses a native <select> for maximum accessibility and mobile compatibility.
 * No service calls — purely controlled via props.
 */
export default function SearchSort({ value, onChange, accent, textColor }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label
        htmlFor="search-sort"
        style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap' }}
      >
        Sort by
      </label>
      <select
        id="search-sort"
        value={value}
        onChange={(e) => onChange(e.target.value as ProductSearchSort)}
        aria-label="Sort results"
        style={{
          height: 36,
          padding: '0 32px 0 12px',
          borderRadius: 8,
          border: '1.5px solid #e5e7eb',
          fontSize: 13,
          fontWeight: 500,
          color: textColor,
          background: 'transparent',
          fontFamily: 'inherit',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
      >
        {SEARCH_SORT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {SORT_LABELS[opt]}
          </option>
        ))}
      </select>
    </div>
  )
}
