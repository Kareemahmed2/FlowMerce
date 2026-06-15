'use client'

import React from "react"

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useMerchantAuth, buildSession } from '@/store/auth-store'
import { storeService } from '@/services/store.service'
import { redirectToOAuth } from '@/lib/oauth'
import type { OAuthProvider } from '@/lib/oauth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function SignupPage() {
  const router = useRouter()
  const auth = useMerchantAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // POST /auth/merchant/register
      const response = await fetch(`${API_BASE_URL}/auth/merchant/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const json = await response.json() as {
        success?: boolean
        message?: string
        /** CON-2: field-level validation errors (was `details`, now `fieldErrors`). */
        fieldErrors?: Record<string, string>
        data?: {
          accessToken: string
          refreshToken: string
          expiresIn: number
          user: { userId: number; email: string; fullName: string; role: string; createdAt: string }
        }
      }

      if (!response.ok || !json.success) {
        // CON-2: backend now serializes validation errors as `fieldErrors` (not `details`).
        const fieldErrors = json.fieldErrors ? Object.values(json.fieldErrors).join(' · ') : ''
        throw new Error(fieldErrors || json.message || `Registration failed (${response.status})`)
      }

      // Backend may auto-login (returns token) OR require email activation (no token)
      if (json.data?.accessToken) {
        // Auto-login path — save session and go to onboarding
        const session = buildSession(json.data)
        auth.setSession(session)

        // Fetch storeId if one already exists
        const storesR = await storeService.getMyStores(auth.getAuthHeader())
        if (storesR.ok && storesR.data.length > 0) {
          auth.patchStoreId(storesR.data[0].storeId)
        }

        router.push('/onboarding')
      } else {
        // Email activation required
        setSuccess(
          `Account created! Check your email (${formData.email}) for an activation link, then log in.`
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialSignup = (provider: OAuthProvider) => {
    redirectToOAuth(provider)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0f172a', position: 'relative', overflow: 'hidden', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
      <Image src="/bg-signup.png" alt="FlowMerce Background" fill className="object-cover opacity-40" />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.75) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: '100%' }}>
        {/* ── Left hero ──────────────────────────────────────────────── */}
        <div className="hidden lg:flex" style={{ width: '50%', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <Image src="/logo.png" alt="FlowMerce Logo" width={48} height={48} className="w-12 h-12" />
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>FlowMerce</span>
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 20px', maxWidth: 480 }}>
            Start your commerce journey today.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 400, margin: '0 0 36px' }}>
            Create your merchant account in minutes and launch your store with FlowMerce.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 40, height: 3, borderRadius: 2, background: '#4f46e5' }} />
            <div style={{ width: 24, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: 16, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>

        {/* ── Right form ────────────────────────────────────────────── */}
        <div style={{ width: '100%', maxWidth: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }} className="auth-form-side">
          <div style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 20, padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              LET&apos;S GET YOU STARTED
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '0 0 28px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Create your account
            </h1>

            {error && (
              <div style={{ marginBottom: 20, padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
              </div>
            )}
            {success && (
              <div style={{ marginBottom: 20, padding: '12px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: '#059669', margin: 0 }}>{success}</p>
              </div>
            )}

            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Your Name', name: 'name', type: 'text', placeholder: 'Full name', required: true },
                { label: 'Email', name: 'email', type: 'email', placeholder: 'you@example.com', required: true },
                { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••••••', required: true, minLength: 8 },
              ].map(({ label, name, type, placeholder, required, minLength }) => (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#45474c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
                  <Input
                    type={type} name={name}
                    value={formData[name as keyof typeof formData]}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    required={required}
                    minLength={minLength}
                    className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#1e293b' }}
                  />
                  {name === 'password' && formData.password.length > 0 && formData.password.length < 8 && (
                    <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>At least 8 characters ({formData.password.length}/8)</p>
                  )}
                </div>
              ))}

              <Button type="submit" disabled={loading}
                className="w-full py-3 text-white font-bold rounded-lg transition-opacity"
                style={{ backgroundColor: '#4f46e5', marginTop: 4, fontSize: 14, letterSpacing: '-0.01em' }}
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Account…</> : 'Get Started →'}
              </Button>
            </form>

            <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 12, color: '#75777d', fontWeight: 500 }}>Or continue with</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { provider: 'google' as OAuthProvider, label: 'Sign up with Google', icon: <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
                { provider: 'facebook' as OAuthProvider, label: 'Sign up with Facebook', icon: <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
              ].map(({ provider, label, icon }) => (
                <button key={provider} type="button" onClick={() => handleSocialSignup(provider)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#1e293b', transition: 'background 0.15s', fontFamily: 'inherit' }}
                  className="auth-social-btn"
                >
                  {icon}{label}
                </button>
              ))}
              <button type="button" disabled style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 0', borderRadius: 10, border: '1.5px solid #f2f4f6', background: '#f7f9fb', cursor: 'not-allowed', fontSize: 13, color: '#c5c6cd', fontFamily: 'inherit' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.29.89 3.08.89.79 0 2.38-1.1 4.02-.92 1.26.07 2.91.78 3.8 2.38-3.69 2.23-2.86 6.92.5 7.98-.47 1.5-1.3 2.7-2.4 3.64zm-9.1-14.85c-.11-1.88 1.39-3.54 3.2-3.72.23 1.85-1.57 3.42-3.2 3.72z"/></svg>
                Sign up with Apple (coming soon)
              </button>
            </div>

            <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#75777d' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }} className="auth-link">
                Log in →
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .auth-form-side { max-width: 100% !important; }
        @media (max-width: 1024px) { .auth-form-side { max-width: 100% !important; } }
        .auth-social-btn:hover { background: #f7f9fb !important; }
        .auth-link:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  )
}
