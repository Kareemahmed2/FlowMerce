'use client'

/**
 * Customer email activation page (store-branded).
 * URL: /store/[slug]/activate?token=<token>
 *
 * On success: 5-second countdown then redirects to /store/[slug]/login
 *
 * TODO(BACKEND-INTEGRATION): Replace service call with real httpClient:
 *   GET /auth/customer/activate?token=
 * TODO(BACKEND-INTEGRATION): The backend activation email should link to:
 *   /store/{slug}/activate?token={token}
 *   The slug must be embedded in the email by the backend at registration time.
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { textOnBg } from '@/components/store/store-types'
import { authService } from '@/services/auth.service'

type ActivationState = 'loading' | 'success' | 'error' | 'no-token'

const REDIRECT_SECONDS = 5

// useSearchParams() requires a Suspense boundary for the build's static
// prerender pass — the actual content is in CustomerActivatePageContent below.
export default function CustomerActivatePage() {
  return (
    <Suspense fallback={null}>
      <CustomerActivatePageContent />
    </Suspense>
  )
}

function CustomerActivatePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const store = useStore()

  const token = searchParams.get('token') ?? ''
  const base = useStoreBase()
  const accent = store.colors.accent

  const [state, setState] = useState<ActivationState>(token ? 'loading' : 'no-token')
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)
  const [isRetrying, setIsRetrying] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Activation call ──────────────────────────────────────────────────────
  const runActivation = async () => {
    if (!token) return
    setState('loading')
    const result = await authService.activateCustomer(token)
    if (result.ok) {
      setMessage(result.data.message)
      setState('success')
    } else {
      const isTimeout = result.status === 408
      setMessage(
        isTimeout
          ? 'The server took too long to respond. Please try again.'
          : result.error
      )
      setState('error')
    }
    setIsRetrying(false)
  }

  useEffect(() => {
    runActivation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Countdown on success ─────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'success') return

    countdownRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(countdownRef.current!)
          router.push(`${base}/login`)
          return 0
        }
        return n - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <div
      style={{
        background: store.colors.background,
        color: store.colors.text,
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Store branding */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {store.logoPreview ? (
            <img
              src={store.logoPreview}
              alt={store.brandName}
              style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', margin: '0 auto 12px' }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: 48, height: 48, borderRadius: 10, background: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', fontSize: 20, fontWeight: 700, color: textOnBg(accent),
              }}
            >
              {store.brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{store.brandName}</p>
        </div>

        {/* Card */}
        <div
          style={{
            background: store.colors.card, borderRadius: 16, padding: 32,
            border: '1px solid #00000008', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {/* ── Loading ── */}
          {state === 'loading' && (
            <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
              <Loader2 size={44} aria-hidden="true" style={{ color: accent, animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 14, color: '#888', textAlign: 'center' }}>
                Verifying your account… this may take up to 30 seconds.
              </p>
            </div>
          )}

          {/* ── Success ── */}
          {state === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
              <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={28} color="#16a34a" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, textAlign: 'center' }}>Account Verified!</h2>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
              <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                Redirecting in <strong style={{ color: '#555' }}>{countdown}</strong>s…
              </p>
              <Link
                href={`${base}/login`}
                style={{ display: 'block', width: '100%', padding: '13px 0', background: accent, color: textOnBg(accent), borderRadius: 10, textAlign: 'center', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
              >
                Sign In Now
              </Link>
            </div>
          )}

          {/* ── Error ── */}
          {state === 'error' && (
            <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
              <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={28} color="#dc2626" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, textAlign: 'center' }}>Verification Failed</h2>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => { setIsRetrying(true); runActivation() }}
                  disabled={isRetrying}
                  style={{
                    display: 'block', width: '100%', padding: '13px 0',
                    background: isRetrying ? '#999' : accent,
                    color: textOnBg(isRetrying ? '#999' : accent),
                    border: 'none', borderRadius: 10, textAlign: 'center',
                    fontWeight: 600, fontSize: 14, cursor: isRetrying ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isRetrying ? 'Retrying…' : 'Try Again'}
                </button>
                <Link href={`${base}/login`} style={{ display: 'block', padding: '12px 0', border: '1px solid #e5e7eb', borderRadius: 10, textAlign: 'center', fontWeight: 500, fontSize: 14, color: '#555', textDecoration: 'none' }}>
                  Back to Sign In
                </Link>
                <Link href={`${base}/signup`} style={{ display: 'block', padding: '10px 0', textAlign: 'center', fontSize: 13, color: '#aaa', textDecoration: 'none' }}>
                  Create a New Account
                </Link>
              </div>
            </div>
          )}

          {/* ── No token ── */}
          {state === 'no-token' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
              <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={28} color={accent} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, textAlign: 'center' }}>Check Your Email</h2>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.6 }}>
                We sent an activation link to your email. Click it to verify your account and start shopping.
              </p>
              <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                Didn&apos;t receive it?{' '}
                <Link href={`${base}/signup`} style={{ color: accent, fontWeight: 600, textDecoration: 'none' }}>
                  Try signing up again
                </Link>
                .
              </p>
              <Link href={`${base}/login`} style={{ display: 'block', width: '100%', marginTop: 8, padding: '12px 0', border: '1px solid #e5e7eb', borderRadius: 10, textAlign: 'center', fontWeight: 500, fontSize: 14, color: '#555', textDecoration: 'none' }}>
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
