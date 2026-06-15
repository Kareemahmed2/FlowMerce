'use client'

/**
 * Customer wishlist context — SSR-safe, localStorage-backed, optimistic updates.
 *
 * Scope:   Scoped per store slug — storage key = flowmerce_wishlist_{slug}.
 *          Uses useParams() so no slug prop is needed on the provider.
 *          When slug changes (different store), items reload from the new key.
 *
 * Design:
 *  - isHydrated starts false; flips true after first useEffect (same as auth-store).
 *  - itemsRef: stable latest-items snapshot for callbacks (no stale closures).
 *  - pendingIdsRef: source of truth for in-flight operations; pendingIds state
 *    is a reactive snapshot for UI consumption.
 *  - Optimistic add/remove: local state updates first; rolls back on error.
 *  - Shape validation on every localStorage read (malformed data is discarded).
 *  - Migration: on first load of the scoped key, migrates from the old global
 *    'flowmerce_wishlist' key so existing users don't lose their wishlists.
 *
 * TODO(BACKEND-INTEGRATION): When auth is live:
 *  1. On customer login, merge the localStorage wishlist into the backend.
 *  2. Attach Bearer token to every service call via useCustomerAuth().
 *  3. Replace localStorage persistence with API-authoritative state.
 *  4. Drive syncStatus / lastSyncedAt from real server responses.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useParams } from 'next/navigation'
import type { WishlistItemMeta, WishlistItemResponse, WishlistState } from '@/types/wishlist.types'
import { wishlistService } from '@/services/wishlist.service'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { httpClient } from '@/lib/api/http-client'
import { readVersioned, writeVersioned, versionedSchema } from '@/lib/storage/versioned-storage'

// ── Storage key helpers ────────────────────────────────────────────────────────

const LEGACY_KEY = 'flowmerce_wishlist' // pre-scoping global key

function scopedKey(slug: string): string {
  return `flowmerce_wishlist_${slug}`
}

// ── Shape validation ───────────────────────────────────────────────────────────

function isValidItem(value: unknown): value is WishlistItemResponse {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.wishlistId === 'number' &&
    typeof v.productId === 'number' &&
    typeof v.productName === 'string' &&
    typeof v.addedAt === 'string'
  )
}

function isItemArray(v: unknown): v is WishlistItemResponse[] {
  return Array.isArray(v) && v.every(isValidItem)
}

// ── Versioned storage helpers ──────────────────────────────────────────────────

const WISHLIST_VERSION = 1

function wishlistSchema(key: string) {
  return versionedSchema<WishlistItemResponse[]>({
    key,
    version: WISHLIST_VERSION,
    validator: isItemArray,
    defaultValue: () => [],
    // v0: raw unversioned array (before versioned-storage was introduced)
    // v0: also covers the old global key data migrated to scoped key
    migrate: (raw, _fromVersion) => {
      if (Array.isArray(raw)) return raw.filter(isValidItem)
      return null
    },
  })
}

function readItems(key: string): WishlistItemResponse[] {
  return readVersioned(wishlistSchema(key))
}

function writeItems(key: string, items: WishlistItemResponse[]): void {
  writeVersioned(wishlistSchema(key), items)
}

/**
 * One-time migration from the old global key to the new scoped key.
 * Reads the legacy key using the versioned reader so it handles any format.
 */
function migrateIfNeeded(newKey: string): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(newKey) !== null) return // already has scoped data
  const legacyRaw = localStorage.getItem(LEGACY_KEY)
  if (!legacyRaw) return
  // Copy raw bytes; readVersioned will handle any format on next read
  localStorage.setItem(newKey, legacyRaw)
  localStorage.removeItem(LEGACY_KEY)
}

// ── Context ────────────────────────────────────────────────────────────────────

const WishlistCtx = createContext<WishlistState | null>(null)

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistCtx)
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider')
  return ctx
}

/** Safe variant — returns null outside the provider (components rendered outside store layout). */
export function useWishlistSafe(): WishlistState | null {
  return useContext(WishlistCtx)
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const auth = useCustomerAuth()
  // Resolve slug from the current route — WishlistProvider always lives inside
  // app/store/[slug]/layout.tsx, so slug is guaranteed to be present.
  const { slug: rawSlug } = useParams<{ slug?: string }>()
  const storeSlug = rawSlug ?? 'default'
  const storageKey = scopedKey(storeSlug)

  const [items, setItems] = useState<WishlistItemResponse[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [syncStatus, setSyncStatus] = useState<WishlistState['syncStatus']>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const itemsRef = useRef<WishlistItemResponse[]>(items)
  useEffect(() => { itemsRef.current = items }, [items])

  const pendingIdsRef = useRef<Set<number>>(new Set())
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set())

  const addPending = useCallback((id: number) => {
    pendingIdsRef.current.add(id)
    setPendingIds(new Set(pendingIdsRef.current))
  }, [])

  const removePending = useCallback((id: number) => {
    pendingIdsRef.current.delete(id)
    setPendingIds(new Set(pendingIdsRef.current))
  }, [])

  // Hydrate from localStorage first, then sync from backend if logged in.
  useEffect(() => {
    setIsHydrated(false)
    setItems([])
    pendingIdsRef.current.clear()
    setPendingIds(new Set())

    migrateIfNeeded(storageKey)
    const saved = readItems(storageKey)
    if (saved.length > 0) setItems(saved)
    setIsHydrated(true)
  }, [storageKey])

  // When customer logs in, fetch their backend wishlist and merge it.
  useEffect(() => {
    if (!auth.isLoggedIn || !isHydrated) return
    let cancelled = false

    wishlistService.getWishlist(auth.getAuthHeader()).then((result) => {
      if (cancelled || !result.ok) return
      // Merge: backend is authoritative; replace local items with backend items
      const backendItems = result.data.items ?? []
      if (backendItems.length > 0) {
        setItems(backendItems)
      }
    })

    return () => { cancelled = true }
  }, [auth.isLoggedIn, storageKey])

  // Persist whenever items change — guarded by isHydrated to prevent writing
  // an empty array during the slug-transition reset above.
  useEffect(() => {
    if (!isHydrated) return
    writeItems(storageKey, items)
  }, [items, isHydrated, storageKey])

  const isInWishlist = useCallback((productId: number) => {
    return itemsRef.current.some((i) => i.productId === productId)
  }, [])

  const addItem = useCallback(
    async (productId: number, meta: WishlistItemMeta) => {
      if (itemsRef.current.some((i) => i.productId === productId)) return
      if (pendingIdsRef.current.has(productId)) return

      addPending(productId)
      setIsLoading(true)
      setSyncStatus('syncing')

      const optimisticItem: WishlistItemResponse = {
        wishlistId: Date.now(),
        productId,
        productName: meta.productName,
        productImage: meta.productImage,
        basePrice: meta.basePrice,
        availableStock: meta.availableStock,
        isActive: meta.isActive,
        addedAt: new Date().toISOString(),
      }

      setItems((prev) => [optimisticItem, ...prev])

      const result = await wishlistService.addToWishlist({ productId }, auth.getAuthHeader())
      if (result.ok) {
        setLastSyncedAt(new Date().toISOString())
        setSyncStatus('idle')
      } else {
        setItems((prev) => prev.filter((i) => i.productId !== productId))
        setSyncStatus('error')
      }
      removePending(productId)
      setIsLoading(false)
    },
    [addPending, removePending, auth]
  )

  const removeItem = useCallback(
    async (productId: number) => {
      if (pendingIdsRef.current.has(productId)) return

      const snapshot = itemsRef.current

      addPending(productId)
      setIsLoading(true)
      setSyncStatus('syncing')
      setItems((prev) => prev.filter((i) => i.productId !== productId))

      const result = await wishlistService.removeFromWishlist(productId, auth.getAuthHeader())
      if (result.ok) {
        setLastSyncedAt(new Date().toISOString())
        setSyncStatus('idle')
      } else {
        setItems(snapshot)
        setSyncStatus('error')
      }
      removePending(productId)
      setIsLoading(false)
    },
    [addPending, removePending, auth]
  )

  const moveToCart = useCallback(
    async (productId: number) => {
      if (pendingIdsRef.current.has(productId)) return

      addPending(productId)
      setIsLoading(true)
      const result = await wishlistService.moveToCart(productId, auth.getAuthHeader())
      if (result.ok) {
        setItems((prev) => prev.filter((i) => i.productId !== productId))
      }
      removePending(productId)
      setIsLoading(false)
    },
    [addPending, removePending, auth]
  )

  const value: WishlistState = useMemo(
    () => ({
      isHydrated,
      items,
      isLoading,
      pendingIds,
      syncStatus,
      lastSyncedAt,
      addItem,
      removeItem,
      isInWishlist,
      moveToCart,
    }),
    [isHydrated, items, isLoading, pendingIds, syncStatus, lastSyncedAt, addItem, removeItem, isInWishlist, moveToCart]
  )

  return <WishlistCtx.Provider value={value}>{children}</WishlistCtx.Provider>
}
