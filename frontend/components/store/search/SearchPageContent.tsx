'use client'

/**
 * Inner client component for the search page.
 * Separated from page.tsx so the server component can wrap it in <Suspense>,
 * satisfying Next.js's requirement for useSearchParams() calls.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useProductSearch } from '@/hooks/useProductSearch'
import SearchBar from './SearchBar'
import SearchFilters from './SearchFilters'
import SearchSort from './SearchSort'
import SearchResults from './SearchResults'
import SearchPagination from './SearchPagination'
import ActiveFilters from './ActiveFilters'
import EmptySearchState from './EmptySearchState'

export default function SearchPageContent() {
  const store = useStore()
  const {
    draftQuery,
    filters,
    status,
    response,
    error,
    hasResults,
    hasActiveFilters,
    setQuery,
    submitQuery,
    setFilter,
    clearFilter,
    setSort,
    goToPage,
    resetFilters,
  } = useProductSearch()

  const [filtersOpen, setFiltersOpen] = useState(false)

  const base = useStoreBase()
  const accent = store.colors.accent
  const bg = store.colors.background
  const text = store.colors.text
  const card = store.colors.card

  // Find category name for active filter chip label
  const activeCategoryName = filters.categoryId
    ? store.categories.find((c) => c.id === filters.categoryId)?.name
    : undefined

  const isLoading = status === 'loading'

  return (
    <div style={{ background: bg, color: text, minHeight: '70vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav
          aria-label="Breadcrumb"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#999' }}
        >
          <Link href={base || '/'} style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: text, fontWeight: 500 }}>Search</span>
        </nav>

        {/* ── Search input ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28, maxWidth: 800 }}>
          <SearchBar
            value={draftQuery}
            onChange={setQuery}
            onSearch={submitQuery}
            accent={accent}
            cardBg={card}
            textColor={text}
            size="lg"
            autoFocus={!draftQuery}
            label="Search products in this store"
          />
        </div>

        {/* ── Toolbar: result count + sort ────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {/* Result count / status */}
          <div>
            {(isLoading || status === 'idle') ? (
              <span style={{ fontSize: 14, color: '#aaa' }}>Searching…</span>
            ) : status === 'success' ? (
              <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                style={{ fontSize: 14, color: '#888', margin: 0 }}
              >
                {response!.totalMatches === 0 ? (
                  'No results'
                ) : (
                  <>
                    <strong style={{ color: text }}>{response!.totalMatches}</strong>
                    {' '}
                    {response!.totalMatches === 1 ? 'result' : 'results'}
                    {filters.query && (
                      <>
                        {' for '}
                        <em style={{ fontStyle: 'normal', color: accent }}>
                          &ldquo;{filters.query}&rdquo;
                        </em>
                      </>
                    )}
                  </>
                )}
              </p>
            ) : null}
          </div>

          {/* Sort + mobile filter button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mobile: toggle filters panel */}
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="search-filters-panel"
              className="search-mobile-filter-btn"
              style={{
                display: 'none', // shown via CSS media query
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1.5px solid #e5e7eb',
                background: 'transparent',
                fontSize: 13,
                fontWeight: 600,
                color: text,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="20" y2="12" />
                <line x1="12" y1="18" x2="20" y2="18" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, display: 'inline-block' }} />
              )}
            </button>

            <SearchSort value={filters.sort} onChange={setSort} accent={accent} textColor={text} />
          </div>
        </div>

        {/* ── Active filters ──────────────────────────────────────────────── */}
        {hasActiveFilters && (
          <div style={{ marginBottom: 16 }}>
            <ActiveFilters
              filters={filters}
              categoryName={activeCategoryName}
              onClearFilter={clearFilter}
              onResetAll={resetFilters}
              accent={accent}
            />
          </div>
        )}

        {/* ── Main layout ─────────────────────────────────────────────────── */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}
          className="search-layout"
        >
          {/* ── Filter panel ─────────────────────────────────────────────── */}
          <div
            id="search-filters-panel"
            className={filtersOpen ? 'search-filters-open' : ''}
            style={{ position: 'sticky', top: 80 }}
          >
            <SearchFilters
              filters={filters}
              facets={response?.facets ?? null}
              onFilterChange={setFilter}
              accent={accent}
              textColor={text}
              cardBg={card}
            />
          </div>

          {/* ── Results area ─────────────────────────────────────────────── */}
          <div>
            {/* Error */}
            {status === 'error' && (
              <div role="alert" style={{ padding: '16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: 14, marginBottom: 20 }}>
                {error}
              </div>
            )}

            {/* Loading / idle skeleton
                Show skeleton for both 'loading' and 'idle' (store not yet hydrated)
                to prevent a blank content area flash on first paint. */}
            {(isLoading || status === 'idle') && (
              <div
                aria-hidden="true"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 20,
                  opacity: 0.4,
                  pointerEvents: 'none',
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <ResultSkeleton key={i} cardBg={card} />
                ))}
              </div>
            )}

            {/* Results — only rendered after a successful fetch */}
            {status === 'success' && hasResults && (
              <SearchResults results={response!.results} accent={accent} />
            )}

            {/* Empty state — only rendered after fetch confirms zero results */}
            {status === 'success' && !hasResults && (
              <EmptySearchState
                query={filters.query}
                hasActiveFilters={hasActiveFilters}
                onResetFilters={resetFilters}
                onClearQuery={() => submitQuery('')}
                accent={accent}
                base={base}
              />
            )}

            {/* Pagination */}
            {status === 'success' && hasResults && response && (
              <div style={{ marginTop: 36 }}>
                <SearchPagination
                  pagination={response.pagination}
                  onPageChange={goToPage}
                  accent={accent}
                  textColor={text}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Responsive styles ──────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .search-layout {
            grid-template-columns: 1fr !important;
          }
          #search-filters-panel {
            display: none;
            position: static !important;
          }
          #search-filters-panel.search-filters-open {
            display: block !important;
          }
          .search-mobile-filter-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  )
}

function ResultSkeleton({ cardBg }: { cardBg: string }) {
  return (
    <div aria-hidden="true" style={{ background: cardBg, borderRadius: 12, overflow: 'hidden', border: '1px solid #00000008' }}>
      <div style={{ aspectRatio: '1', background: '#e5e7eb' }} />
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '60%' }} />
        <div style={{ height: 16, background: '#e5e7eb', borderRadius: 4 }} />
        <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '40%' }} />
        <div style={{ height: 36, background: '#e5e7eb', borderRadius: 8, marginTop: 4 }} />
      </div>
    </div>
  )
}
