'use client'

/**
 * Orchestrates the search page state.
 *
 * Responsibilities:
 *  - Reads URL params via useDebouncedUrlState (SSR-safe, Suspense-bounded)
 *  - Manages `draftQuery`: the live text-input value (ahead of the committed URL)
 *  - Debounces query → URL writes (350 ms); immediate on submit
 *  - Calls searchService when URL params change (cancels in-flight on new param)
 *  - Exposes typed action functions with stable references (won't cause cascading re-renders)
 *
 * React Query migration path:
 *  Replace the useEffect + useState block with a useQuery call.
 *  Everything else (URL sync, draftQuery, actions) stays identical.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useDebouncedUrlState } from '@/lib/url-state'
import { parseQueryBool, parseQueryEnum, parseQueryFloat, parseQueryInt, parseQueryString } from '@/lib/query-params'
import { normalizePage, normalizePageSize } from '@/lib/pagination'
import { useSafeEffect } from '@/lib/react/use-safe-effect'
import { searchService } from '@/services/search.service'
import {
  DEFAULT_FILTER_STATE,
  SEARCH_SORT_OPTIONS,
} from '@/types/search.types'
import type {
  FilterableKey,
  FilterValueMap,
  ProductFilterState,
  ProductSearchResponse,
  ProductSearchSort,
  SearchStatus,
  UseProductSearchReturn,
} from '@/types/search.types'

// ── URL ↔ Filter mapping ───────────────────────────────────────────────────────

/** Map filter keys to their canonical URL param names. */
const FILTER_TO_URL: Record<FilterableKey, string> = {
  categoryId: 'cat',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  minRating: 'rating',
  inStockOnly: 'inStock',
}

function parseFiltersFromUrl(params: Record<string, string>): ProductFilterState {
  return {
    query: parseQueryString(params.q, ''),
    categoryId:
      params.cat != null && params.cat !== ''
        ? parseQueryInt(params.cat, 0, { min: 0 }) || null
        : null,
    minPrice:
      params.minPrice != null && params.minPrice !== ''
        ? parseQueryFloat(params.minPrice, 0, { min: 0 })
        : null,
    maxPrice:
      params.maxPrice != null && params.maxPrice !== ''
        ? parseQueryFloat(params.maxPrice, Infinity, { min: 0 })
        : null,
    minRating:
      params.rating != null && params.rating !== ''
        ? parseQueryInt(params.rating, 0, { min: 1, max: 5 })
        : null,
    inStockOnly: parseQueryBool(params.inStock ?? null, false),
    sort: parseQueryEnum(params.sort ?? null, SEARCH_SORT_OPTIONS, 'relevance'),
    page: normalizePage(params.page),
    pageSize: normalizePageSize(params.size),
  }
}

function computeHasActiveFilters(filters: ProductFilterState): boolean {
  return (
    filters.categoryId !== null ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.minRating !== null ||
    filters.inStockOnly ||
    filters.sort !== DEFAULT_FILTER_STATE.sort
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useProductSearch(): UseProductSearchReturn {
  const store = useStore()
  const { params, updateParams, debouncedUpdate, cancelDebounce } =
    useDebouncedUrlState(350)

  // Derive typed filters from the URL — stable reference when URL is unchanged
  const filters = useMemo(() => parseFiltersFromUrl(params), [params])

  // ── Draft query ────────────────────────────────────────────────────────────
  // `draftQuery` tracks what the input shows; may be ahead of the committed URL.
  const [draftQuery, setDraftQuery] = useState<string>(filters.query)

  // Sync draftQuery when the URL query changes externally (back button, direct link)
  const prevCommittedQuery = useRef(filters.query)
  useSafeEffect(() => {
    if (filters.query !== prevCommittedQuery.current) {
      prevCommittedQuery.current = filters.query
      setDraftQuery(filters.query)
    }
  }, [filters.query])

  // ── Search state ───────────────────────────────────────────────────────────
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [response, setResponse] = useState<ProductSearchResponse | null>(null)
  const [error, setError] = useState('')

  // Use a ref for categories so the search effect doesn't re-run every time
  // StoreProvider re-renders (categories object reference changes on each render
  // but the data is stable after initial localStorage hydration).
  const categoriesRef = useRef(store.categories)
  categoriesRef.current = store.categories

  // ── Execute search ─────────────────────────────────────────────────────────
  // Re-runs only when the URL params actually change (params is stable from useMemo).
  useSafeEffect((isMounted) => {
    // INT-47: wait for the store to hydrate before searching.
    // Use storeId as the hydration signal instead of categories.length —
    // a store may genuinely have 0 categories but storeId is always set when loaded.
    if (!store.storeId) {
      setStatus('idle')
      return
    }

    setStatus('loading')
    setError('')

    searchService
      .search(params, categoriesRef.current, store.storeId)
      .then((result) => {
        if (!isMounted()) return
        if (result.ok) {
          setResponse(result.data)
          setStatus('success')
        } else {
          setError(result.error)
          setStatus('error')
        }
      })
  }, [params]) // `params` is stable from useMemo — only changes when URL changes

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Update the text input and schedule a debounced URL commit (350 ms). */
  const setQuery = useCallback(
    (q: string) => {
      setDraftQuery(q)
      debouncedUpdate({ q: q || null, page: null })
    },
    [debouncedUpdate]
  )

  /** Commit the query to the URL immediately (cancels any pending debounce). */
  const submitQuery = useCallback(
    (q: string) => {
      cancelDebounce()
      setDraftQuery(q)
      updateParams({ q: q || null, page: null })
    },
    [cancelDebounce, updateParams]
  )

  /** Set a single filter value and reset to page 1. */
  const setFilter = useCallback(
    <K extends FilterableKey>(key: K, value: FilterValueMap[K]) => {
      const urlKey = FILTER_TO_URL[key]
      const urlValue =
        value === null || value === false || value === 0
          ? null
          : String(value)
      updateParams({ [urlKey]: urlValue, page: null })
    },
    [updateParams]
  )

  /** Clear a single filter (equivalent to setFilter(key, null/false)). */
  const clearFilter = useCallback(
    (key: FilterableKey) => {
      updateParams({ [FILTER_TO_URL[key]]: null, page: null })
    },
    [updateParams]
  )

  /** Change the sort order and reset to page 1. */
  const setSort = useCallback(
    (sort: ProductSearchSort) => {
      updateParams({ sort: sort === DEFAULT_FILTER_STATE.sort ? null : sort, page: null })
    },
    [updateParams]
  )

  /** Navigate to a specific page without resetting other params. */
  const goToPage = useCallback(
    (page: number) => {
      updateParams({ page: page <= 1 ? null : String(page) }, { scroll: false })
    },
    [updateParams]
  )

  /** Clear all filters except the query string and reset to page 1. */
  const resetFilters = useCallback(() => {
    cancelDebounce()
    updateParams({
      cat: null,
      minPrice: null,
      maxPrice: null,
      rating: null,
      inStock: null,
      sort: null,
      page: null,
    })
  }, [cancelDebounce, updateParams])

  return {
    draftQuery,
    filters,
    status,
    response,
    error,
    hasResults: (response?.totalMatches ?? 0) > 0,
    hasActiveFilters: computeHasActiveFilters(filters),
    setQuery,
    submitQuery,
    setFilter,
    clearFilter,
    setSort,
    goToPage,
    resetFilters,
  }
}
