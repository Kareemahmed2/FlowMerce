'use client'

import React from "react"
import { Suspense, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Loader2 } from 'lucide-react'
import { useMerchantAuth, buildSession } from '@/store/auth-store'
import { storeService } from '@/services/store.service'
import { authService } from '@/services/auth.service'
import { redirectToOAuth, parseOAuthCallback } from '@/lib/oauth'
import type { OAuthProvider } from '@/lib/oauth'
import type { AuthResponse } from '@/types/auth.types'
import { useEffect } from 'react'


// useSearchParams() requires a Suspense boundary for the build's static
// prerender pass — the actual content is in LoginPageContent below.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useMerchantAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(
    searchParams.get('reason') === 'session_expired'
      ? 'Your session expired. Please log in again.'
      : ''
  )
  const [rememberMe, setRememberMe] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })

  // ── MFA step (shown instead of the login form when the account has
  // "Enable 2FA" turned on in Settings — see SettingsPage.tsx SecuritySection) ──
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)

  // ── OAuth2 callback handler ────────────────────────────────────────────────
  // After Google/Facebook redirects back, the backend appends
  //   ?accessToken=...&refreshToken=...&role=...
  // to this page's URL. We detect that and establish the session.
  useEffect(() => {
    const params = parseOAuthCallback(new URLSearchParams(window.location.search))
    if (!params) return

    setLoading(true)
    // Fetch the user's full profile with the new token, then build a proper session.
    authService.getMerchantMe({ Authorization: `Bearer ${params.accessToken}` })
      .then(async (result) => {
        if (!result.ok) {
          setError('Social login succeeded but could not fetch profile. Please try again.')
          setLoading(false)
          return
        }
        const u = result.data
        const session = buildSession({
          accessToken: params.accessToken,
          refreshToken: params.refreshToken,
          expiresIn: params.expiresIn,
          user: {
            userId: u.userId,
            email: u.email,
            fullName: u.fullName ?? '',
            role: params.role,
            createdAt: u.createdAt ?? new Date().toISOString(),
          },
        })
        auth.setSession(session)

        // Fetch storeId
        const storesR = await storeService.getMyStores({ Authorization: `Bearer ${params.accessToken}` })
        if (storesR.ok && storesR.data.length > 0) {
          auth.patchStoreId(storesR.data[0].storeId)
        }

        // Clean the token params from the URL then navigate
        window.history.replaceState({}, '', '/login')
        if (params.role === 'ADMIN') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      })
      .catch(() => {
        setError('Social login failed. Please try again.')
        setLoading(false)
      })
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  // Shared by both the direct-login success path and the post-MFA-verify
  // success path — establishes the session and routes to the right place.
  const completeLogin = async (data: AuthResponse) => {
    const session = buildSession(data)
    auth.setSession(session)

    if (rememberMe) localStorage.setItem('rememberMe', 'true')

    const role = data.user.role
    const explicitRedirect = searchParams.get('redirect')

    // Admins have no store — route straight to the admin panel.
    if (role === 'ADMIN') {
      router.push(explicitRedirect || '/admin')
      return
    }

    // Merchant: fetch storeId so the dashboard doesn't start with storeId=null
    const tempHeaders = { Authorization: `Bearer ${data.accessToken}` }
    const storesR = await storeService.getMyStores(tempHeaders)
    if (storesR.ok && storesR.data.length > 0) {
      auth.patchStoreId(storesR.data[0].storeId)
      if (typeof window !== 'undefined') {
        localStorage.setItem('flowmerce_active_store_id', String(storesR.data[0].storeId))
      }
    }

    // Redirect: back to the page that sent us here, or dashboard
    router.push(explicitRedirect || '/dashboard')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // INT-26: use authService (http-client) instead of raw fetch so all
      // request/response interceptors (retry, offline-queue, error normalisation) apply.
      const result = await authService.loginMerchant({
        email: formData.email,
        password: formData.password,
      })

      if (!result.ok) {
        throw new Error(result.error || 'Login failed')
      }

      if (result.data?.mfaRequired) {
        setMfaToken(result.data.mfaToken || '')
        setLoading(false)
        return
      }

      if (!result.data?.accessToken) {
        throw new Error('No access token received from server')
      }

      await completeLogin(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mfaCode.length !== 6) {
      setError('Enter the 6-digit code from your email')
      return
    }
    setMfaVerifying(true)
    try {
      const result = await authService.verifyMfaMerchant({ mfaToken, code: mfaCode })
      if (!result.ok) {
        throw new Error(result.error || 'Invalid verification code')
      }
      if (!result.data?.accessToken) {
        throw new Error('No access token received from server')
      }
      await completeLogin(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setMfaVerifying(false)
    }
  }

  const handleSocialLogin = (provider: OAuthProvider) => {
    redirectToOAuth(provider)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0f172a', position: 'relative', overflow: 'hidden', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
      {/* Background image — full opacity, dimmed by overlay */}
      <Image src="/bg-login.png" alt="FlowMerce Background" fill className="object-cover opacity-40" />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.75) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: '100%' }}>
        {/* ── Left hero panel ───────────────────────────────────────── */}
        <div className="hidden lg:flex" style={{ width: '50%', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <Image src="/logo.png" alt="FlowMerce Logo" width={48} height={48} className="w-12 h-12" />
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>FlowMerce</span>
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 20px', maxWidth: 480 }}>
            Your all-in-one commerce platform.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 400, margin: '0 0 36px' }}>
            Build, launch, and scale your online store with FlowMerce — trusted by thousands of merchants.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 40, height: 3, borderRadius: 2, background: '#4f46e5' }} />
            <div style={{ width: 24, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: 16, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>

        {/* ── Right form panel ──────────────────────────────────────── */}
        <div style={{ width: '100%', maxWidth: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }} className="auth-form-side">
          <div className="auth-card" style={{
            width: '100%', maxWidth: 440,
            background: '#fff', borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {mfaToken ? (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                  VERIFICATION REQUIRED
                </p>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '0 0 12px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Enter your code
                </h1>
                <p style={{ fontSize: 13, color: '#75777d', margin: '0 0 24px' }}>
                  We sent a 6-digit code to {formData.email}. It expires in 5 minutes.
                </p>

                {error && (
                  <div style={{ marginBottom: 20, padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                    <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyMfa} style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                  <InputOTP maxLength={6} value={mfaCode} onChange={setMfaCode}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>

                  <Button type="submit" disabled={mfaVerifying || mfaCode.length !== 6}
                    className="w-full py-3 text-white font-bold rounded-lg transition-opacity"
                    style={{ backgroundColor: '#4f46e5', fontSize: 14, letterSpacing: '-0.01em' }}
                  >
                    {mfaVerifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : 'Verify →'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setMfaToken(''); setMfaCode(''); setError('') }}
                    style={{ background: 'none', border: 'none', color: '#75777d', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ← Back to login
                  </button>
                </form>
              </>
            ) : (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                  WELCOME BACK
                </p>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '0 0 28px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Log in to your account
                </h1>

                {error && (
                  <div style={{ marginBottom: 20, padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                    <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#45474c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
                    <Input
                      type="email" name="email" value={formData.email} onChange={handleInputChange}
                      placeholder="you@example.com" required
                      className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                      style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#45474c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</label>
                    <Input
                      type="password" name="password" value={formData.password} onChange={handleInputChange}
                      placeholder="••••••••••••" required
                      className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                      style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#1e293b' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked: boolean) => setRememberMe(checked as boolean)} />
                      <label htmlFor="remember" style={{ fontSize: 13, color: '#45474c', cursor: 'pointer', fontWeight: 500 }}>Remember me</label>
                    </div>
                    <Link href="/forgot-password" style={{ fontSize: 13, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }} className="auth-link">
                      Forgot Password?
                    </Link>
                  </div>

                  <Button type="submit" disabled={loading}
                    className="w-full py-3 text-white font-bold rounded-lg transition-opacity"
                    style={{ backgroundColor: '#4f46e5', marginTop: 4, fontSize: 14, letterSpacing: '-0.01em' }}
                  >
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in…</> : 'Continue →'}
                  </Button>
                </form>

                <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <span style={{ fontSize: 12, color: '#75777d', fontWeight: 500 }}>Or continue with</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { provider: 'google' as OAuthProvider, label: 'Log in with Google', icon: <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
                    { provider: 'facebook' as OAuthProvider, label: 'Log in with Facebook', icon: <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
                  ].map(({ provider, label, icon }) => (
                    <button key={provider} type="button" onClick={() => handleSocialLogin(provider)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#1e293b', transition: 'background 0.15s', fontFamily: 'inherit' }}
                      className="auth-social-btn"
                    >
                      {icon}{label}
                    </button>
                  ))}
                  <button type="button" disabled style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 0', borderRadius: 10, border: '1.5px solid #f2f4f6', background: '#f7f9fb', cursor: 'not-allowed', fontSize: 13, color: '#c5c6cd', fontFamily: 'inherit' }}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.29.89 3.08.89.79 0 2.38-1.1 4.02-.92 1.26.07 2.91.78 3.8 2.38-3.69 2.23-2.86 6.92.5 7.98-.47 1.5-1.3 2.7-2.4 3.64zm-9.1-14.85c-.11-1.88 1.39-3.54 3.2-3.72.23 1.85-1.57 3.42-3.2 3.72z"/></svg>
                    Log In with Apple (coming soon)
                  </button>
                </div>

                <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#75777d' }}>
                  New here?{' '}
                  <Link href="/signup" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }} className="auth-link">
                    Create an account →
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .auth-form-side { max-width: 100% !important; }
        @media (min-width: 1024px) { .auth-form-side { max-width: 50% !important; } }
        .auth-card { padding: 40px; }
        @media (max-width: 480px) {
          .auth-card { padding: 24px 20px; }
          .auth-card h1 { font-size: 22px !important; }
        }
        .auth-social-btn:hover { background: #f7f9fb !important; }
        .auth-link:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  )
}
