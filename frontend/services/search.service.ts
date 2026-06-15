/**
 * Product search service.
 *
 * Backend endpoint: GET /stores/{storeId}/products/search?keyword=
 * The backend returns matching products; client-side filtering/sorting/pagination
 * is applied on the result for facets, price filters, and sort options.
 */

import type { CatalogCategory, CatalogProduct } from '@/components/merchant/onboarding/types'
import type {
  ProductSearchResponse,
  ProductSearchResult,
  SearchFacets,
  SearchPriceRange,
} from '@/types/search.types'
import { SEARCH_SORT_OPTIONS } from '@/types/search.types'
import { httpClient } from '@/lib/api/http-client'
import { apiSuccess } from '@/types/api.types'
import type { ApiResult } from '@/types/api.types'
import type { ProductResponse } from '@/types/product.types'
import {
  parseQueryBool,
  parseQueryEnum,
  parseQueryFloat,
  parseQueryInt,
  parseQueryString,
} from '@/lib/query-params'
import {
  buildPaginationMeta,
  normalizePage,
  normalizePageSize,
  paginate,
} from '@/lib/pagination'

// ── Scoring ────────────────────────────────────────────────────────────────────

function scoreProduct(productName: string, description: string, categoryName: string, query: string): number {
  if (!query) return 50
  const q = query.toLowerCase()
  const name = productName.toLowerCase()
  const desc = (description || '').toLowerCase()
  const cat = categoryName.toLowerCase()
  if (name === q) return 100
  if (name.startsWith(q)) return 90
  if (name.includes(q)) return 75
  if (cat === q) return 60
  if (cat.includes(q)) return 50
  if (desc.includes(q)) return 30
  return 0
}

// ── Facet builder ──────────────────────────────────────────────────────────────

function buildFacets(allResults: ProductSearchResult[], categories: CatalogCategory[]): SearchFacets {
  const catCounts = new Map<number, number>()
  for (const r of allResults) {
    catCounts.set(r.categoryId, (catCounts.get(r.categoryId) ?? 0) + 1)
  }
  const categoryFacets = categories
    .map((cat) => ({ id: cat.id, label: cat.name, count: catCounts.get(cat.id) ?? 0 }))
    .filter((f) => f.count > 0)

  let priceRange: SearchPriceRange | null = null
  if (allResults.length > 0) {
    let min = Infinity, max = -Infinity
    for (const r of allResults) {
      const price = parseFloat(String(r.product.price))
      if (!isNaN(price)) { if (price < min) min = price; if (price > max) max = price }
    }
    if (Number.isFinite(min) && Number.isFinite(max)) {
      priceRange = { min: Math.floor(min), max: Math.ceil(max) }
    }
  }

  return { categories: categoryFacets, priceRange, availableRatings: allResults.length > 0 ? [1, 2, 3, 4, 5] : [] }
}

// ── Sorter ─────────────────────────────────────────────────────────────────────

function sortResults(results: ProductSearchResult[], sort: string): ProductSearchResult[] {
  const sorted = [...results]
  switch (sort) {
    case 'price_asc':  sorted.sort((a, b) => parseFloat(String(a.product.price)) - parseFloat(String(b.product.price))); break
    case 'price_desc': sorted.sort((a, b) => parseFloat(String(b.product.price)) - parseFloat(String(a.product.price))); break
    case 'name_asc':   sorted.sort((a, b) => a.product.name.localeCompare(b.product.name)); break
    case 'name_desc':  sorted.sort((a, b) => b.product.name.localeCompare(a.product.name)); break
    case 'newest':     sorted.sort((a, b) => b.product.id - a.product.id); break
    default:           sorted.sort((a, b) => b.score - a.score); break
  }
  return sorted
}

/** Group flat backend products into CatalogCategory[] for the client-side pipeline. */
function backendProductsToCategories(products: ProductResponse[]): CatalogCategory[] {
  const byCategory = new Map<number, CatalogCategory>()
  byCategory.set(0, { id: 0, name: 'Uncategorized', products: [] })

  for (const p of products) {
    const catId = p.categoryId ?? 0
    const catName = p.categoryName ?? 'Uncategorized'
    if (!byCategory.has(catId)) byCategory.set(catId, { id: catId, name: catName, products: [] })
    const product: CatalogProduct = {
      id: p.productId,
      name: p.name,
      price: String(p.basePrice),
      description: p.description ?? '',
      images: p.media.map((m) => m.mediaUrl),
      stock: p.availableQuantity,
      status: p.isActive ? 'active' : 'inactive',
    }
    byCategory.get(catId)!.products.push(product)
  }
  return Array.from(byCategory.values()).filter((c) => c.products.length > 0)
}

// ── Service ────────────────────────────────────────────────────────────────────

export const searchService = {
  async search(
    rawParams: Record<string, string | undefined>,
    _categories: CatalogCategory[],
    storeId?: number | null
  ): Promise<ApiResult<ProductSearchResponse>> {
    if (!storeId) {
      return apiSuccess({
        results: [],
        pagination: buildPaginationMeta(1, normalizePageSize(rawParams.size), 0),
        facets: { categories: [], priceRange: null, availableRatings: [] },
        appliedQuery: parseQueryString(rawParams.q, '', 200),
        totalMatches: 0,
      })
    }

    const keyword = parseQueryString(rawParams.q, '', 200)
    const backendResult = await httpClient.get<ProductResponse[]>(
      `/stores/${storeId}/products/search?keyword=${encodeURIComponent(keyword)}`
    )
    if (!backendResult.ok) return backendResult
    const categories = backendProductsToCategories(backendResult.data)

    const query = parseQueryString(rawParams.q, '', 200)
    const categoryId = parseQueryInt(rawParams.cat ?? null, 0, { min: 0 }) || null
    const minPrice = rawParams.minPrice != null && rawParams.minPrice !== ''
      ? parseQueryFloat(rawParams.minPrice, 0, { min: 0 }) : null
    const maxPrice = rawParams.maxPrice != null && rawParams.maxPrice !== ''
      ? parseQueryFloat(rawParams.maxPrice, Infinity, { min: 0 }) : null
    const minRating = rawParams.rating != null && rawParams.rating !== ''
      ? parseQueryInt(rawParams.rating, 0, { min: 1, max: 5 }) : null
    const inStockOnly = parseQueryBool(rawParams.inStock ?? null, false)
    const sort = parseQueryEnum(rawParams.sort ?? null, SEARCH_SORT_OPTIONS, 'relevance')
    const pageSize = normalizePageSize(rawParams.size)

    const scored: ProductSearchResult[] = []
    for (const category of categories) {
      for (const product of category.products) {
        const score = scoreProduct(product.name, product.description ?? '', category.name, query)
        if (query && score === 0) continue
        // INT-36: use the real rating from the backend ProductResponse.
        scored.push({ product, categoryId: category.id, categoryName: category.name, score, rating: product.rating ?? null })
      }
    }

    const filtered = scored.filter((r) => {
      if (categoryId !== null && r.categoryId !== categoryId) return false
      const price = parseFloat(String(r.product.price))
      if (minPrice !== null && !isNaN(price) && price < minPrice) return false
      if (maxPrice !== null && !isNaN(price) && price > maxPrice) return false
      if (minRating !== null && (r.rating === null || r.rating < minRating)) return false
      if (inStockOnly && (r.product.stock ?? 0) <= 0) return false
      return true
    })

    const facets = buildFacets(filtered, categories)
    const sortedResults = sortResults(filtered, sort)
    const totalMatches = sortedResults.length
    const page = normalizePage(rawParams.page, Math.max(1, Math.ceil(totalMatches / pageSize)))
    const pagination = buildPaginationMeta(page, pageSize, totalMatches)
    const pageResults = paginate(sortedResults, page, pageSize)

    return apiSuccess({ results: pageResults, pagination, facets, appliedQuery: query, totalMatches })
  },
}
