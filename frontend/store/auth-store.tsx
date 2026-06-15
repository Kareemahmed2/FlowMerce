'use client'

/**
 * Merchant auth context — role-aware, SSR-safe session management.
 *
 * Key design decisions:
 *  - `isHydrated` starts false and flips to true after the first useEffect,
 *    preventing ProtectedRoute from redirecting before localStorage is read.
 *  - `readSession` is SSR-safe (guards `typeof window`).
 *  - `writeSession` / `removeSession` also guard against SSR for safety.
 *  - `clearSession` removes ALL auth-related keys, not just the token.
 *  - Writing to `localStorage['authToken']` (legacy) keeps existing dashboard
 *    code working without any changes.
 *
 * TODO(BACKEND-INTEGRATION): When adding an HTTP client, attach getAuthHeader()
 * to the request interceptor so every call sends the correct Bearer token.
 * TODO(BACKEND-INTEGRATION): On a 401 response, call clearSession() then
 * redirect to /login.
 * TODO(BACKEND-INTEGRATION): Implement token refresh logic — call
 * POST /auth/merchant/refresh before the access token expires (check expiresAt).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import type { AuthSession, AuthUser, MerchantAuthState, UserRole } from '@/types/auth.types'
import { authService } from '@/services/auth.service'
import { httpClient } from '@/lib/api/http-client'

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'flowmerce_session_v2'
/** Legacy key — kept for backwards compat with existing dashboard/API code */
const LEGACY_TOKEN_KEY = 'authToken'
/** Removed on logout to prevent stale "remember me" state */
const REMEMBER_ME_KEY = 'rememberMe'

// ─── Storage helpers (all SSR-safe) ───────────────────────────────────────────

function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<AuthSession>
    // Treat expired sessions as absent (30s buffer for clock skew)
    if (s.expiresAt && Date.now() > s.expiresAt - 30_000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    // SEC-6: tokens are NOT stored in localStorage; the httpOnly cookie handles auth.
    // We still need a valid-looking session for isAuthenticated / getAuthHeader to work.
    // accessToken is '' when coming from cookie-only flow — callers that pass
    // getAuthHeader() send Authorization: Bearer '' which is ignored by the filter;
    // the cookie takes over automatically via credentials: 'include' in httpClient.
    return { accessToken: '', refreshToken: '', ...s } as AuthSession
  } catch {
    return null
  }
}

function writeSession(session: AuthSession): void {
  if (typeof window === 'undefined') return
  // SEC-6: store only non-sensitive metadata (user info, expiry, storeId) — NOT the JWT.
  // The actual access token lives in an httpOnly cookie set by the backend,
  // which JavaScript cannot read (mitigates XSS token theft).
  const { accessToken: _drop, refreshToken: _drop2, ...meta } = session
  localStorage.setItem(SESSION_KEY, JSON.stringify(meta))
}

function removeSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  localStorage.removeItem(REMEMBER_ME_KEY)
  // SEC-6: httpOnly cookie is cleared server-side by the logout endpoint.
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MerchantAuthCtx = createContext<MerchantAuthState | null>(null)

export function useMerchantAuth(): MerchantAuthState {
  const ctx = useContext(MerchantAuthCtx)
  if (!ctx) throw new Error('useMerchantAuth must be used inside MerchantAuthProvider')
  return ctx
}

/** Safe version — returns null when used outside the provider (e.g. shared layouts). */
export function useMerchantAuthSafe(): MerchantAuthState | null {
  return useContext(MerchantAuthCtx)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MerchantAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSessionState] = useState<AuthSession | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Token refresh scheduler ────────────────────────────────────────────────
  const scheduleRefresh = useCallback((sess: AuthSession) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (!sess.expiresAt || !sess.refreshToken) return
    // Refresh 2 minutes before expiry
    const delay = sess.expiresAt - Date.now() - 2 * 60 * 1000
    if (delay <= 0) return // Already expired or too close
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const result = await authService.refreshMerchantToken(sess.refreshToken)
        if (result.ok) {
          const newSession = buildSession(result.data)
          writeSession(newSession)
          setSessionState(newSession)
          scheduleRefresh(newSession)
        } else {
          // Refresh failed — clear session, user must log in again
          removeSession()
          setSessionState(null)
        }
      } catch {
        // Network error during refresh — keep existing session until it expires
      }
    }, delay)
  }, [])

  useEffect(() => {
    const saved = readSession()
    if (saved) {
      setSessionState(saved)
      scheduleRefresh(saved)
    }
    setIsHydrated(true)
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [scheduleRefresh])

  const setSession = useCallback((newSession: AuthSession) => {
    writeSession(newSession)
    setSessionState(newSession)
    scheduleRefresh(newSession)
  }, [scheduleRefresh])

  const patchStoreId = useCallback((storeId: number) => {
    setSessionState((prev) => {
      if (!prev) return prev
      const updated = { ...prev, storeId }
      writeSession(updated)
      return updated
    })
  }, [])

  const clearSession = useCallback(() => {
    removeSession()
    setSessionState(null)
  }, [])

  // ── 401 interceptor ──────────────────────────────────────────────────────────
  // Only fires when a MERCHANT session is active. This prevents customer-side
  // 401 responses (on /store/* pages) from incorrectly wiping the merchant
  // session and redirecting to the merchant login page.
  // A 403 is intentionally NOT handled — wrong role, not expired token.
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    const unsubscribe = httpClient.addResponseInterceptor((result, config) => {
      const is401 = !result.ok && result.status === 401
      const hasMerchantSession = sessionRef.current !== null
      // Never intercept auth endpoints — a 401 there just means wrong credentials.
      const isAuthCall = config.url.includes('/auth/')
      // Never intercept while on the customer storefront.
      const onStorePage =
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/store/')

      if (is401 && hasMerchantSession && !isAuthCall && !onStorePage) {
        removeSession()
        setSessionState(null)
        router.replace('/login?reason=session_expired')
      }
      return result
    })
    return unsubscribe
  }, [router])

  const getAuthHeader = useCallback((): Record<string, string> => {
    if (!session?.accessToken) return {}
    return { Authorization: `Bearer ${session.accessToken}` }
  }, [session])

  const value: MerchantAuthState = useMemo(
    () => ({
      isHydrated,
      session,
      isAuthenticated: !!session,
      user: (session?.user as AuthUser | null) ?? null,
      role: (session?.user?.role as UserRole) ?? null,
      storeId: session?.storeId ?? null,
      setSession,
      patchStoreId,
      clearSession,
      getAuthHeader,
    }),
    [isHydrated, session, setSession, patchStoreId, clearSession, getAuthHeader]
  )

  return (
    <MerchantAuthCtx.Provider value={value}>
      {children}
    </MerchantAuthCtx.Provider>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a full AuthSession from an AuthResponse (received on login / refresh).
 *
 * TODO(BACKEND-INTEGRATION): After calling this, fetch GET /stores/me and call
 * patchStoreId() with the returned storeId so dashboard pages have the correct ID.
 */
export function buildSession(response: {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    userId: number
    email: string
    fullName: string
    role: string
    createdAt: string
  }
}): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresIn: response.expiresIn,
    expiresAt: Date.now() + response.expiresIn,
    user: {
      userId: response.user.userId,
      email: response.user.email,
      fullName: response.user.fullName,
      role: response.user.role as UserRole,
      isActive: true,
      createdAt: response.user.createdAt,
    },
    storeId: null,
  }
}
