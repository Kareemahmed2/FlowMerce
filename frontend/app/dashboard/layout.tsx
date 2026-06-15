'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/merchant/dashboard/DashboardShell'
import { MerchantBackendSync } from '@/components/merchant/dashboard/MerchantBackendSync'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { httpClient } from '@/lib/api/http-client'
import { useMerchantAuth } from '@/store/auth-store'

/** Registers the 401 → logout interceptor once per session. */
function AuthInterceptor() {
  const auth = useMerchantAuth()
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = httpClient.addResponseInterceptor((result) => {
      if (!result.ok && result.status === 401) {
        auth.clearSession()
        router.replace('/login?reason=session_expired')
      }
      return result
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute redirectTo="/login?redirect=/dashboard">
      <AuthInterceptor />
      <DashboardShell>
        <MerchantBackendSync />
        {children}
      </DashboardShell>
    </ProtectedRoute>
  )
}
