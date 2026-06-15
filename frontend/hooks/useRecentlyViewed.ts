'use client'

/**
 * Recently viewed products — per-store, versioned-localStorage-backed.
 *
 * Storage: versioned-storage v1, key = recently_viewed_{storeSlug}
 * Max items:   10 (oldest overflow)
 * Dedup:       by productId (most recent visit wins position 0)
 * isHydrated:  false until the first useEffect fires (prevents SSR flicker)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { storeEvents } from '@/lib/store-events'
import { readVersioned, writeVersioned, versionedSchema } from '@/lib/storage/versioned-storage'
import type { CatalogProduct } from '@/components/merchant/onboarding/types'

const MAX_ITEMS = 10
const RV_VERSION = 1

export interface RecentlyViewedItem {
  productId: number
  productName: string
  productImage: string | null
  price: string
  categoryName: string
  viewedAt: string
}

// ── Shape validation ───────────────────────────────────────────────────────────

function isValidItem(v: unknown): v is RecentlyViewedItem {
  if (!v || typeof v !== 'object') return false
  const item = v as Record<string, unknown>
  return (
    typeof item.productId === 'number' &&
    typeof item.productName === 'string' &&
    typeof item.viewedAt === 'string'
  )
}

function isItemArray(v: unknown): v is RecentlyViewedItem[] {
  return Array.isArray(v) && v.every(isValidItem)
}

// ── Versioned storage schema ───────────────────────────────────────────────────

function rvSchema(slug: string) {
  return versionedSchema<RecentlyViewedItem[]>({
    key: `recently_viewed_${slug}`,
    version: RV_VERSION,
    validator: isItemArray,
    defaultValue: () => [],
    migrate: (raw, _v) => {
      if (Array.isArray(raw)) return raw.filter(isValidItem)
      return null
    },
  })
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface UseRecentlyViewedReturn {
  items: RecentlyViewedItem[]
  isHydrated: boolean
  addItem: (product: CatalogProduct, categoryName: string) => void
}

export function useRecentlyViewed(storeSlug: string): UseRecentlyViewedReturn {
  const [items, setItems] = useState<RecentlyViewedItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const slugRef = useRef(storeSlug)

  // Reload from versioned localStorage whenever the store changes.
  // Sets isHydrated = false first so consumers don't show stale data.
  useEffect(() => {
    slugRef.current = storeSlug
    setIsHydrated(false)
    const saved = readVersioned(rvSchema(storeSlug))
    setItems(saved)
    setIsHydrated(true)
  }, [storeSlug])

  const addItem = useCallback((product: CatalogProduct, categoryName: string) => {
    const slug = slugRef.current
    const schema = rvSchema(slug)
    const newItem: RecentlyViewedItem = {
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] ?? null,
      price: String(product.price),
      categoryName,
      viewedAt: new Date().toISOString(),
    }

    setItems((prev) => {
      const filtered = prev.filter((i) => i.productId !== product.id)
      const next = [newItem, ...filtered].slice(0, MAX_ITEMS)
      writeVersioned(schema, next)
      return next
    })

    storeEvents.dispatch('productViewed', {
      productId: product.id,
      productName: product.name,
      storeSlug: slug,
    })
  }, [])

  return { items, isHydrated, addItem }
}
