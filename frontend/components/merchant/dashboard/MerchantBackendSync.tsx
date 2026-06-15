'use client'

/**
 * Backend-sync layer for the merchant dashboard.
 *
 * On mount, calls:
 *   - merchantService.getMyProfile()  → business name
 *   - storeService.getMyStores()      → first store info (storeId, brand, payment methods)
 *
 * If both succeed, the data is patched into the existing `flowmerce_store_v1`
 * localStorage payload — that way every existing hook/component (useFlowmerceStore,
 * useFlowmerceOrders, dashboard widgets) keeps reading from its familiar local source
 * but the source is now mirrored from the backend on every load.
 *
 * In mock mode (no NEXT_PUBLIC_API_URL), this is a no-op fallthrough.
 *
 * Renders nothing. Place at the top of the dashboard layout.
 */

import { useEffect } from 'react'
import { merchantService } from '@/services/merchant.service'
import { storeService } from '@/services/store.service'
import { useMerchantAuth } from '@/store/auth-store'
import { loadPersistedStore, savePersistedStore, createDefaultPersistedStore } from '@/lib/local-store/store'

/** localStorage key used by the dashboard StoreSelector to remember the active store. */
export const ACTIVE_STORE_ID_KEY = 'flowmerce_active_store_id'

export function MerchantBackendSync() {
  const auth = useMerchantAuth()

  useEffect(() => {
    let cancelled = false

    Promise.all([
      merchantService.getMyProfile(auth.getAuthHeader()),
      storeService.getMyStores(auth.getAuthHeader()),
    ])
      .then(([profileR, storesR]) => {
        if (cancelled) return

        const profile = profileR.ok ? profileR.data : null
        const stores = storesR.ok ? storesR.data : []
        if (!profile && stores.length === 0) return

        // Pick the active store: persisted choice → fallback to first available.
        let active = stores[0] ?? null
        if (typeof window !== 'undefined' && stores.length > 0) {
          const persisted = Number(localStorage.getItem(ACTIVE_STORE_ID_KEY))
          const match = stores.find((s) => s.storeId === persisted)
          if (match) active = match
        }

        const cur = loadPersistedStore() ?? createDefaultPersistedStore()

        // Patch the persisted store with backend data without clobbering local-only fields.
        savePersistedStore({
          ...cur,
          brand: {
            ...cur.brand,
            name: profile?.businessName || active?.storeName || cur.brand.name,
            logoPreview: active?.logoUrl ?? cur.brand.logoPreview,
          },
          storeUrl: active?.storeUrl || cur.storeUrl,
          published: active?.status === 'PUBLISHED',
        })

        // Patch storeId into the auth session for any code that needs it.
        if (active && active.storeId) {
          auth.patchStoreId(active.storeId)
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_STORE_ID_KEY, String(active.storeId))
          }
        }
      })
      .catch((err: unknown) => {
        // Backend unreachable — dashboard shows cached localStorage data.
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[FlowMerce] Backend sync failed — showing cached data.', msg)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
