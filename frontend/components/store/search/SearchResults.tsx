'use client'

import type { ProductSearchResult } from '@/types/search.types'
import ProductCard from '@/components/store/ProductCard'

type Props = {
  results: ProductSearchResult[]
  accent: string
}

/**
 * Renders the product grid for search results.
 * Reuses ProductCard (which already integrates WishlistButton and cart).
 * No service calls — purely presentational.
 */
export default function SearchResults({ results, accent }: Props) {
  if (results.length === 0) return null

  void accent // accent is reserved for future inline highlighting

  return (
    <section aria-label={`${results.length} search results`}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 20,
        }}
        role="list"
      >
        {results.map(({ product, categoryName }) => (
          <div key={product.id} role="listitem">
            <ProductCard product={product} categoryName={categoryName} />
          </div>
        ))}
      </div>
    </section>
  )
}
