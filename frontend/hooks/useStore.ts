'use client'

/**
 * useStore — fetches and caches storefront data by slug.
 *
 * Responsibilities:
 *  - Resolves slug → storeId via GET /stores/slug/{slug} (critical for all API calls)
 *  - Fetches full public storefront config (colors, brand, paymentMethods)
 *  - Hydration-safe: returns null until client-side data is available
 *  - Caches result in sessionStorage to avoid re-fetching on navigation
 *
 * Usage:
 *   const { storeId, storefront, isLoading } = useStore('cairo-boutique')
 *
 * TODO(BACKEND-INTEGRATION): No changes needed here after integration.
 * storeService and storefrontService already call real endpoints when
 * NEXT_PUBLIC_API_URL is set.
 *
 * Integration note:
 *   Once wired, replace StoreProvider's localStorage catalog read with:
 *     1. useStore(slug) → get storeId + colors + brand
 *     2. storefrontService.getPublicCategories(storeId) → categories
 *     3. storefrontService.getPublicProducts(storeId) → products
 */

import { useCallback, useState } from 'react'
import { storeService } from '@/services/store.service'
import { storefrontService } from '@/services/storefront.service'
import { useSafeEffect } from '@/lib/react/use-safe-effect'
import type { StorefrontPublicData, UseStoreDataReturn } from '@/types/store.types'

/** Parse paymentMethods from backend — stored as JSON string '["COD","STRIPE"]' or comma-separated */
function parsePaymentMethods(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).filter(Boolean)
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch { /* not JSON */ }
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

const SESSION_CACHE_PREFIX = 'flowmerce_sf_cache_'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  data: StorefrontPublicData
  expiry: number
}

function readCache(slug: string): StorefrontPublicData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${slug}`)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() > entry.expiry) {
      sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${slug}`)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

function writeCache(slug: string, data: StorefrontPublicData): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry = { data, expiry: Date.now() + CACHE_TTL_MS }
    sessionStorage.setItem(`${SESSION_CACHE_PREFIX}${slug}`, JSON.stringify(entry))
  } catch { /* ignore quota errors */ }
}

export function useStoreData(slug: string): UseStoreDataReturn {
  const [storeId, setStoreId] = useState<number | null>(null)
  const [storefront, setStorefront] = useState<StorefrontPublicData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStorefront = useCallback(async (force = false) => {
    setIsLoading(true)
    setError('')

    // ── 1. Check session cache (skip on forced refresh) ───────────────────
    if (!force) {
      const cached = readCache(slug)
      if (cached) {
        setStoreId(cached.storeId)
        setStorefront(cached)
        setIsLoading(false)
        return
      }
    } else {
      // Clear stale cache before re-fetching
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${slug}`)
      }
    }

    // ── 2. Resolve slug → storeId ──────────────────────────────────────────
    const storeResult = await storeService.getStoreBySlug(slug)
    if (!storeResult.ok) {
      setError(storeResult.error)
      setIsLoading(false)
      return
    }

    const resolvedStoreId = storeResult.data.storeId
    setStoreId(resolvedStoreId)

    // ── 3. Fetch full storefront config ────────────────────────────────────
    // Default colors used as fallback when theme is missing.
    const defaultColors = { background: '#FFFFFF', header: '#1A1A2E', footer: '#16213E', accent: '#E94560', text: '#1A1A1A', card: '#F9F9F9' }

    const sfResult = await storefrontService.getPublicStorefront(resolvedStoreId)
    if (!sfResult.ok) {
      // Graceful degradation: use basic data from store response
      const fallback: StorefrontPublicData = {
        storeId: resolvedStoreId,
        storeName: storeResult.data.storeName,
        storeUrl: storeResult.data.storeUrl,
        status: storeResult.data.status,
        brandName: storeResult.data.brandName || storeResult.data.storeName,
        logoUrl: storeResult.data.logoUrl,
        colors: defaultColors,
        paymentMethods: parsePaymentMethods(storeResult.data.paymentMethods) as StorefrontPublicData['paymentMethods'],
      }
      setStorefront(fallback)
      writeCache(slug, fallback)
      setIsLoading(false)
      return
    }

    // Backend returns StorefrontTemplateResponse: { storeId, storeName, storeUrl, status, theme: { background, header, … }, pages, … }
    // Brand data (brandName, logoUrl, paymentMethods) lives in StoreResponse — merge both.
    const rawTemplate = sfResult.data as unknown as {
      storeName?: string
      storeUrl?: string
      status?: string
      theme?: { background?: string; header?: string; footer?: string; accent?: string; text?: string; card?: string }
      pages?: StorefrontPublicData['pages']
    }

    const merged: StorefrontPublicData = {
      storeId: resolvedStoreId,
      storeName: rawTemplate.storeName ?? storeResult.data.storeName,
      storeUrl: rawTemplate.storeUrl ?? storeResult.data.storeUrl,
      status: (rawTemplate.status ?? storeResult.data.status) as StorefrontPublicData['status'],
      brandName: storeResult.data.brandName || storeResult.data.storeName,
      logoUrl: storeResult.data.logoUrl,
      colors: rawTemplate.theme
        ? {
            background: rawTemplate.theme.background || defaultColors.background,
            header:     rawTemplate.theme.header     || defaultColors.header,
            footer:     rawTemplate.theme.footer     || defaultColors.footer,
            accent:     rawTemplate.theme.accent     || defaultColors.accent,
            text:       rawTemplate.theme.text       || defaultColors.text,
            card:       rawTemplate.theme.card       || defaultColors.card,
          }
        : defaultColors,
      paymentMethods: parsePaymentMethods(storeResult.data.paymentMethods) as StorefrontPublicData['paymentMethods'],
      // FEAT-RENDER: keep the published page/component tree for the dynamic renderer.
      pages: rawTemplate.pages,
    }
    writeCache(slug, merged)
    setStorefront(merged)
    setIsLoading(false)
  }, [slug])

  useSafeEffect((isMounted) => {
    fetchStorefront().then(() => {
      if (!isMounted()) {
        setStoreId(null)
        setStorefront(null)
      }
    })
  }, [slug])

  return { storeId, storefront, isLoading, error, refresh: fetchStorefront }
}
