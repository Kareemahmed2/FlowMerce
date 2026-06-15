'use client'

import { generateStoreUrl } from '@/components/merchant/onboarding/constants'
import { useMerchantAuth } from '@/store/auth-store'
import { storeService } from '@/services/store.service'
import { authService } from '@/services/auth.service'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { S } from './dashboard-styles'
import { StoreSelector } from './StoreSelector'

const NAV_ITEMS = [
  { id: 'overview',   label: 'Overview',   icon: '◈', href: '/dashboard' },
  { id: 'orders',     label: 'Orders',     icon: '◎', href: '/dashboard/orders' },
  { id: 'products',   label: 'Products',   icon: '⊞', href: '/dashboard/products' },
  { id: 'inventory',  label: 'Inventory',  icon: '⊟', href: '/dashboard/inventory' },
  { id: 'payments',   label: 'Payments',   icon: '◇', href: '/dashboard/payments' },
  { id: 'wallet',     label: 'Wallet',     icon: '◈', href: '/dashboard/wallet' },
  { id: 'customers',  label: 'Customers',  icon: '◉', href: '/dashboard/customers' },
  { id: 'design',     label: 'Design',     icon: '◑', href: '/dashboard/design' },
  { id: 'analytics',  label: 'Analytics',  icon: '▦', href: '/dashboard/analytics' },
  { id: 'settings',   label: 'Settings',   icon: '⊙', href: '/dashboard/settings' },
]

function titleForPath(pathname: string | null): string {
  if (!pathname) return 'Overview'
  const item = NAV_ITEMS.find(
    (n) => n.href === pathname || (n.href !== '/dashboard' && pathname.startsWith(n.href))
  )
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'Overview'
  return item?.label ?? 'Overview'
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'FM'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const auth = useMerchantAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string | null>(null)

  // P4: load store info from backend instead of localStorage
  useEffect(() => {
    if (!auth.storeId) return
    storeService.getStoreById(auth.storeId, auth.getAuthHeader()).then((r) => {
      if (!r.ok) return
      setStoreSlug(r.data.storeUrl ?? r.data.storeName?.toLowerCase().replace(/\s+/g, '-') ?? null)
      setStoreName(r.data.storeName ?? null)
    })
  }, [auth.storeId, auth.getAuthHeader])

  const handleLogout = async () => {
    const token = auth.session?.accessToken ?? ''
    if (token) await authService.logoutMerchant(token)
    auth.clearSession()
    router.replace('/login')
  }

  const pageTitle = titleForPath(pathname)
  const displayName = storeName ?? auth.user?.fullName ?? 'Your store'
  const host = useMemo(
    () => storeSlug || generateStoreUrl(displayName),
    [storeSlug, displayName]
  )
  const storeHref = `http://localhost:3000/store/${host.split('.')[0]}`
  const avatar = useMemo(() => initialsFromName(displayName), [displayName])
  const plan = 'Merchant'

  return (
    <div style={S.root} onClick={() => setShowUserMenu(false)}>
      <aside style={{ ...S.sidebar, ...(sidebarOpen ? {} : S.sidebarCollapsed) }}>
        <div style={S.sidebarTop}>
          <div style={S.brandRow}>
            <div style={S.brandAvatar}>{avatar}</div>
            {sidebarOpen && (
              <div style={{ minWidth: 0 }}>
                <p style={S.brandName}>{displayName}</p>
                <p style={S.brandUrl}>{host}</p>
              </div>
            )}
          </div>
          {sidebarOpen && <span style={S.planBadge}>{plan}</span>}
        </div>

        <nav style={S.nav}>
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname === '/dashboard/'
                : pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.id}
                href={item.href}
                style={{ ...S.navItem, ...(active ? S.navItemActive : {}) }}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span style={S.navIcon}>{item.icon}</span>
                {sidebarOpen && <span style={S.navLabel}>{item.label}</span>}
                {sidebarOpen && active && <span style={S.navDot} />}
              </Link>
            )
          })}
        </nav>

        {sidebarOpen && (
          <div style={S.sidebarFooter}>
            <a href={storeHref} target="_blank" rel="noopener noreferrer" style={S.storeLink}>
              <span style={{ fontSize: 12 }}>▷</span> View Live Store
            </a>
          </div>
        )}

        <button
          type="button"
          style={S.collapseBtn}
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '◁' : '▷'}
        </button>
      </aside>

      <main style={S.main}>
        <header style={S.topbar}>
          <div>
            <h1 style={S.pageTitle}>{pageTitle}</h1>
            <p style={S.pageDate}>
              {new Date().toLocaleDateString('en-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div style={S.topbarRight}>
            <StoreSelector />
            <div style={S.periodToggle}>
              {(['7d', '30d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  style={{ ...S.periodBtn, ...(period === p ? S.periodBtnActive : {}) }}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Avatar + logout dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                style={{ ...S.topbarAvatar, cursor: 'pointer', border: 'none' }}
                onClick={() => setShowUserMenu((v) => !v)}
                title="Account menu"
              >
                {avatar}
              </button>
              {showUserMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: '#fff', border: '1px solid #ede8df', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 999,
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ece4' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0F0E0C', margin: 0 }}>{displayName}</p>
                    <p style={{ fontSize: 11, color: '#999', margin: '2px 0 0' }}>{storeSlug || 'No store yet'}</p>
                  </div>
                  <Link
                    href="/dashboard/settings"
                    style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: '#333', textDecoration: 'none' }}
                    onClick={() => setShowUserMenu(false)}
                  >
                    ⚙ Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); void handleLogout() }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', fontSize: 13, color: '#dc2626',
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderTop: '1px solid #f0ece4',
                    }}
                  >
                    ⎋ Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div style={S.content}>{children}</div>
      </main>
    </div>
  )
}
