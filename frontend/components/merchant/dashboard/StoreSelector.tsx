'use client'

/**
 * Dashboard topbar store switcher.
 *
 * - Loads the merchant's stores via `storeService.getMyStores`.
 * - Persists the active store id to `localStorage` (key: ACTIVE_STORE_ID_KEY)
 *   so it survives page refreshes.
 * - On change, patches `auth.storeId` and triggers a reload of the persisted
 *   store payload + a `storeEvents.cartUpdated`-style refresh signal so the
 *   rest of the dashboard re-fetches with the new store context.
 *
 * Renders nothing visible during loading or if the merchant has zero stores —
 * a soft "Create your first store" link is shown instead.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMerchantAuth } from '@/store/auth-store'
import { storeService } from '@/services/store.service'
import type { StoreResponse } from '@/types/store.types'
import { ACTIVE_STORE_ID_KEY } from './MerchantBackendSync'

const S = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: 8 } as const,
  label: { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 },
  pill: { fontSize: 13, fontWeight: 600, color: '#0F0E0C', padding: '6px 12px', borderRadius: 8, background: '#faf8f5', border: '1px solid #ede8df' } as const,
  select: { fontSize: 13, fontWeight: 600, color: '#0F0E0C', padding: '7px 30px 7px 12px', borderRadius: 8, background: '#faf8f5', border: '1px solid #ede8df', cursor: 'pointer', appearance: 'none' as const, backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'5\' viewBox=\'0 0 8 5\'%3E%3Cpath fill=\'%23555\' d=\'M4 5L0 0h8z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', fontFamily: 'inherit' },
  emptyLink: { fontSize: 12, fontWeight: 600, color: '#854F0B', textDecoration: 'underline', textDecorationStyle: 'dotted' as const } as const,
}

export function StoreSelector() {
  const auth = useMerchantAuth()
  const [stores, setStores] = useState<StoreResponse[] | null>(null)

  useEffect(() => {
    let cancelled = false
    storeService.getMyStores(auth.getAuthHeader()).then((r) => {
      if (cancelled) return
      setStores(r.ok ? r.data : [])
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initial fetch hasn't completed yet — render nothing to avoid layout shift.
  if (stores === null) return null

  // No stores: nudge the merchant to start onboarding.
  if (stores.length === 0) {
    return (
      <Link href="/onboarding" style={S.emptyLink}>
        Create your first store →
      </Link>
    )
  }

  // Single store: render a static pill (no dropdown).
  if (stores.length === 1) {
    return (
      <div style={S.wrap}>
        <span style={S.label}>Store</span>
        <span style={S.pill}>{stores[0].storeName}</span>
      </div>
    )
  }

  // Multi-store: dropdown.
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value)
    if (!id || id === auth.storeId) return
    auth.patchStoreId(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_STORE_ID_KEY, String(id))
    }
    // Full reload so every dashboard hook re-fetches with the new storeId.
    // Simpler than wiring up a cross-component refresh signal.
    window.location.reload()
  }

  return (
    <div style={S.wrap}>
      <span style={S.label}>Store</span>
      <select
        value={auth.storeId ?? stores[0].storeId}
        onChange={handleChange}
        style={S.select}
        aria-label="Switch store"
      >
        {stores.map((s) => (
          <option key={s.storeId} value={s.storeId}>
            {s.storeName}
          </option>
        ))}
      </select>
    </div>
  )
}
