'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: '◈', href: '/admin' },
  { id: 'users',      label: 'Users',      icon: '◉', href: '/admin/users' },
  { id: 'merchants',  label: 'Merchants',  icon: '⊞', href: '/admin/merchants' },
  { id: 'stores',     label: 'Stores',     icon: '◎', href: '/admin/stores' },
  { id: 'categories', label: 'Categories', icon: '☷', href: '/admin/categories' },
  { id: 'orders',     label: 'All Orders', icon: '▦', href: '/admin/orders' },
]

const S: Record<string, CSSProperties> = {
  root:       { display: 'flex', minHeight: '100vh', background: '#f7f9fb', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", color: '#191c1e' },
  sidebar:    { width: 220, minWidth: 220, background: '#1e293b', display: 'flex', flexDirection: 'column', padding: '0 0 24px', flexShrink: 0 },
  sidebarTop: { padding: '24px 16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 },
  brandBadge: { display: 'inline-block', background: '#4f46e5', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8 },
  brandTitle: { fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' },
  brandSub:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' },
  nav:        { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' },
  navItem:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, fontSize: 14, fontWeight: 500, textDecoration: 'none', color: 'rgba(255,255,255,0.55)', transition: 'all 0.15s' },
  navActive:  { background: 'rgba(79,70,229,0.25)', color: '#fff' },
  navIcon:    { fontSize: 16, width: 20, textAlign: 'center' as const, flexShrink: 0 },
  main:       { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar:     { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0 },
  pageTitle:  { fontSize: 20, fontWeight: 800, margin: 0, color: '#1e293b', letterSpacing: '-0.01em' },
  adminBadge: { background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, letterSpacing: '0.06em', textTransform: 'uppercase' as const, border: '1px solid #fecaca' },
  content:    { flex: 1, padding: '28px', overflowY: 'auto' as const },
}

function titleForPath(pathname: string | null): string {
  if (!pathname) return 'Dashboard'
  const item = NAV_ITEMS.find((n) =>
    n.href === '/admin' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(n.href)
  )
  return item?.label ?? 'Admin'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageTitle = titleForPath(pathname)

  return (
    <ProtectedRoute requiredRole="ADMIN" redirectTo="/login?reason=admin_required">
    <div style={S.root}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarTop}>
          <span style={S.brandBadge}>Admin</span>
          <p style={S.brandTitle}>FlowMerce</p>
          <p style={S.brandSub}>Control Panel</p>
        </div>

        <nav style={S.nav}>
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin' || pathname === '/admin/'
                : pathname?.startsWith(item.href) ?? false
            return (
              <Link
                key={item.id}
                href={item.href}
                style={{ ...S.navItem, ...(active ? S.navActive : {}) }}
              >
                <span style={S.navIcon}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Back to dashboard */}
        <div style={{ marginTop: 'auto', padding: '0 8px' }}>
          <Link href="/dashboard" style={{ ...S.navItem, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            <span style={S.navIcon}>←</span>
            Merchant Dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <header style={S.topbar}>
          <h1 style={S.pageTitle}>{pageTitle}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={S.adminBadge}>Admin</span>
            <span style={{ fontSize: 13, color: '#888' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>
        <div style={S.content}>{children}</div>
      </main>
    </div>
    </ProtectedRoute>
  )
}
