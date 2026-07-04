'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg } from '@/components/store/store-types'

export default function StoreProfilePage() {
  const router = useRouter()
  const store = useStore()
  const auth = useCustomerAuth()

  const base = useStoreBase()
  const accent = store.colors.accent

  if (!auth.isLoggedIn || !auth.customer) {
    return (
      <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Please sign in</h2>
          <p style={{ color: '#999', fontSize: 14, margin: '0 0 20px' }}>You need to be logged in to view your profile.</p>
          <Link href={`${base}/login`} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const c = auth.customer
  const initials = `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase() || c.email.charAt(0).toUpperCase()
  const memberSince = new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const handleLogout = () => {
    auth.logout()
    router.push(base || '/')
  }

  const infoRow = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 14, color: '#999' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{value || '—'}</span>
    </div>
  )

  return (
    <div style={{ background: store.colors.background, color: store.colors.text }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px 64px' }}>
        {/* Header card */}
        <div style={{
          background: `linear-gradient(135deg, ${store.colors.header}, ${accent}88)`,
          borderRadius: 20, padding: '40px 32px', color: textOnBg(store.colors.header),
          display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32, flexWrap: 'wrap',
        }}>
          {/* Avatar */}
          {c.avatar ? (
            <img src={c.avatar} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, border: '3px solid rgba(255,255,255,0.3)' }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{c.firstName} {c.lastName}</h1>
            <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>{c.email}</p>
            <p style={{ fontSize: 12, opacity: 0.6, margin: '4px 0 0' }}>Member since {memberSince}</p>
          </div>
          <Link href={`${base}/settings`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.2)',
            color: 'inherit', textDecoration: 'none', fontSize: 13, fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Settings
          </Link>
        </div>

        {/* Info card */}
        <div style={{ background: store.colors.card, borderRadius: 16, padding: '24px 28px', border: '1px solid #00000008', marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Personal Information</h2>
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 12px' }}>Your account details and contact info</p>
          {infoRow('Full Name', `${c.firstName} ${c.lastName}`)}
          {infoRow('Email', c.email)}
          {infoRow('Phone', c.phone)}
          {infoRow('Address', c.address)}
          {infoRow('City', c.city)}
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
          {[
            { href: `${base}/orders`,               icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>, label: 'My Orders' },
            { href: `${base}/account/wallet`,        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, label: 'Wallet' },
            { href: `${base}/account/notifications`, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: 'Notifications' },
            { href: `${base}/wishlist`,              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, label: 'Wishlist' },
            { href: `${base}/cart`,                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>, label: 'View Cart' },
            { href: `${base}/settings`,              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, label: 'Settings' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href} style={{ background: store.colors.card, borderRadius: 12, padding: '18px', border: '1px solid #00000008', textDecoration: 'none', color: store.colors.text, display: 'flex', alignItems: 'center', gap: 12, transition: 'transform 0.2s' }} className="profile-link-card">
              {icon}
              <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: '1px solid #ef4444', borderRadius: 10,
            color: '#ef4444', padding: '12px 24px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.2s',
          }}
        >
          Sign Out
        </button>
      </div>

      <style>{`
        .profile-link-card:hover { transform: translateY(-2px); }
      `}</style>
    </div>
  )
}
