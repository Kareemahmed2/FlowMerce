'use client'

import Link from 'next/link'
import { useStore } from './StoreProvider'
import { textOnBg } from './store-types'
import { useStoreBase } from '@/components/store/StoreBaseProvider'

export default function StoreFooter() {
  const store = useStore()

  const base = useStoreBase()
  const bg = store.colors.footer
  const fg = textOnBg(bg)
  const accent = store.colors.accent

  // Determine muted text opacity based on foreground colour
  const mutedStyle = { color: fg, opacity: 0.55 }
  const linkStyle = {
    color: fg, opacity: 0.75, textDecoration: 'none',
    fontSize: 14, lineHeight: '1.6',
    transition: 'opacity 0.2s',
  }

  return (
    <footer
      style={{
        background: bg, color: fg,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '60px 32px 40px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px 48px',
          marginBottom: 48,
        }}>
          {/* ── Brand ──────────────────────────────────────────── */}
          <div style={{ gridColumn: 'span 1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              {store.logoPreview ? (
                <img src={store.logoPreview} alt={store.brandName} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <span style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: accent, color: textOnBg(accent),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800,
                }}>
                  {store.brandName.charAt(0).toUpperCase()}
                </span>
              )}
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{store.brandName}</span>
            </div>
            <p style={{ ...mutedStyle, fontSize: 13, lineHeight: 1.7, maxWidth: 260, margin: '0 0 20px' }}>
              Your trusted destination for quality products. Shop with confidence.
            </p>
            {/* Social links */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                // globe
                <svg key="g" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
                // email
                <svg key="e" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
              ].map((icon, i) => (
                <a key={i} href="#" aria-label="Social link" style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `1px solid ${fg}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: fg, opacity: 0.55, textDecoration: 'none', transition: 'opacity 0.2s',
                }} className="store-footer-social">
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Shop / Categories ───────────────────────────── */}
          <div>
            <h5 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', ...mutedStyle, marginBottom: 16, margin: '0 0 16px' }}>
              Shop
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {store.categories.slice(0, 6).map((cat) => (
                <Link key={cat.id} href={`${base}/category/${cat.id}`} style={linkStyle} className="store-footer-link">
                  {cat.name}
                </Link>
              ))}
              {store.categories.length === 0 && (
                <>
                  <Link href={base} style={linkStyle} className="store-footer-link">All Products</Link>
                  <Link href={`${base}/cart`} style={linkStyle} className="store-footer-link">Cart</Link>
                </>
              )}
            </div>
          </div>

          {/* ── Support ─────────────────────────────────────── */}
          <div>
            <h5 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', ...mutedStyle, marginBottom: 16, margin: '0 0 16px' }}>
              Support
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { href: `${base}/account/orders`, label: 'Order Tracking' },
                { href: base, label: 'Returns & Refunds' },
                { href: base, label: 'Help Center' },
                { href: base, label: 'Privacy Policy' },
              ].map(({ href, label }) => (
                <Link key={label} href={href} style={linkStyle} className="store-footer-link">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* ── Newsletter ──────────────────────────────────── */}
          <div>
            <h5 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', ...mutedStyle, marginBottom: 16, margin: '0 0 16px' }}>
              Newsletter
            </h5>
            <p style={{ ...mutedStyle, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              Get exclusive deals and product updates.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              style={{ display: 'flex', gap: 0 }}
            >
              <input
                type="email"
                placeholder="Your email address"
                style={{
                  flex: 1, height: 40, padding: '0 14px',
                  borderRadius: '8px 0 0 8px',
                  border: `1.5px solid ${fg}25`, borderRight: 'none',
                  background: `${fg}10`, color: fg,
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button type="submit" style={{
                height: 40, padding: '0 16px',
                borderRadius: '0 8px 8px 0',
                border: 'none',
                background: accent, color: textOnBg(accent),
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'opacity 0.15s', whiteSpace: 'nowrap',
              }}
              className="store-cta-btn"
              >
                Subscribe
              </button>
            </form>

            {/* Payment methods */}
            {Array.isArray(store.payment) && store.payment.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ ...mutedStyle, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Accepted Payments
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {store.payment.map((m) => (
                    <span key={m} style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 5,
                      border: `1px solid ${fg}20`, fontWeight: 500, ...mutedStyle,
                    }}>
                      {m.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom bar ────────────────────────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${fg}15`,
          paddingTop: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12,
        }}>
          <p style={{ fontSize: 12, ...mutedStyle, margin: 0 }}>
            &copy; {new Date().getFullYear()} {store.brandName}. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Terms of Service', 'Cookie Policy'].map((l) => (
              <a key={l} href="#" style={{ fontSize: 12, ...mutedStyle, textDecoration: 'none', transition: 'opacity 0.2s' }} className="store-footer-link">
                {l}
              </a>
            ))}
          </div>
          <p style={{ fontSize: 12, ...mutedStyle, margin: 0 }}>
            Powered by <span style={{ fontWeight: 600 }}>FlowMerce</span>
          </p>
        </div>
      </div>

      <style>{`
        .store-footer-link:hover { opacity: 1 !important; }
        .store-footer-social:hover { opacity: 0.85 !important; }
        .store-cta-btn:hover { opacity: 0.88 !important; }
      `}</style>
    </footer>
  )
}
