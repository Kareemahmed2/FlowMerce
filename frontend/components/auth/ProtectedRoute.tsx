'use client'

/**
 * ProtectedRoute — client-side auth guard.
 *
 * IMPORTANT — hydration safety:
 *   The MerchantAuthProvider reads localStorage in a useEffect (client-only).
 *   This component must not evaluate auth state until `isHydrated` is true,
 *   otherwise it will always redirect on the first render before localStorage
 *   has been read, causing a redirect loop or white-flash.
 *
 * Usage:
 *   // Basic protection
 *   <ProtectedRoute>…dashboard content…</ProtectedRoute>
 *
 *   // With role restriction
 *   <ProtectedRoute requiredRole="ADMIN">…admin panel…</ProtectedRoute>
 *
 *   // Accept multiple roles
 *   <ProtectedRoute requiredRole={['MERCHANT', 'ADMIN']}>…</ProtectedRoute>
 *
 *   // Custom redirect and fallback skeleton
 *   <ProtectedRoute redirectTo="/login" fallback={<MySkeleton />}>…</ProtectedRoute>
 *
 * Security (SEC-3):
 *   Authorization is gated SOLELY on the verified MerchantAuthProvider session.
 *   The legacy `localStorage['authToken']` fallback was removed — any non-empty
 *   string there used to grant access and skip the role check, which let a forged
 *   token reach /admin and /dashboard. When `requiredRole` is set, a session whose
 *   role is missing or not allowed is denied.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useMerchantAuthSafe } from '@/store/auth-store'
import type { UserRole } from '@/types/auth.types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Where to send unauthenticated users. Defaults to /login. */
  redirectTo?: string
  /** One or more roles required to access this route. */
  requiredRole?: UserRole | UserRole[]
  /** Rendered while auth state is being determined. Defaults to a centered spinner. */
  fallback?: React.ReactNode
}

// ─── Default skeleton ─────────────────────────────────────────────────────────

function DefaultSkeleton() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      role="status"
      aria-label="Checking authentication…"
    >
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProtectedRoute({
  children,
  redirectTo = '/login',
  requiredRole,
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter()
  const auth = useMerchantAuthSafe()
  // `ready` = hydration done AND auth decision made (render children or redirect)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Step 1: Wait for the provider to finish reading localStorage.
    // Without this guard, the effect fires with isAuthenticated=false on the
    // very first render (before hydration), causing an immediate redirect.
    const isHydrated = auth?.isHydrated ?? false
    if (!isHydrated) return

    // Step 2: Authentication is gated solely on the verified session (SEC-3).
    if (!(auth?.isAuthenticated ?? false)) {
      router.replace(redirectTo)
      return
    }

    // Step 3: Role check. When a role is required, the session MUST carry an
    // allowed role. A missing role is treated as unauthenticated (sent to login);
    // a present-but-wrong role is sent to its default authenticated area.
    if (requiredRole) {
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      if (!auth?.role || !allowed.includes(auth.role)) {
        router.replace(auth?.role ? '/dashboard' : redirectTo)
        return
      }
    }

    setReady(true)
  }, [auth?.isHydrated, auth?.isAuthenticated, auth?.role, router, redirectTo, requiredRole])

  if (!ready) {
    return <>{fallback ?? <DefaultSkeleton />}</>
  }

  return <>{children}</>
}
