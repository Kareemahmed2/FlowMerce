'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMerchantAuth } from '@/store/auth-store'
import { MerchantOnboarding } from '@/components/merchant/onboarding/MerchantOnboarding'

export default function OnboardingPage() {
  const auth = useMerchantAuth()
  const router = useRouter()

  useEffect(() => {
    if (!auth.isHydrated) return
    if (!auth.session?.accessToken) {
      router.replace('/login?redirect=/onboarding')
    }
  }, [auth.isHydrated, auth.session, router])

  if (auth.isHydrated && !auth.session?.accessToken) {
    return null
  }

  return <MerchantOnboarding />
}
