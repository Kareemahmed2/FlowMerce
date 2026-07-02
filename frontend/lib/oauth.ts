/**
 * OAuth2 social login helpers.
 *
 * Flow:
 *  1. User clicks "Log in with Google" → browser navigates to backend redirect endpoint
 *  2. Backend redirects to Google consent, Google redirects back to backend callback
 *  3. Backend exchanges code, issues JWT, and redirects browser to:
 *       /login?accessToken=...&refreshToken=...&expiresIn=...&role=...
 *  4. The /login page detects these params (via handleOAuthCallback) and sets the session
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'

/** Supported OAuth providers. */
export type OAuthProvider = 'google' | 'facebook'

/**
 * Navigate the browser to the backend's OAuth redirect endpoint for the given provider.
 * The backend will 302 to the provider's consent page.
 */
export function redirectToOAuth(provider: OAuthProvider): void {
  window.location.href = `${API_BASE}/auth/social/${provider}/redirect`
}

/**
 * Parsed OAuth callback params returned by the backend after a successful login.
 * The backend redirects to /login?accessToken=...&refreshToken=...&role=...
 */
export interface OAuthCallbackResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  role: string
}

/**
 * Read OAuth callback params from the current URL search params.
 * Returns null if the current page load is not an OAuth callback.
 */
export function parseOAuthCallback(
  searchParams: URLSearchParams
): OAuthCallbackResult | null {
  const accessToken = searchParams.get('accessToken')
  if (!accessToken) return null

  return {
    accessToken,
    refreshToken: searchParams.get('refreshToken') ?? '',
    expiresIn: Number(searchParams.get('expiresIn') ?? 86400000),
    role: searchParams.get('role') ?? 'MERCHANT',
  }
}

/**
 * Build a minimal AuthResponse-compatible shape from OAuth callback params
 * so buildSession() can consume it. We don't have user profile info in the
 * query params, so we fetch it after session is established.
 */
export function oauthParamsToAuthShape(
  params: OAuthCallbackResult,
  user: { userId: number; email: string; fullName: string; role: string; createdAt: string }
) {
  return {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    expiresIn: params.expiresIn,
    user,
  }
}
