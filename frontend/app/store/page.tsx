'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMerchantAuthSafe } from '@/store/auth-store'
import { storeService } from '@/services/store.service'
import { generateStoreUrl } from '@/components/merchant/onboarding/constants'

/** Strip the old `.flowmerce.io` suffix left by the previous slug generator. */
function fixLegacySlug(storeUrl: string, storeName: string): string {
  // Old format was "slug.flowmerce.io" or ".flowmerce.io" (Arabic names)
  if (!storeUrl.endsWith('.flowmerce.io')) return storeUrl
  const stripped = storeUrl.replace(/\.flowmerce\.io$/, '').replace(/^\./, '')
  return stripped || generateStoreUrl(storeName)
}

export default function StoreIndexPage() {
  const auth = useMerchantAuthSafe()
  const router = useRouter()

  useEffect(() => {
    if (!auth?.isHydrated) return

    const redirect = async () => {
      if (!auth.session?.accessToken) {
        router.replace('/')
        return
      }

      const headers = auth.getAuthHeader()
      const result = await storeService.getMyStores(headers)

      if (!result.ok || result.data.length === 0) {
        router.replace('/dashboard')
        return
      }

      const store = result.data[0]
      const cleanSlug = fixLegacySlug(store.storeUrl, store.storeName)

      // If slug was broken, patch it in the backend so it works correctly
      if (cleanSlug !== store.storeUrl) {
        await storeService.updateStore(
          store.storeId,
          { storeName: store.storeName, storeUrl: cleanSlug },
          headers
        )
      }

      router.replace(`/store/${cleanSlug}`)
    }

    void redirect()
  }, [auth?.isHydrated, auth?.session, router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f0f0f',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <p style={{ color: '#888', fontSize: 14 }}>Loading your store…</p>
      </div>
    </div>
  )
}
