import { headers } from 'next/headers'
import StoreProvider from '@/components/store/StoreProvider'
import { StoreBaseProvider } from '@/components/store/StoreBaseProvider'
import CustomerAuthProvider from '@/components/store/CustomerAuthProvider'
import RealtimeProvider from '@/components/store/RealtimeProvider'
import CustomerNotificationListener from '@/components/store/CustomerNotificationListener'
import { WishlistProvider } from '@/store/wishlist-store'
import StoreHeader from '@/components/store/StoreHeader'
import StoreFooter from '@/components/store/StoreFooter'
import CrossTabSyncInit from '@/components/store/CrossTabSyncInit'

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const hdrs = await headers()
  const isSubdomain = hdrs.get('x-store-subdomain') === '1'
  const base = isSubdomain ? '' : `/store/${slug}`

  return (
    <StoreBaseProvider base={base}>
      <CustomerAuthProvider>
        <RealtimeProvider>
          <CustomerNotificationListener />
          <StoreProvider slug={slug}>
            <WishlistProvider>
            {/* Initialise cross-tab sync once per store layout mount */}
            <CrossTabSyncInit />
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <StoreHeader />
              <main style={{ flex: 1 }}>{children}</main>
              <StoreFooter />
            </div>
          </WishlistProvider>
          </StoreProvider>
        </RealtimeProvider>
      </CustomerAuthProvider>
    </StoreBaseProvider>
  )
}
