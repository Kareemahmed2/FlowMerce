'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg } from '@/components/store/store-types'

export default function StoreSignupPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const store = useStore()
  const auth = useCustomerAuth()

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const base = useStoreBase()
  const accent = store.colors.accent

  if (auth.isLoggedIn) {
    router.push(`${base}/profile`)
    return null
  }

  const upd = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required'
    if (!form.phone.trim()) e.phone = 'Required'
    if (form.password.length < 8) e.password = 'At least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords don\'t match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const result = await auth.signup({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        password: form.password,
      }, slug)  // pass slug so activation email links to /store/{slug}/activate
      if (!result.ok) {
        setErrors({ general: 'Sign-up failed. The email may already be registered.' })
        return
      }
      if (result.activationRequired) {
        // Live mode — backend sent an activation email. Send the user to login
        // with a flag so the login page can show a "check your email" banner.
        router.push(`${base}/login?activation_required=1&email=${encodeURIComponent(form.email)}`)
      } else {
        // Mock mode — already logged in, go to storefront home.
        router.push(base || '/')
      }
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%', padding: '13px 16px', borderRadius: 10,
    border: errors[field] ? '1.5px solid #ef4444' : '1px solid #e5e7eb',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  })

  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }

  return (
    <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {store.logoPreview ? (
            <img src={store.logoPreview} alt={store.brandName} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', margin: '0 auto 16px' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 12, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22, fontWeight: 700, color: textOnBg(accent) }}>
              {store.brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Create your account</h1>
          <p style={{ fontSize: 14, color: '#999', margin: 0 }}>Join {store.brandName} and start shopping</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background: store.colors.card, borderRadius: 16, padding: 28, border: '1px solid #00000008' }}>
          {errors.general && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
              {errors.general}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input value={form.firstName} onChange={(e) => upd('firstName', e.target.value)} style={inputStyle('firstName')} placeholder="Ahmed" />
              {errors.firstName && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.firstName}</span>}
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input value={form.lastName} onChange={(e) => upd('lastName', e.target.value)} style={inputStyle('lastName')} placeholder="Hassan" />
              {errors.lastName && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.lastName}</span>}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input type="email" value={form.email} onChange={(e) => upd('email', e.target.value)} style={inputStyle('email')} placeholder="ahmed@example.com" autoComplete="email" />
            {errors.email && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.email}</span>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Phone *</label>
            <input value={form.phone} onChange={(e) => upd('phone', e.target.value)} style={inputStyle('phone')} placeholder="01xxxxxxxxx" />
            {errors.phone && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.phone}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Address</label>
              <input value={form.address} onChange={(e) => upd('address', e.target.value)} style={inputStyle('address')} placeholder="Street, building" />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input value={form.city} onChange={(e) => upd('city', e.target.value)} style={inputStyle('city')} placeholder="Cairo" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => upd('password', e.target.value)}
                  style={{ ...inputStyle('password'), paddingRight: 44 }}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12 }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.password}</span>}
            </div>
            <div>
              <label style={labelStyle}>Confirm Password *</label>
              <input type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => upd('confirmPassword', e.target.value)} style={inputStyle('confirmPassword')} placeholder="Repeat password" autoComplete="new-password" />
              {errors.confirmPassword && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.confirmPassword}</span>}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', height: 48,
              background: loading ? '#999' : accent,
              color: loading ? '#fff' : textOnBg(accent),
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s', marginBottom: 16,
            }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 14, color: '#999', margin: 0 }}>
            Already have an account?{' '}
            <Link href={`${base}/login`} style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
