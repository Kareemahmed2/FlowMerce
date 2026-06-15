/**
 * Auth types — shaped to match backend DTOs exactly.
 * Keep in sync with the Spring Boot UserManagement module.
 *
 * TODO(BACKEND-INTEGRATION): Validate every field against the actual JSON response
 * body once the backend is reachable. Use the Postman collection as the source of
 * truth for field names and casing.
 */

// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MERCHANT' | 'BUYER' | 'GUEST'

// ─── Core user ────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: number
  email: string
  fullName: string
  phone?: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

// ─── Session (what we store in localStorage) ──────────────────────────────────

export interface AuthSession {
  accessToken: string
  refreshToken: string
  /** milliseconds until expiry, as returned by backend */
  expiresIn: number
  /** absolute expiry timestamp (Date.now() + expiresIn), computed on login */
  expiresAt: number
  user: AuthUser
  /** populated from GET /stores/me after login */
  storeId: number | null
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

/** POST /auth/merchant/register */
export interface MerchantRegisterRequest {
  fullName: string
  email: string
  password: string
  phone?: string
  businessName?: string
}

/** POST /auth/customer/register */
export interface CustomerRegisterRequest {
  fullName: string
  email: string
  password: string
  phone?: string
  /** Store slug — when provided, the activation email links to /store/{slug}/activate */
  storeSlug?: string
}

/** POST /auth/merchant/login | POST /auth/customer/login */
export interface LoginRequest {
  email: string
  password: string
}

/** POST /auth/merchant/refresh | POST /auth/customer/refresh */
export interface RefreshTokenRequest {
  refreshToken: string
}

/** POST /auth/merchant/forgot-password | POST /auth/customer/forgot-password */
export interface ForgotPasswordRequest {
  email: string
}

/** POST /auth/merchant/reset-password | POST /auth/customer/reset-password */
export interface ResetPasswordRequest {
  token: string
  newPassword: string
  confirmNewPassword: string
}

/** PUT /users/me/change-password */
export interface ChangePasswordRequest {
  /** INT-7: backend ChangePasswordRequest field is `currentPassword`. */
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

/** PUT /users/me */
export interface UpdateProfileRequest {
  fullName: string
  phone?: string
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

/**
 * Returned by POST /auth/merchant/login, POST /auth/customer/login,
 * POST /auth/merchant/refresh, POST /auth/customer/refresh.
 * TODO(BACKEND-INTEGRATION): Confirm `expiresIn` unit is milliseconds (backend
 * property: jwt.expiration-ms=86400000).
 */
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  /** Duration in milliseconds — matches backend jwt.expiration-ms */
  expiresIn: number
  user: {
    userId: number
    email: string
    fullName: string
    /** Backend returns role as uppercase string — matches UserRole union */
    role: UserRole
    createdAt: string
  }
}

/** Returned by GET /auth/merchant/me | GET /auth/customer/me */
export interface UserResponse {
  userId: number
  email: string
  fullName: string
  phone?: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

// ─── Backend error shape ──────────────────────────────────────────────────────

export interface ApiErrorResponse {
  status: number
  error: string
  message: string
  code: string
  path: string
  fieldErrors?: Record<string, string>
}

// ─── Context shape ────────────────────────────────────────────────────────────

export interface MerchantAuthState {
  /**
   * True once the provider has attempted to read from localStorage.
   * Guards are not safe to evaluate until this is true — prevents redirect loops
   * and hydration flicker on the first render.
   */
  isHydrated: boolean
  session: AuthSession | null
  isAuthenticated: boolean
  user: AuthUser | null
  role: UserRole | null
  storeId: number | null
  setSession: (session: AuthSession) => void
  patchStoreId: (storeId: number) => void
  clearSession: () => void
  getAuthHeader: () => Record<string, string>
}
