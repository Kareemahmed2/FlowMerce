'use client'

/**
 * Account activation page — merchant (and customer via ?type=customer).
 *
 * URL patterns:
 *   /activate?token=<token>                → merchant activation
 *   /activate?token=<token>&type=customer  → customer activation (no store slug known here)
 *
 * On success:
 *   Merchant  → auto-redirects to /login after a 5-second countdown
 *   Customer  → auto-redirects to /login (generic, no slug available at this route)
 *               TODO(BACKEND-INTEGRATION): The backend email should embed the store
 *               slug so the customer can be sent to /store/[slug]/activate instead.
 *
 * TODO(BACKEND-INTEGRATION): Replace service calls with real httpClient calls:
 *   GET /auth/merchant/activate?token=  (merchant)
 *   GET /auth/customer/activate?token=  (customer)
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import AuthPageLayout from '@/components/auth/AuthPageLayout'
import { authService } from '@/services/auth.service'

type ActivationState = 'loading' | 'success' | 'error' | 'no-token'

const REDIRECT_SECONDS = 5

// useSearchParams() requires a Suspense boundary for the build's static
// prerender pass — the actual content is in ActivatePageContent below.
export default function ActivatePage() {
  return (
    <Suspense fallback={<ActivateFallback />}>
      <ActivatePageContent />
    </Suspense>
  )
}

function ActivateFallback() {
  return (
    <AuthPageLayout
      heroHeading="Almost there..."
      heroSubtext="Activate your account to start building your store with FlowMerce."
      bgImage="/bg-login.png"
    >
      <div className="flex flex-col items-center py-10 gap-4" role="status">
        <Loader2
          className="w-12 h-12 animate-spin"
          style={{ color: '#49342F' }}
          aria-hidden="true"
        />
        <p className="text-gray-500 text-sm text-center">
          Verifying your activation link…
        </p>
      </div>
    </AuthPageLayout>
  )
}

function ActivatePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const token = searchParams.get('token') ?? ''
  const type = searchParams.get('type') ?? 'merchant'
  const slug = searchParams.get('slug') ?? ''
  const isCustomer = type === 'customer'

  const loginHref = isCustomer && slug ? `/store/${slug}/login` : '/login'

  const [state, setState] = useState<ActivationState>(token ? 'loading' : 'no-token')
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Activation call ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return

    const activate = async () => {
      const result = isCustomer
        ? await authService.activateCustomer(token)
        : await authService.activateMerchant(token)
      if (result.ok) {
        setMessage(result.data.message)
        setState('success')
      } else {
        setMessage(result.error)
        setState('error')
      }
    }

    activate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Countdown on success ─────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'success') return

    countdownRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(countdownRef.current!)
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

  useEffect(() => {
    if (countdown === 0 && state === 'success') {
      router.push(loginHref)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  return (
    <AuthPageLayout
      heroHeading="Almost there..."
      heroSubtext="Activate your account to start building your store with FlowMerce."
      bgImage="/bg-login.png"
    >
      <div className="text-sm font-semibold text-gray-600 mb-4 tracking-widest">
        EMAIL VERIFICATION
      </div>

      <h2
        className="text-gray-900 mb-6"
        style={{
          fontFamily: 'MediumZen Old Mincho, serif',
          fontSize: '25px',
          lineHeight: '44px',
          fontWeight: 500,
        }}
      >
        Activating your account
      </h2>

      {/* aria-live region — screen readers announce state changes */}
      <div aria-live="polite" aria-atomic="true">

        {/* ── Loading ── */}
        {state === 'loading' && (
          <div className="flex flex-col items-center py-10 gap-4" role="status">
            <Loader2
              className="w-12 h-12 animate-spin"
              style={{ color: '#49342F' }}
              aria-hidden="true"
            />
            <p className="text-gray-500 text-sm text-center">
              Verifying your activation link…
            </p>
          </div>
        )}

        {/* ── Success ── */}
        {state === 'success' && (
          <div className="flex flex-col items-center py-6 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#f0fdf4' }}
              aria-hidden="true"
            >
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center">
              Account Activated!
            </h3>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              {message}
            </p>
            <p className="text-xs text-gray-400 text-center">
              Redirecting to login in{' '}
              <span className="font-semibold text-gray-600">{countdown}</span>s…
            </p>
            <Link
              href={loginHref}
              className="mt-2 w-full py-3 text-white font-semibold rounded-lg text-center text-sm transition-colors block"
              style={{ backgroundColor: '#49342F' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a4038')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#49342F')}
            >
              CONTINUE TO LOGIN
            </Link>
          </div>
        )}

        {/* ── Error ── */}
        {state === 'error' && (
          <div className="flex flex-col items-center py-6 gap-4" role="alert">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#fef2f2' }}
              aria-hidden="true"
            >
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center">
              Activation Failed
            </h3>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              {message}
            </p>
            <div className="w-full space-y-3 mt-2">
              <Link
                href="/"
                className="w-full py-3 text-white font-semibold rounded-lg text-center text-sm transition-colors block"
                style={{ backgroundColor: '#49342F' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a4038')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#49342F')}
              >
                CREATE A NEW ACCOUNT
              </Link>
              <Link
                href={loginHref}
                className="w-full py-3 border border-gray-300 rounded-lg text-center text-sm text-gray-700 hover:bg-gray-50 transition-colors block font-medium"
              >
                Back to Login
              </Link>
            </div>
          </div>
        )}

        {/* ── No token ── */}
        {state === 'no-token' && (
          <div className="flex flex-col items-center py-6 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#fef9f0' }}
              aria-hidden="true"
            >
              <Mail className="w-8 h-8" style={{ color: '#49342F' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center">
              Check Your Inbox
            </h3>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              We sent an activation link to your email address. Click the link in
              the email to activate your account.
            </p>
            <p className="text-xs text-gray-400 text-center">
              Didn&apos;t receive it? Check your spam folder or{' '}
              <Link
                href="/"
                className="font-medium underline"
                style={{ color: '#49342F' }}
              >
                sign up again
              </Link>
              .
            </p>
            <Link
              href={loginHref}
              className="mt-2 w-full py-3 border border-gray-300 rounded-lg text-center text-sm text-gray-700 hover:bg-gray-50 transition-colors block font-medium"
            >
              Back to Login
            </Link>
          </div>
        )}

      </div>
    </AuthPageLayout>
  )
}
