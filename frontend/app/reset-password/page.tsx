'use client'

/**
 * Merchant reset-password page.
 * URL: /reset-password?token=<token>
 *
 * Flow:
 *   1. No token in URL → show "invalid link" state immediately
 *   2. User enters + confirms new password
 *   3. POST /auth/merchant/reset-password { token, newPassword, confirmNewPassword }
 *   4. On success → 5-second countdown then redirect to /login
 *   5. On failure (invalid/expired token) → show error with "get new link" prompt
 *
 * TODO(BACKEND-INTEGRATION): Replace service call with real httpClient:
 *   POST /auth/merchant/reset-password  { token, newPassword, confirmNewPassword }
 * TODO(BACKEND-INTEGRATION): Consider writing the success message to
 *   sessionStorage so /login can display a "password changed" banner.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import AuthPageLayout from '@/components/auth/AuthPageLayout'
import { authService } from '@/services/auth.service'

// ─── Validation ───────────────────────────────────────────────────────────────

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

// ─── Shared input focus style ─────────────────────────────────────────────────

const focusStyle = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '0 0 0 2px #49342F'
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = ''
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

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
    const result = await authService.resetPasswordMerchant({
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
          router.push('/login')
          return 0
        }
        return n - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [success, router])

  // ── No token guard ───────────────────────────────────────────────────────
  if (!token) {
    return (
      <AuthPageLayout
        heroHeading="Reset your password"
        heroSubtext="Create a new secure password for your FlowMerce account."
        bgImage="/bg-login.png"
      >
        <div
          role="alert"
          className="flex flex-col items-center py-8 gap-4"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#fef2f2' }}
            aria-hidden="true"
          >
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center">
            Invalid Reset Link
          </h3>
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            This password reset link is missing a token. Please request a new
            one from the forgot password page.
          </p>
          <Link
            href="/forgot-password"
            className="mt-2 w-full py-3 text-white font-semibold rounded-lg text-center text-sm transition-colors block"
            style={{ backgroundColor: '#49342F' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a4038')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#49342F')}
          >
            REQUEST NEW LINK
          </Link>
        </div>
      </AuthPageLayout>
    )
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <AuthPageLayout
        heroHeading="Password updated!"
        heroSubtext="Your account is secure. Log in with your new password."
        bgImage="/bg-login.png"
      >
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center py-8 gap-4"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#f0fdf4' }}
            aria-hidden="true"
          >
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center">
            Password Reset Successfully
          </h3>
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            Your password has been updated.
          </p>
          <p className="text-xs text-gray-400 text-center">
            Redirecting to login in{' '}
            <span className="font-semibold text-gray-600">{countdown}</span>s…
          </p>
          <Link
            href="/login"
            className="mt-2 w-full py-3 text-white font-semibold rounded-lg text-center text-sm transition-colors block"
            style={{ backgroundColor: '#49342F' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a4038')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#49342F')}
          >
            CONTINUE TO LOGIN NOW
          </Link>
        </div>
      </AuthPageLayout>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <AuthPageLayout
      heroHeading="Create a new password"
      heroSubtext="Choose a strong password to keep your FlowMerce account secure."
      bgImage="/bg-login.png"
    >
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to Login
      </Link>

      <div className="text-sm font-semibold text-gray-600 mb-4 tracking-widest">
        NEW PASSWORD
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
        Your password must be at least 8 characters and include an uppercase
        letter and a number.
      </p>

      {/* ── API error ── */}
      {apiError && (
        <div
          id="form-error"
          role="alert"
          aria-live="assertive"
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <p className="text-sm text-red-700">{apiError}</p>
          {showNewLink && (
            <Link
              href="/forgot-password"
              className="text-xs font-medium underline mt-1 inline-block"
              style={{ color: '#49342F' }}
            >
              Request a new reset link
            </Link>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
        aria-labelledby="page-heading"
        noValidate
      >
        {/* ── New password ── */}
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            New Password
          </label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••••••••"
              {...register('newPassword')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg pr-10"
              aria-invalid={!!errors.newPassword}
              aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
              {...focusStyle}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showNew ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showNew ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.newPassword && (
            <p id="new-password-error" role="alert" className="mt-1.5 text-xs text-red-600">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* ── Confirm password ── */}
        <div>
          <label
            htmlFor="confirmNewPassword"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <Input
              id="confirmNewPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••••••••"
              {...register('confirmNewPassword')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg pr-10"
              aria-invalid={!!errors.confirmNewPassword}
              aria-describedby={errors.confirmNewPassword ? 'confirm-password-error' : undefined}
              {...focusStyle}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showConfirm ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.confirmNewPassword && (
            <p id="confirm-password-error" role="alert" className="mt-1.5 text-xs text-red-600">
              {errors.confirmNewPassword.message}
            </p>
          )}
        </div>

        {/* ── Password rules ── */}
        <ul className="text-xs text-gray-400 space-y-1 pl-4 list-disc" aria-label="Password requirements">
          <li>Minimum 8 characters</li>
          <li>At least one uppercase letter</li>
          <li>At least one number</li>
        </ul>

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
              <span>Resetting password…</span>
            </>
          ) : (
            'RESET PASSWORD'
          )}
        </Button>
      </form>
    </AuthPageLayout>
  )
}
