'use client'

/**
 * Merchant forgot-password page.
 * URL: /forgot-password
 */

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import AuthPageLayout from '@/components/auth/AuthPageLayout'
import { authService } from '@/services/auth.service'

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})
type FormValues = z.infer<typeof schema>

// ─── Shared input focus style (matches login/signup pages) ────────────────────

const focusStyle = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '0 0 0 2px #49342F'
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = ''
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
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
    const result = await authService.forgotPasswordMerchant({ email: data.email })
    if (result.ok) {
      setSubmittedEmail(data.email)
      setSubmitted(true)
    } else {
      setApiError(result.error)
    }
  }

  return (
    <AuthPageLayout
      heroHeading="Forgot your password?"
      heroSubtext="No worries — we'll send you a link to reset it. Just enter your registered email address."
      bgImage="/bg-login.png"
    >
      {/* ── Back link ── */}
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to Login
      </Link>

      {!submitted ? (
        <>
          <div className="text-sm font-semibold text-gray-600 mb-4 tracking-widest">
            PASSWORD RESET
          </div>
          <h2
            id="page-heading"
            className="text-gray-900 mb-2"
            style={{
              fontFamily: 'MediumZen Old Mincho, serif',
              fontSize: '25px',
              lineHeight: '44px',
              fontWeight: 500,
            }}
          >
            Reset Password
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Enter the email address associated with your account and we&apos;ll
            send you a reset link.
          </p>

          {/* ── API error — announced by screen readers ── */}
          {apiError && (
            <div
              id="form-error"
              role="alert"
              aria-live="assertive"
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            aria-labelledby="page-heading"
            noValidate
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register('email')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none"
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? 'email-error' : apiError ? 'form-error' : undefined
                }
                {...focusStyle}
              />
              {errors.email && (
                <p
                  id="email-error"
                  role="alert"
                  className="mt-1.5 text-xs text-red-600"
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-3 text-white font-semibold rounded-lg transition-colors"
              style={{ backgroundColor: '#49342F' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a4038')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#49342F')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  <span>Sending link…</span>
                </>
              ) : (
                'SEND RESET LINK'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Remembered it?{' '}
            <Link
              href="/login"
              className="font-semibold transition-colors"
              style={{ color: '#49342F' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#5a4038')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#49342F')}
            >
              LOG IN
            </Link>
          </p>
        </>
      ) : (
        /* ── Success state — aria-live announces this transition ── */
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center py-6 gap-4"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#f0fdf4' }}
            aria-hidden="true"
          >
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center">
            Check your inbox
          </h3>
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            If an account exists for{' '}
            <span className="font-medium text-gray-900">{submittedEmail}</span>,
            you will receive a password reset link shortly.
          </p>
          <p className="text-xs text-gray-400 text-center">
            Check your spam folder if you don&apos;t see it within a few minutes.
          </p>
          <div className="w-full space-y-3 mt-4">
            <button
              type="button"
              onClick={() => { setSubmitted(false); setApiError('') }}
              className="w-full py-3 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Try a different email
            </button>
            <Link
              href="/login"
              className="w-full py-3 text-white font-semibold rounded-lg text-center text-sm transition-colors block"
              style={{ backgroundColor: '#49342F' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a4038')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#49342F')}
            >
              BACK TO LOGIN
            </Link>
          </div>
        </div>
      )}
    </AuthPageLayout>
  )
}
