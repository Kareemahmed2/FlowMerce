'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg } from '@/components/store/store-types'

export default function StoreLoginPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const store = useStore()
  const auth = useCustomerAuth()

  // Show a "check your email" banner when arriving from signup in live mode.
  const activationRequired = searchParams.get('activation_required') === '1'
  const signupEmail = searchParams.get('email') ?? ''

  const [email, setEmail] = useState(signupEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const base = `/store/${slug}`
  const accent = store.colors.accent

  // Redirect if already logged in
  if (auth.isLoggedIn) {
    router.push(`${base}/profile`)
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const ok = await auth.login(email, password)
      if (ok) router.push(base)
      else setError('Invalid email or password')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {store.logoPreview ? (
            <img src={store.logoPreview} alt={store.brandName} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', margin: '0 auto 16px' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 12, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22, fontWeight: 700, color: textOnBg(accent) }}>
              {store.brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: '#999', margin: 0 }}>Sign in to your {store.brandName} account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background: store.colors.card, borderRadius: 16, padding: 28, border: '1px solid #00000008' }}>
          {activationRequired && (
            <div role="status" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>
              <strong>✓ Account created!</strong> Check your email{signupEmail ? ` (${signupEmail})` : ''} for an activation link, then sign in below.
            </div>
          )}
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="your@email.com" autoComplete="email" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 44 }}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 13 }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', height: 48,
              background: loading ? '#999' : accent,
              color: loading ? '#fff' : textOnBg(accent),
              border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s',
              marginBottom: 16,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 14, color: '#999', margin: 0 }}>
            Don&apos;t have an account?{' '}
            <Link href={`${base}/signup`} style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}>
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
