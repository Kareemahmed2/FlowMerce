'use client'

/**
 * Customer reset-password page (store-branded).
 * URL: /store/[slug]/reset-password?token=<token>
 *
 * On success: 5-second countdown then redirects to /store/[slug]/login
 *
 * TODO(BACKEND-INTEGRATION): Replace service call with real httpClient:
 *   POST /auth/customer/reset-password  { token, newPassword, confirmNewPassword }
 * TODO(BACKEND-INTEGRATION): The backend reset email should link to:
 *   /store/{slug}/reset-password?token={token}
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '@/components/store/StoreProvider'
import { textOnBg } from '@/components/store/store-types'
import { authService } from '@/services/auth.service'

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include at least one uppercase letter')
      .regex(/[0-9]/, 'Must include at least one number'),
    confirmNewPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })

type FormValues = z.infer<typeof schema>

const REDIRECT_SECONDS = 5

const baseInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  paddingRight: 44,
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

// useSearchParams() requires a Suspense boundary for the build's static
// prerender pass — the actual content is in CustomerResetPasswordPageContent below.
export default function CustomerResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <CustomerResetPasswordPageContent />
    </Suspense>
  )
}

function CustomerResetPasswordPageContent() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const store = useStore()

  const token = searchParams.get('token') ?? ''
  const base = `/store/${slug}`
  const accent = store.colors.accent

  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [apiError, setApiError] = useState('')
  const [showNewLink, setShowNewLink] = useState(false)
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    setApiError('')
    setShowNewLink(false)
    const result = await authService.resetPasswordCustomer({
      token,
      newPassword: data.newPassword,
      confirmNewPassword: data.confirmNewPassword,
    })
    if (result.ok) {
      setSuccess(true)
    } else {
      setApiError(result.error)
      setShowNewLink(result.status === 400 || result.status === 410)
    }
  }

  // ── Countdown on success ─────────────────────────────────────────────────
  useEffect(() => {
    if (!success) return

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
  }, [success])

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = accent
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#e5e7eb'
  }

  const cardStyle: React.CSSProperties = {
    background: store.colors.card,
    borderRadius: 16,
    padding: 28,
    border: '1px solid #00000008',
  }

  // ── No token guard ───────────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{ background: store.colors.background, minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={cardStyle}>
            <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
              <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={26} color="#dc2626" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, textAlign: 'center', color: store.colors.text }}>
                Invalid Link
              </h2>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.6 }}>
                This reset link is missing a token. Please request a new one.
              </p>
              <Link href={`${base}/forgot-password`} style={{ display: 'block', width: '100%', padding: '13px 0', background: accent, color: textOnBg(accent), borderRadius: 10, textAlign: 'center', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                Request New Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ background: store.colors.background, minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={cardStyle}>
            <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
              <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={26} color="#16a34a" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, textAlign: 'center', color: store.colors.text }}>
                Password Updated!
              </h2>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.6 }}>
                Your password has been reset.
              </p>
              <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                Redirecting in <strong style={{ color: '#555' }}>{countdown}</strong>s…
              </p>
              <Link href={`${base}/login`} style={{ display: 'block', width: '100%', padding: '13px 0', background: accent, color: textOnBg(accent), borderRadius: 10, textAlign: 'center', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                Sign In Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: store.colors.background, color: store.colors.text,
        minHeight: '70vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '40px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={cardStyle}>
          <Link href={`${base}/login`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#888', textDecoration: 'none', marginBottom: 20 }}>
            <ArrowLeft size={13} aria-hidden="true" /> Back to Sign In
          </Link>

          <h1 id="rp-heading" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
            Set New Password
          </h1>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px', lineHeight: 1.6 }}>
            Must be at least 8 characters with an uppercase letter and a number.
          </p>

          {/* ── Error ── */}
          {apiError && (
            <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
              {apiError}
              {showNewLink && (
                <>
                  {' — '}
                  <Link href={`${base}/forgot-password`} style={{ color: '#dc2626', fontWeight: 700 }}>
                    Request new link
                  </Link>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} aria-labelledby="rp-heading" noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* New password */}
            <div>
              <label htmlFor="rp-new-password" style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="rp-new-password"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••••••••"
                  {...register('newPassword')}
                  style={baseInputStyle}
                  aria-invalid={!!errors.newPassword}
                  aria-describedby={errors.newPassword ? 'rp-new-error' : undefined}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                  {showNew ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {errors.newPassword && <p id="rp-new-error" role="alert" style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.newPassword.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="rp-confirm-password" style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="rp-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••••••••"
                  {...register('confirmNewPassword')}
                  style={baseInputStyle}
                  aria-invalid={!!errors.confirmNewPassword}
                  aria-describedby={errors.confirmNewPassword ? 'rp-confirm-error' : undefined}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                  {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {errors.confirmNewPassword && <p id="rp-confirm-error" role="alert" style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.confirmNewPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              style={{
                width: '100%', height: 48,
                background: isSubmitting ? '#999' : accent,
                color: isSubmitting ? '#fff' : textOnBg(accent),
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Updating…</span>
                </>
              ) : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
