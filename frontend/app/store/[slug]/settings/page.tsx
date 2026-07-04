'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg } from '@/components/store/store-types'
import { userService } from '@/services/user.service'
import { authService } from '@/services/auth.service'

export default function StoreSettingsPage() {
  const router = useRouter()
  const store = useStore()
  const auth = useCustomerAuth()

  const base = useStoreBase()
  const accent = store.colors.accent

  const [activeSection, setActiveSection] = useState<'personal' | 'password' | 'notifications'>('personal')
  const [saved, setSaved] = useState(false)
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [personalError, setPersonalError] = useState('')

  // Personal info form
  const [personal, setPersonal] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: '',
  })

  // Password form
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  // Delete account state
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Notifications
  const [notifs, setNotifs] = useState({ orderUpdates: true, promotions: false, newsletter: true })

  useEffect(() => {
    if (auth.customer) {
      setPersonal({
        firstName: auth.customer.firstName,
        lastName: auth.customer.lastName,
        email: auth.customer.email,
        phone: auth.customer.phone,
        address: auth.customer.address,
        city: auth.customer.city,
      })
    }
  }, [auth.customer])

  if (!auth.isLoggedIn || !auth.customer) {
    return (
      <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Please sign in</h2>
          <p style={{ color: '#999', fontSize: 14, margin: '0 0 20px' }}>You need to be logged in to access settings.</p>
          <Link href={`${base}/login`} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </div>
    )
  }

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPersonal(true)
    setPersonalError('')

    // Backend updateProfile only takes fullName + phone (address/city are profile-local).
    const fullName = `${personal.firstName} ${personal.lastName}`.trim()
    const result = await userService.updateProfile(
      { fullName, phone: personal.phone },
      auth.getAuthHeader()
    )

    setSavingPersonal(false)

    if (!result.ok) {
      setPersonalError(result.error)
      return
    }

    // Sync the locally-cached profile (keeps address/city which are frontend-only fields).
    auth.updateProfile(personal)
    showSaved()
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (pw.newPw.length < 8) { setPwError('Password must be at least 8 characters'); return }
    if (pw.newPw !== pw.confirm) { setPwError('Passwords don\'t match'); return }

    setPwSaving(true)
    const result = await userService.changePassword(
      { currentPassword: pw.current, newPassword: pw.newPw, confirmNewPassword: pw.confirm },
      auth.getAuthHeader()
    )
    setPwSaving(false)

    if (!result.ok) {
      setPwError(result.error)
      return
    }
    setPw({ current: '', newPw: '', confirm: '' })
    showSaved()
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return
    setDeleting(true)
    setDeleteError('')
    const result = await authService.deleteCustomerAccount(auth.getAuthHeader())
    setDeleting(false)
    if (!result.ok) {
      setDeleteError(result.error)
      return
    }
    auth.logout()
    router.push(base || '/')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb',
    fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }

  const sections = [
    { id: 'personal' as const, label: 'Personal Info', icon: '👤' },
    { id: 'password' as const, label: 'Password', icon: '🔒' },
    { id: 'notifications' as const, label: 'Notifications', icon: '🔔' },
  ]

  return (
    <div style={{ background: store.colors.background, color: store.colors.text }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 64px' }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 13, color: '#999' }}>
          <Link href={base || '/'} style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span>/</span>
          <Link href={`${base}/profile`} style={{ color: '#999', textDecoration: 'none' }}>Profile</Link>
          <span>/</span>
          <span style={{ color: store.colors.text, fontWeight: 500 }}>Settings</span>
        </nav>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 32px', letterSpacing: '-0.02em' }}>Account Settings</h1>

        {/* Success toast */}
        {saved && (
          <div style={{
            position: 'fixed', top: 80, right: 24, zIndex: 100,
            background: '#22c55e', color: '#fff', padding: '12px 20px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.3s ease',
          }}>
            Settings saved!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32 }} className="settings-grid">
          {/* Sidebar */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: 10,
                  background: activeSection === s.id ? `${accent}12` : 'transparent',
                  color: activeSection === s.id ? accent : '#666',
                  border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                  textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.2s',
                }}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div style={{ background: store.colors.card, borderRadius: 16, padding: 28, border: '1px solid #00000008' }}>
            {/* Personal */}
            {activeSection === 'personal' && (
              <form onSubmit={handleSavePersonal}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 20px' }}>Personal Information</h2>
                {personalError && <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{personalError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>First Name</label>
                    <input value={personal.firstName} onChange={(e) => setPersonal((p) => ({ ...p, firstName: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name</label>
                    <input value={personal.lastName} onChange={(e) => setPersonal((p) => ({ ...p, lastName: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={personal.email} onChange={(e) => setPersonal((p) => ({ ...p, email: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Phone</label>
                  <input value={personal.phone} onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <input value={personal.address} onChange={(e) => setPersonal((p) => ({ ...p, address: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input value={personal.city} onChange={(e) => setPersonal((p) => ({ ...p, city: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <button type="submit" disabled={savingPersonal} style={{ background: savingPersonal ? '#999' : accent, color: textOnBg(accent), border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: savingPersonal ? 'not-allowed' : 'pointer' }}>
                  {savingPersonal ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            )}

            {/* Password */}
            {activeSection === 'password' && (
              <form onSubmit={handleChangePassword}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 20px' }}>Change Password</h2>
                {pwError && <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{pwError}</div>}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Current Password</label>
                  <input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>New Password</label>
                  <input type="password" value={pw.newPw} onChange={(e) => setPw((p) => ({ ...p, newPw: e.target.value }))} style={inputStyle} placeholder="Min 6 characters" />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} style={inputStyle} />
                </div>
                <button type="submit" disabled={pwSaving} style={{ background: pwSaving ? '#999' : accent, color: textOnBg(accent), border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: pwSaving ? 'not-allowed' : 'pointer' }}>
                  {pwSaving ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 20px' }}>Notification Preferences</h2>
                {[
                  { key: 'orderUpdates' as const, label: 'Order Updates', desc: 'Get notified when your order ships or is delivered' },
                  { key: 'promotions' as const, label: 'Promotions & Offers', desc: 'Receive special deals and discount codes' },
                  { key: 'newsletter' as const, label: 'Newsletter', desc: 'Weekly updates about new products and collections' },
                ].map((item) => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: '#999', margin: 0 }}>{item.desc}</p>
                    </div>
                    <button
                      onClick={() => { setNotifs((p) => ({ ...p, [item.key]: !p[item.key] })); showSaved() }}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: notifs[item.key] ? accent : '#e5e7eb',
                        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 2, left: notifs[item.key] ? 22 : 2,
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                ))}

                {/* Danger zone */}
                <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #fecaca' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#dc2626', margin: '0 0 8px' }}>Danger Zone</h3>
                  <p style={{ fontSize: 13, color: '#999', margin: '0 0 16px' }}>Once you delete your account, there is no going back.</p>
                  {deleteError && <div role="alert" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{deleteError}</div>}
                  <button onClick={handleDeleteAccount} disabled={deleting} style={{
                    background: 'none', border: '1px solid #ef4444', borderRadius: 10,
                    color: '#ef4444', padding: '10px 20px', fontSize: 13, fontWeight: 600,
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
                  }}>
                    {deleting ? 'Deleting…' : 'Delete Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @media (max-width: 768px) {
          .settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
