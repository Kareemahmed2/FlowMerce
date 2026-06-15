'use client'

import { useState } from 'react'
import type { FilterableKey, FilterValueMap, ProductFilterState, SearchFacets } from '@/types/search.types'

type Props = {
  filters: ProductFilterState
  facets: SearchFacets | null
  onFilterChange: <K extends FilterableKey>(key: K, value: FilterValueMap[K]) => void
  accent: string
  textColor: string
  cardBg: string
}

/**
 * Filter sidebar panel.
 * No service calls — all data comes from props.
 * Sections: Category, Price Range, In Stock.
 * Rating section is present but disabled pending real review data.
 */
export default function SearchFilters({
  filters,
  facets,
  onFilterChange,
  accent,
  textColor,
  cardBg,
}: Props) {
  return (
    <aside
      aria-label="Search filters"
      style={{
        background: cardBg,
        borderRadius: 12,
        border: '1px solid #00000008',
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Category */}
      <CategoryFilter
        facets={facets?.categories ?? []}
        selected={filters.categoryId}
        onChange={(id) => onFilterChange('categoryId', id)}
        accent={accent}
        textColor={textColor}
      />

      {/* Price Range */}
      <PriceFilter
        minPrice={filters.minPrice}
        maxPrice={filters.maxPrice}
        priceRange={facets?.priceRange ?? null}
        onMinChange={(v) => onFilterChange('minPrice', v)}
        onMaxChange={(v) => onFilterChange('maxPrice', v)}
        accent={accent}
        textColor={textColor}
      />

      {/* In Stock */}
      <InStockFilter
        checked={filters.inStockOnly}
        onChange={(v) => onFilterChange('inStockOnly', v)}
        accent={accent}
        textColor={textColor}
      />
    </aside>
  )
}

// ── Sub-sections ───────────────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
  textColor,
}: {
  title: string
  children: React.ReactNode
  textColor: string
}) {
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: textColor, margin: '0 0 12px', opacity: 0.6 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function CategoryFilter({
  facets,
  selected,
  onChange,
  accent,
  textColor,
}: {
  facets: { id: number | string; label: string; count: number }[]
  selected: number | null
  onChange: (id: number | null) => void
  accent: string
  textColor: string
}) {
  const allCount = facets.reduce((sum, f) => sum + f.count, 0)

  return (
    <FilterSection title="Category" textColor={textColor}>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* "All" option */}
        <li>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
            <input
              type="radio"
              name="category-filter"
              checked={selected === null}
              onChange={() => onChange(null)}
              style={{ accentColor: accent, width: 15, height: 15, flexShrink: 0 }}
            />
            <span style={{ fontSize: 14, color: textColor, flex: 1 }}>All Categories</span>
            <span style={{ fontSize: 12, color: '#aaa' }}>{allCount}</span>
          </label>
        </li>

        {facets.map((facet) => (
          <li key={facet.id}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
              <input
                type="radio"
                name="category-filter"
                checked={selected === facet.id}
                onChange={() => onChange(Number(facet.id))}
                style={{ accentColor: accent, width: 15, height: 15, flexShrink: 0 }}
              />
              <span style={{ fontSize: 14, color: textColor, flex: 1, lineHeight: 1.3 }}>
                {facet.label}
              </span>
              <span style={{ fontSize: 12, color: '#aaa' }}>{facet.count}</span>
            </label>
          </li>
        ))}

        {facets.length === 0 && (
          <li style={{ fontSize: 13, color: '#aaa', padding: '2px 0' }}>No categories</li>
        )}
      </ul>
    </FilterSection>
  )
}

function PriceFilter({
  minPrice,
  maxPrice,
  priceRange,
  onMinChange,
  onMaxChange,
  accent,
  textColor,
}: {
  minPrice: number | null
  maxPrice: number | null
  priceRange: { min: number; max: number } | null
  onMinChange: (v: number | null) => void
  onMaxChange: (v: number | null) => void
  accent: string
  textColor: string
}) {
  const [localMin, setLocalMin] = useState(minPrice != null ? String(minPrice) : '')
  const [localMax, setLocalMax] = useState(maxPrice != null ? String(maxPrice) : '')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    padding: '0 10px',
    borderRadius: 8,
    border: '1.5px solid #e5e7eb',
    fontSize: 13,
    fontFamily: 'inherit',
    color: textColor,
    background: 'transparent',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const handleMinBlur = () => {
    const n = localMin === '' ? null : parseFloat(localMin)
    onMinChange(n !== null && !isNaN(n) ? n : null)
    if (n === null || isNaN(n)) setLocalMin('')
  }

  const handleMaxBlur = () => {
    const n = localMax === '' ? null : parseFloat(localMax)
    onMaxChange(n !== null && !isNaN(n) ? n : null)
    if (n === null || isNaN(n)) setLocalMax('')
  }

  return (
    <FilterSection title="Price (EGP)" textColor={textColor}>
      {priceRange && (
        <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 8px' }}>
          {priceRange.min.toLocaleString()} – {priceRange.max.toLocaleString()} EGP
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label htmlFor="price-min" style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>Min</label>
          <input
            id="price-min"
            type="number"
            min={0}
            placeholder="0"
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={handleMinBlur}
            onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="price-max" style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>Max</label>
          <input
            id="price-max"
            type="number"
            min={0}
            placeholder="Any"
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={handleMaxBlur}
            onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
            style={inputStyle}
          />
        </div>
      </div>
    </FilterSection>
  )
}

function InStockFilter({
  checked,
  onChange,
  accent,
  textColor,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  accent: string
  textColor: string
}) {
  return (
    <FilterSection title="Availability" textColor={textColor}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ accentColor: accent, width: 16, height: 16 }}
          aria-label="Show in-stock items only"
        />
        <span style={{ fontSize: 14, color: textColor }}>In Stock Only</span>
      </label>
    </FilterSection>
  )
}
