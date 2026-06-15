/**
 * Product search page — /store/[slug]/search
 *
 * This is intentionally a Server Component (no 'use client') so it can render
 * a <Suspense> boundary. Next.js App Router requires that any component calling
 * useSearchParams() be wrapped in Suspense — the boundary lives here, the hook
 * lives inside SearchPageContent (the client component).
 *
 * URL params consumed: q, cat, minPrice, maxPrice, rating, inStock, sort, page, size
 * All are optional; defaults are applied inside useProductSearch.
 *
 * Direct-linkable: /store/[slug]/search?q=shoes&cat=3&sort=price_asc
 * Refresh-safe: URL is the single source of truth.
 */

import { Suspense } from 'react'
import SearchPageContent from '@/components/store/search/SearchPageContent'
import SearchSkeleton from '@/components/store/search/SearchSkeleton'

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPageContent />
    </Suspense>
  )
}
