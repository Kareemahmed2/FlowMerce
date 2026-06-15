'use client'

/**
 * Customer auth context — JWT-backed, SSR-safe, hydration-safe.
 *
 * Session lifecycle:
 *  - Login  → authService.loginCustomer() → store JWT + profile in localStorage
 *  - Logout → authService.logoutCustomer() → clear localStorage + state
 *  - Mount  → read localStorage → restore session if token not expired
 *  - Refresh → automatic token refresh 60s before expiry (via setInterval)
 *
 * Backward compatibility:
 *  - CustomerProfile type and all context method signatures are UNCHANGED.
 *  - login() still returns Promise<boolean>. signup() still returns Promise<boolean>.
 *  - Existing consumers (login/signup pages, profile page, order hooks) require no changes.
 *
 * New fields added to CustomerAuthState:
 *  - isHydrated: boolean — guards against SSR/hydration flicker
 *  - isLoading: boolean — true during login/signup/logout
 *  - getAuthHeader() — returns { Authorization: 'Bearer ...' } for API calls
 *
 * TODO(BACKEND-INTEGRATION): Token refresh is active. After setting NEXT_PUBLIC_API_URL,
 * all API calls will include the real JWT automatically via getAuthHeader().
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
import { authService } from '@/services/auth.service'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CustomerProfile = {
  id: string          // Stringified userId (e.g. "42") — kept as string for compat
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  avatar: string | null
  createdAt: string
}

type CustomerSession = {
  accessToken: string
  refreshToken: string
  /** Absolute expiry — Date.now() + expiresIn */
  expiresAt: number
  userId: number
}

export type CustomerAuthState = {
  customer: CustomerProfile | null
  isLoggedIn: boolean
  /** True after first localStorage read. Guards SSR/hydration flicker. */
  isHydrated: boolean
  /** True during login / signup / logout network calls. */
  isLoading: boolean
  /** Returns { Authorization: 'Bearer {token}' } or {} if not logged in */
  getAuthHeader: () => Record<string, string>
  login: (email: string, password: string) => Promise<boolean>
  /**
   * Returns `{ ok, activationRequired }`:
   *  - ok = false                      → signup failed (validation, conflict, …)
   *  - ok = true, activationRequired=false → mock mode, auto-logged-in, safe to redirect to storefront
   *  - ok = true, activationRequired=true  → live mode, user must check email + log in manually
   */
  signup: (
    data: Omit<CustomerProfile, 'id' | 'avatar' | 'createdAt'> & { password: string },
    storeSlug?: string
  ) => Promise<{ ok: boolean; activationRequired: boolean }>
  logout: () => void
  updateProfile: (updates: Partial<CustomerProfile>) => void
}

// ── Storage keys ───────────────────────────────────────────────────────────────

const PROFILE_KEY = 'flowmerce_customer'
const SESSION_KEY = 'flowmerce_customer_session'
const REFRESH_BUFFER_MS = 60_000 // refresh 60s before expiry

// ── Storage helpers ────────────────────────────────────────────────────────────

function readProfile(): CustomerProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as CustomerProfile) : null
  } catch { return null }
}

function readSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as CustomerSession
    // Discard expired sessions (with 30s buffer)
    if (Date.now() > s.expiresAt - 30_000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    // SEC-6: tokens are NOT stored in localStorage; httpOnly cookie handles auth.
    // Ensure empty-string tokens so callers don't need null checks.
    return { ...s, accessToken: '', refreshToken: '' }
  } catch { return null }
}

function writeProfile(p: CustomerProfile): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
}

function writeSession(s: CustomerSession): void {
  if (typeof window === 'undefined') return
  // SEC-6: strip the JWT tokens before persisting — httpOnly cookie is the real
  // auth mechanism. Only save non-sensitive metadata (userId, expiresAt).
  const { accessToken: _a, refreshToken: _r, ...meta } = s
  localStorage.setItem(SESSION_KEY, JSON.stringify(meta))
}

function clearStorage(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(SESSION_KEY)
}

function profileFromAuthResponse(
  userId: number,
  email: string,
  fullName: string,
  createdAt: string,
  existing?: CustomerProfile | null
): CustomerProfile {
  const parts = fullName.trim().split(/\s+/)
  return {
    id: String(userId),
    firstName: parts[0] ?? email.split('@')[0],
    lastName: parts.slice(1).join(' '),
    email,
    phone: existing?.phone ?? '',
    address: existing?.address ?? '',
    city: existing?.city ?? '',
    avatar: existing?.avatar ?? null,
    createdAt,
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

const CustomerAuthCtx = createContext<CustomerAuthState | null>(null)

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthCtx)
  if (!ctx) throw new Error('useCustomerAuth must be inside CustomerAuthProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export default function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [session, setSessionState] = useState<CustomerSession | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef<CustomerSession | null>(null)
  sessionRef.current = session

  // ── Hydrate from localStorage ─────────────────────────────────────────────

  useEffect(() => {
    const savedProfile = readProfile()
    const savedSession = readSession()
    if (savedProfile) setCustomer(savedProfile)
    if (savedSession) setSessionState(savedSession)
    setIsHydrated(true)

    // Verify the JWT against /auth/customer/me — if the token is no longer valid
    // (revoked, password changed elsewhere, user deleted), clear the session.
    // Fire-and-forget: failure clears, success refreshes the profile name/phone.
    // SEC-6: token is in httpOnly cookie — send empty auth header, filter reads cookie.
    if (savedSession) {
      authService
        .getCustomerMe({})
        .then((result) => {
          if (!result.ok) {
            // Session is invalid on the server — clear it locally.
            clearStorage()
            setCustomer(null)
            setSessionState(null)
            return
          }
          // Refresh the name on the cached profile from the server.
          if (savedProfile) {
            const refreshed = profileFromAuthResponse(
              result.data.userId,
              result.data.email,
              result.data.fullName,
              result.data.createdAt,
              savedProfile
            )
            writeProfile(refreshed)
            setCustomer(refreshed)
          }
        })
    }
  }, [])

  // ── Schedule token refresh ────────────────────────────────────────────────

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = expiresAt - Date.now() - REFRESH_BUFFER_MS
    if (delay <= 0) return
    refreshTimerRef.current = setTimeout(async () => {
      const currentSession = sessionRef.current
      if (!currentSession) return
      const result = await authService.refreshCustomerToken(currentSession.refreshToken)
      if (result.ok) {
        const newSession: CustomerSession = {
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          expiresAt: Date.now() + result.data.expiresIn,
          userId: result.data.user.userId,
        }
        writeSession(newSession)
        setSessionState(newSession)
        scheduleRefresh(newSession.expiresAt)
      }
    }, delay)
  }, [])

  useEffect(() => {
    if (session) scheduleRefresh(session.expiresAt)
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current) }
  }, [session, scheduleRefresh])

  // ── Auth header ───────────────────────────────────────────────────────────

  const getAuthHeader = useCallback((): Record<string, string> => {
    const s = sessionRef.current
    if (!s || Date.now() > s.expiresAt - 30_000) return {}
    return { Authorization: `Bearer ${s.accessToken}` }
  }, [])

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    const result = await authService.loginCustomer({ email, password })
    setIsLoading(false)
    if (!result.ok) return false

    const { user, accessToken, refreshToken, expiresIn } = result.data
    const profile = profileFromAuthResponse(user.userId, user.email, user.fullName, user.createdAt, readProfile())
    const newSession: CustomerSession = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn,
      userId: user.userId,
    }

    writeProfile(profile)
    writeSession(newSession)
    setCustomer(profile)
    setSessionState(newSession)
    return true
  }, [])

  // ── Signup ─────────────────────────────────────────────────────────────────

  const signup = useCallback(
    async (
      data: Omit<CustomerProfile, 'id' | 'avatar' | 'createdAt'> & { password: string },
      storeSlug?: string
    ): Promise<{ ok: boolean; activationRequired: boolean }> => {
      setIsLoading(true)
      const result = await authService.registerCustomer({
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        password: data.password,
        phone: data.phone,
        storeSlug,   // tells backend to link activation email to /store/{slug}/activate
      })
      setIsLoading(false)
      if (!result.ok) return { ok: false, activationRequired: false }

      // Backend sends a store-branded activation email — caller must show "check your email"
      return { ok: true, activationRequired: true }
    },
    []
  )

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    if (sessionRef.current) {
      // SEC-6: token is '' (httpOnly cookie is the real auth) — backend reads cookie for revocation
      authService.logoutCustomer('')
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    clearStorage()
    setCustomer(null)
    setSessionState(null)
  }, [])

  // ── Update profile ─────────────────────────────────────────────────────────

  const updateProfile = useCallback((updates: Partial<CustomerProfile>) => {
    setCustomer((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      writeProfile(updated)
      return updated
    })
  }, [])

  // ── Context value ──────────────────────────────────────────────────────────

  const value: CustomerAuthState = useMemo(
    () => ({
      customer,
      isLoggedIn: !!customer && !!session,
      isHydrated,
      isLoading,
      getAuthHeader,
      login,
      signup,
      logout,
      updateProfile,
    }),
    [customer, session, isHydrated, isLoading, getAuthHeader, login, signup, logout, updateProfile]
  )

  return <CustomerAuthCtx.Provider value={value}>{children}</CustomerAuthCtx.Provider>
}
