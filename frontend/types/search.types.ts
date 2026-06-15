/**
 * Search system types — shaped to match future Spring Boot ProductSearchController DTOs.
 * TODO(BACKEND-INTEGRATION): Validate these against the real API response schema.
 */

import type { CatalogProduct } from '@/components/merchant/onboarding/types'
import type { PaginationMeta } from '@/lib/pagination'

// ── Sort ───────────────────────────────────────────────────────────────────────

export const SEARCH_SORT_OPTIONS = [
  'relevance',
  'price_asc',
  'price_desc',
  'name_asc',
  'name_desc',
  'newest',
] as const

export type ProductSearchSort = (typeof SEARCH_SORT_OPTIONS)[number]

export const SORT_LABELS: Record<ProductSearchSort, string> = {
  relevance: 'Most Relevant',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  name_asc: 'Name: A → Z',
  name_desc: 'Name: Z → A',
  newest: 'Newest First',
}

// ── Filter state ───────────────────────────────────────────────────────────────

/** Typed, parsed representation of the active search filters. */
export interface ProductFilterState {
  query: string
  categoryId: number | null
  minPrice: number | null
  maxPrice: number | null
  /**
   * Minimum star rating (1–5).
   * TODO(BACKEND-INTEGRATION): Wire up when products have real review aggregates.
   */
  minRating: number | null
  inStockOnly: boolean
  sort: ProductSearchSort
  page: number
  pageSize: number
}

export const DEFAULT_FILTER_STATE: Readonly<ProductFilterState> = {
  query: '',
  categoryId: null,
  minPrice: null,
  maxPrice: null,
  minRating: null,
  inStockOnly: false,
  sort: 'relevance',
  page: 1,
  pageSize: 12,
}

// ── URL param keys ─────────────────────────────────────────────────────────────

/**
 * Raw URL query param keys used by the search system.
 * All values are strings (as they appear in the URL).
 * Parsed into ProductFilterState by parseSearchFilters() in useProductSearch.
 *
 * URL param → filter field mapping:
 *   q          → query
 *   cat        → categoryId
 *   minPrice   → minPrice
 *   maxPrice   → maxPrice
 *   rating     → minRating
 *   inStock    → inStockOnly
 *   sort       → sort
 *   page       → page
 *   size       → pageSize
 */
export const SEARCH_PARAM_KEYS = [
  'q', 'cat', 'minPrice', 'maxPrice', 'rating', 'inStock', 'sort', 'page', 'size',
] as const

export type SearchParamKey = (typeof SEARCH_PARAM_KEYS)[number]

// ── Result types ───────────────────────────────────────────────────────────────

/** Single search result — product + category context + ranking metadata. */
export interface ProductSearchResult {
  product: CatalogProduct
  categoryId: number
  categoryName: string
  /**
   * Relevance score 0–100. Drives ordering when sort = 'relevance'.
   * TODO(BACKEND-INTEGRATION): Replace with backend-computed relevance score.
   */
  score: number
  /**
   * INT-36: star rating from the backend ProductResponse.rating field (0–5).
   * Null when the product has no reviews yet.
   */
  rating: number | null
}

// ── Facets ─────────────────────────────────────────────────────────────────────

export interface SearchFacet {
  id: number | string
  label: string
  /** Number of results that match this facet value given the current other filters. */
  count: number
}

export interface SearchPriceRange {
  min: number
  max: number
}

/**
 * Facets computed from the current result set (before pagination, after filtering).
 * Used to drive the filter panel UI.
 *
 * TODO(BACKEND-INTEGRATION): Receive facets directly from the backend response
 * rather than computing them client-side.
 */
export interface SearchFacets {
  categories: SearchFacet[]
  priceRange: SearchPriceRange | null
  /** TODO(BACKEND-INTEGRATION): populate from real review data. */
  availableRatings: number[]
}

// ── Response envelope ──────────────────────────────────────────────────────────

/**
 * Full search response.
 * TODO(BACKEND-INTEGRATION): Maps to Spring Boot Page<ProductSearchResultDTO>
 * with a facets field in the response envelope.
 */
export interface ProductSearchResponse {
  results: ProductSearchResult[]
  pagination: PaginationMeta
  facets: SearchFacets
  /** The query string that produced this result set (echoed from the request). */
  appliedQuery: string
  /** Total items matching all active filters, before pagination. */
  totalMatches: number
}

// ── Hook return type ───────────────────────────────────────────────────────────

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

/** Filter keys that can be set via setFilter() — excludes query/sort/pagination. */
export type FilterableKey = 'categoryId' | 'minPrice' | 'maxPrice' | 'minRating' | 'inStockOnly'

/** Value type for each filterable key. */
export type FilterValueMap = {
  categoryId: number | null
  minPrice: number | null
  maxPrice: number | null
  minRating: number | null
  inStockOnly: boolean
}

export interface UseProductSearchReturn {
  /** Live value of the search input (may be ahead of the committed URL query). */
  draftQuery: string
  /** Committed, URL-derived filter state. */
  filters: ProductFilterState
  status: SearchStatus
  response: ProductSearchResponse | null
  error: string
  hasResults: boolean
  hasActiveFilters: boolean
  setQuery: (q: string) => void
  submitQuery: (q: string) => void
  setFilter: <K extends FilterableKey>(key: K, value: FilterValueMap[K]) => void
  clearFilter: (key: FilterableKey) => void
  setSort: (sort: ProductSearchSort) => void
  goToPage: (page: number) => void
  resetFilters: () => void
}
