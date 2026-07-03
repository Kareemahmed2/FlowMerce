'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useStore, useCart } from './StoreProvider'
import { useCustomerAuth } from './CustomerAuthProvider'
import { useRealtime } from './RealtimeProvider'
import { useWishlistSafe } from '@/store/wishlist-store'
import { notificationService } from '@/services/notification.service'
import { textOnBg } from './store-types'
import { useStoreBase } from '@/components/store/StoreBaseProvider'

// ── Icon helpers ──────────────────────────────────────────────────────────────
function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function CartIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}
function HeartIcon({ size = 22, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
function BellIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ count, bg, fg }: { count: number; bg: string; fg: string }) {
  if (count <= 0) return null
  return (
    <span style={{
      position: 'absolute', top: -5, right: -7,
      background: bg, color: fg,
      fontSize: 10, fontWeight: 700,
      minWidth: 17, height: 17, borderRadius: 9,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px', lineHeight: 1,
      border: '1.5px solid #fff',
    }}>
      {count > 9 ? '9+' : count}
    </span>
  )
}

// ── Icon button ───────────────────────────────────────────────────────────────
function IconBtn({
  children, label, href, onClick, badge, fg,
}: {
  children: React.ReactNode
  label: string
  href?: string
  onClick?: () => void
  badge?: number
  fg: string
}) {
  const inner = (
    <span style={{
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 38, height: 38, borderRadius: '50%',
      color: fg, transition: 'background 0.15s',
    }} className="store-icon-btn">
      {children}
      {badge !== undefined && badge > 0 && <Badge count={badge} bg="#ef4444" fg="#fff" />}
    </span>
  )
  if (href) return <Link href={href} aria-label={label} style={{ textDecoration: 'none' }}>{inner}</Link>
  return <button type="button" onClick={onClick} aria-label={label} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{inner}</button>
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StoreHeader() {
  const router = useRouter()
  const store = useStore()
  const cart = useCart()
  const auth = useCustomerAuth()
  const realtime = useRealtime()
  const wishlist = useWishlistSafe()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  // Scroll detection for glass effect intensity
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Unread notification count
  useEffect(() => {
    if (!auth.isLoggedIn) { setUnreadCount(0); return }
    // Pass the customer auth header explicitly — without it, the backend's
    // cookie fallback checks the merchant cookie first, which would show the
    // wrong count if the same browser also has a merchant session open.
    notificationService.getUnreadCount(auth.getAuthHeader()).then((r) => { if (r.ok) setUnreadCount(r.data) }).catch(() => {})
    const id = setInterval(() => {
      notificationService.getUnreadCount(auth.getAuthHeader()).then((r) => { if (r.ok) setUnreadCount(r.data) }).catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
  }, [auth.isLoggedIn, auth.getAuthHeader])

  // Refresh immediately on a real-time order/account event instead of waiting
  // for the next 60s poll — the persisted notification is written before the
  // SSE push, so this read is never ahead of the row it's counting.
  useEffect(() => {
    if (!auth.isLoggedIn || realtime.notificationTick === 0) return
    notificationService.getUnreadCount(auth.getAuthHeader()).then((r) => { if (r.ok) setUnreadCount(r.data) }).catch(() => {})
  }, [realtime.notificationTick, auth.isLoggedIn, auth.getAuthHeader])

  // Focus search on open
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 10)
  }, [searchOpen])

  const base = useStoreBase()
  const headerBg = store.colors.header    // Merchant's chosen header color
  const fg = textOnBg(headerBg)
  const accent = store.colors.accent      // Merchant's chosen accent / CTA color
  const wishlistCount = wishlist?.items.length ?? 0

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchRef.current?.value.trim() ?? ''
    setSearchOpen(false)
    setMobileOpen(false)
    router.push(`${base}/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  // Derive contrasting badge colours from the accent
  const badgeFg = textOnBg(accent)

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? `${headerBg}e6` : headerBg,
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: `1px solid ${fg === '#ffffff' || fg === '#fff' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'background 0.3s, backdrop-filter 0.3s',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        color: fg,
      }}
    >
      <div style={{
        maxWidth: 1440, margin: '0 auto',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 68,
        gap: 24,
      }}>
        {/* ── Logo ─────────────────────────────────────────── */}
        <Link
          href={base}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            textDecoration: 'none', color: fg,
            flexShrink: 0,
          }}
        >
          {store.logoPreview ? (
            <img
              src={store.logoPreview}
              alt={store.brandName}
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
            />
          ) : (
            <span style={{
              width: 36, height: 36, borderRadius: 8,
              background: accent, color: textOnBg(accent),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
            }}>
              {(store.brandName || 'S').charAt(0).toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {store.brandName || store.storeUrl}
          </span>
        </Link>

        {/* ── Desktop nav ───────────────────────────────────── */}
        <nav
          className="store-desktop-nav"
          style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}
        >
          <Link href={base} style={{ padding: '6px 14px', borderRadius: 8, color: fg, textDecoration: 'none', fontSize: 14, fontWeight: 500, opacity: 0.85, transition: 'opacity 0.2s, background 0.2s' }} className="store-nav-link">
            Home
          </Link>
          {store.categories.slice(0, 5).map((cat) => (
            <Link
              key={cat.id}
              href={`${base}/category/${cat.id}`}
              style={{ padding: '6px 14px', borderRadius: 8, color: fg, textDecoration: 'none', fontSize: 14, fontWeight: 500, opacity: 0.75, transition: 'opacity 0.2s, background 0.2s' }}
              className="store-nav-link"
            >
              {cat.name}
            </Link>
          ))}
        </nav>

        {/* ── Desktop Search ─────────────────────────────────── */}
        <div className="store-desktop-nav" style={{ position: 'relative', flexShrink: 0 }}>
          {searchOpen ? (
            <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center' }}>
              <input
                ref={searchRef}
                type="search"
                placeholder="Search products…"
                onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false) }}
                onBlur={(e) => {
                  if (!e.currentTarget.form?.contains(e.relatedTarget as Node)) setSearchOpen(false)
                }}
                style={{
                  width: 240, height: 38, padding: '0 14px',
                  borderRadius: '10px 0 0 10px',
                  border: `1.5px solid ${fg === '#fff' || fg === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)'}`,
                  borderRight: 'none',
                  background: `${headerBg}cc`,
                  color: fg, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  transition: 'width 0.25s',
                }}
              />
              <button type="submit" style={{
                height: 38, padding: '0 14px',
                borderRadius: '0 10px 10px 0',
                border: 'none',
                background: accent, color: textOnBg(accent),
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}>
                <SearchIcon size={14} />
              </button>
            </form>
          ) : (
            <IconBtn label="Search" onClick={() => setSearchOpen(true)} fg={fg}>
              <SearchIcon />
            </IconBtn>
          )}
        </div>

        {/* ── Right actions ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Notification bell */}
          {auth.isLoggedIn && (
            <IconBtn
              label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              href={`${base}/account/notifications`}
              badge={unreadCount}
              fg={fg}
            >
              <BellIcon />
            </IconBtn>
          )}

          {/* Wishlist */}
          <IconBtn label="Wishlist" href={`${base}/wishlist`} badge={wishlistCount} fg={fg}>
            <HeartIcon />
          </IconBtn>

          {/* Cart */}
          <IconBtn label="Cart" href={`${base}/cart`} badge={cart.itemCount} fg={fg}>
            <CartIcon />
          </IconBtn>

          {/* Divider */}
          <span style={{ width: 1, height: 22, background: `${fg}25`, margin: '0 4px' }} />

          {/* Auth */}
          {auth.isLoggedIn && auth.customer ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: `${fg}12`, border: 'none', borderRadius: 9,
                  padding: '6px 10px 6px 7px', cursor: 'pointer',
                  color: fg, fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                className="store-auth-btn"
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: accent, color: textOnBg(accent),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {auth.customer.firstName.charAt(0).toUpperCase()}
                </span>
                <span className="store-desktop-nav">{auth.customer.firstName}</span>
                <ChevronDown />
              </button>

              {userMenuOpen && (
                <>
                  <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: '#fff', borderRadius: 14, padding: 6,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)', minWidth: 190, zIndex: 61,
                    border: '1px solid #f0f0f0',
                  }}>
                    {[
                      { href: `${base}/profile`, label: 'Profile' },
                      { href: `${base}/account/orders`, label: 'My Orders' },
                      { href: `${base}/account/wallet`, label: 'Wallet' },
                      { href: `${base}/account/notifications`, label: 'Notifications', badge: unreadCount },
                      { href: `${base}/settings`, label: 'Settings' },
                    ].map(({ href, label, badge }) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '9px 12px', borderRadius: 8,
                          textDecoration: 'none', color: '#1e293b',
                          fontSize: 13, fontWeight: 500, transition: 'background 0.12s',
                        }}
                        className="store-dropdown-item"
                      >
                        {label}
                        {badge && badge > 0 ? (
                          <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '1px 6px' }}>{badge}</span>
                        ) : null}
                      </Link>
                    ))}
                    <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />
                    <button
                      onClick={() => { auth.logout(); setUserMenuOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', width: '100%',
                        padding: '9px 12px', borderRadius: 8,
                        background: 'none', border: 'none',
                        color: '#ef4444', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                      className="store-dropdown-item"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="store-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link
                href={`${base}/login`}
                style={{
                  color: fg, textDecoration: 'none', fontSize: 13, fontWeight: 500,
                  padding: '7px 14px', borderRadius: 8,
                  border: `1px solid ${fg === '#fff' || fg === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)'}`,
                  transition: 'background 0.15s',
                }}
                className="store-auth-btn"
              >
                Sign In
              </Link>
              <Link
                href={`${base}/signup`}
                style={{
                  background: accent, color: textOnBg(accent),
                  textDecoration: 'none', fontSize: 13, fontWeight: 600,
                  padding: '7px 16px', borderRadius: 8,
                  transition: 'opacity 0.15s',
                }}
                className="store-cta-btn"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="store-mobile-btn"
            style={{ background: 'none', border: 'none', color: fg, cursor: 'pointer', padding: 4, display: 'none', marginLeft: 4 }}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile nav ─────────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          style={{
            background: headerBg,
            borderTop: `1px solid ${fg === '#fff' || fg === '#ffffff' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
            padding: '16px 24px 24px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
          className="store-mobile-nav"
        >
          {/* Mobile search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', marginBottom: 8 }}>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search products…"
              style={{
                flex: 1, height: 42, padding: '0 14px',
                borderRadius: '10px 0 0 10px',
                border: `1.5px solid ${fg === '#fff' || fg === '#ffffff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)'}`,
                borderRight: 'none',
                background: `${headerBg}cc`, color: fg,
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button type="submit" onClick={() => setMobileOpen(false)} style={{ height: 42, padding: '0 16px', borderRadius: '0 10px 10px 0', border: 'none', background: accent, color: textOnBg(accent), cursor: 'pointer' }}>
              <SearchIcon size={14} />
            </button>
          </form>

          {/* Nav links */}
          {[{ href: base, label: 'Home' }, ...store.categories.map((c) => ({ href: `${base}/category/${c.id}`, label: c.name }))].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} style={{ color: fg, textDecoration: 'none', fontSize: 15, fontWeight: 500, padding: '10px 4px', borderBottom: `1px solid ${fg}12`, display: 'block' }}>
              {label}
            </Link>
          ))}

          {/* Auth */}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {auth.isLoggedIn ? (
              <>
                {[
                  { href: `${base}/profile`, label: 'Profile' },
                  { href: `${base}/account/orders`, label: 'My Orders' },
                  { href: `${base}/account/wallet`, label: 'Wallet' },
                  { href: `${base}/account/notifications`, label: 'Notifications' },
                  { href: `${base}/settings`, label: 'Settings' },
                ].map(({ href, label }) => (
                  <Link key={label} href={href} onClick={() => setMobileOpen(false)} style={{ color: fg, textDecoration: 'none', fontSize: 15, fontWeight: 500, padding: '9px 4px', display: 'block' }}>
                    {label}
                  </Link>
                ))}
                <button onClick={() => { auth.logout(); setMobileOpen(false) }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 15, fontWeight: 500, padding: '9px 4px', cursor: 'pointer', textAlign: 'start', fontFamily: 'inherit', display: 'block', width: '100%' }}>
                  Sign Out
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                <Link href={`${base}/login`} onClick={() => setMobileOpen(false)} style={{ flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 9, border: `1px solid ${fg}40`, color: fg, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
                  Sign In
                </Link>
                <Link href={`${base}/signup`} onClick={() => setMobileOpen(false)} style={{ flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 9, background: accent, color: textOnBg(accent), textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .store-desktop-nav { display: none !important; }
          .store-mobile-btn { display: flex !important; }
        }
        .store-nav-link:hover { opacity: 1 !important; background: rgba(128,128,128,0.1) !important; }
        .store-icon-btn:hover { background: rgba(128,128,128,0.12) !important; }
        .store-auth-btn:hover { background: rgba(128,128,128,0.12) !important; }
        .store-cta-btn:hover { opacity: 0.88 !important; }
        .store-dropdown-item:hover { background: #f7f9fb !important; }
      `}</style>
    </header>
  )
}
