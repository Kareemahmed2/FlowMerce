'use client'

/**
 * Customer forgot-password page (store-branded).
 * URL: /store/[slug]/forgot-password
 *
 * TODO(BACKEND-INTEGRATION): Replace service call with real httpClient:
 *   POST /auth/customer/forgot-password  { email }
 * TODO(BACKEND-INTEGRATION): Add a link from the store login page:
 *   /store/[slug]/login → forgot password link → /store/[slug]/forgot-password
 */

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import { useStore } from '@/components/store/StoreProvider'
import { textOnBg } from '@/components/store/store-types'
import { authService } from '@/services/auth.service'

const schema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})
type FormValues = z.infer<typeof schema>

const baseInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function CustomerForgotPasswordPage() {
  const { slug } = useParams<{ slug: string }>()
  const store = useStore()
  const base = `/store/${slug}`
  const accent = store.colors.accent

  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [apiError, setApiError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormValues) => {
    setApiError('')
    const result = await authService.forgotPasswordCustomer({ email: data.email })
    if (result.ok) {
      setSubmittedEmail(data.email)
      setSubmitted(true)
    } else {
      setApiError(result.error)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = accent
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#e5e7eb'
  }

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
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Store brand header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {store.logoPreview ? (
            <img src={store.logoPreview} alt={store.brandName} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', margin: '0 auto 12px' }} />
          ) : (
            <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, fontWeight: 700, color: textOnBg(accent) }}>
              {store.brandName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ background: store.colors.card, borderRadius: 16, padding: 28, border: '1px solid #00000008' }}>
          {!submitted ? (
            <>
              <Link
                href={`${base}/login`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#888', textDecoration: 'none', marginBottom: 20 }}
              >
                <ArrowLeft size={13} aria-hidden="true" /> Back to Sign In
              </Link>

              <h1 id="fp-heading" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
                Forgot Password?
              </h1>
              <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px', lineHeight: 1.6 }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>

              {/* Error region */}
              {apiError && (
                <div
                  role="alert"
                  style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16 }}
                >
                  {apiError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} aria-labelledby="fp-heading" noValidate>
                <div style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="fp-email"
                    style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}
                  >
                    Email Address
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    {...register('email')}
                    style={baseInputStyle}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'fp-email-error' : undefined}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  {errors.email && (
                    <p id="fp-email-error" role="alert" style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                      {errors.email.message}
                    </p>
                  )}
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Sending…</span>
                    </>
                  ) : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            /* ── Success ── */
            <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
              <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={26} color="#16a34a" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, textAlign: 'center' }}>Check your inbox!</h2>
              <p style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.6 }}>
                If <strong>{submittedEmail}</strong> is registered, a reset link is on its way.
              </p>
              <button
                type="button"
                onClick={() => { setSubmitted(false); setApiError('') }}
                style={{ fontSize: 13, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}
              >
                Try a different email
              </button>
              <Link
                href={`${base}/login`}
                style={{ display: 'block', width: '100%', padding: '12px 0', border: '1px solid #e5e7eb', borderRadius: 10, textAlign: 'center', fontWeight: 500, fontSize: 14, color: '#555', textDecoration: 'none' }}
              >
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
