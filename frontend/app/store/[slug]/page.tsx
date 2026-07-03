'use client'

import Link from 'next/link'
import { useStore, useCart } from '@/components/store/StoreProvider'
import ProductCard from '@/components/store/ProductCard'
import { StorefrontRenderer } from '@/components/store/StorefrontRenderer'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { getAllProducts, textOnBg } from '@/components/store/store-types'

// ── Trust feature data ─────────────────────────────────────────────────────────
const TRUST_FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
        <rect x="9" y="11" width="14" height="10" rx="2" />
        <path d="M13 16h5" />
      </svg>
    ),
    title: 'Fast Delivery',
    sub: 'Next-day delivery available',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: '2-Year Warranty',
    sub: 'Comprehensive protection plan',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Expert Support',
    sub: '24/7 priority assistance',
  },
]

// ── Category bento card ─────────────────────────────────────────────────────────
function CategoryBentoCard({
  cat, href, size = 'sm', accent,
}: {
  cat: { id: number | string; name: string; products: Array<{ images?: string[] }> }
  href: string
  size?: 'lg' | 'sm'
  accent: string
}) {
  const thumb = cat.products[0]?.images?.[0] ?? null
  return (
    <Link
      href={href}
      className="sf-bento-card"
      style={{
        textDecoration: 'none',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(30,41,59,0.07)',
        padding: 24,
        position: 'relative',
        transition: 'box-shadow 0.25s, transform 0.25s',
        minHeight: size === 'lg' ? 220 : 160,
      }}
    >
      {/* bg image subtle overlay */}
      {thumb && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${thumb})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.08, zIndex: 0,
        }} />
      )}
      {/* Icon placeholder */}
      <span style={{
        position: 'relative', zIndex: 1,
        fontSize: 32, lineHeight: 1, display: 'block', marginBottom: 12,
        color: accent,
      }}>
        <svg width={size === 'lg' ? 36 : 28} height={size === 'lg' ? 36 : 28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <path d="M2 17l5-5 4 4 3-3 8 8" />
        </svg>
      </span>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h3 style={{
          fontSize: size === 'lg' ? 20 : 15, fontWeight: 700,
          color: '#1e293b', margin: '0 0 4px', letterSpacing: '-0.01em',
        }}>
          {cat.name}
        </h3>
        <span style={{ fontSize: 12, color: '#75777d', fontWeight: 500 }}>
          {cat.products.length} product{cat.products.length !== 1 ? 's' : ''}
        </span>
      </div>
      <style>{`
        .sf-bento-card:hover {
          box-shadow: 0 8px 24px rgba(30,41,59,0.1);
          transform: translateY(-3px);
        }
      `}</style>
    </Link>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────────
export default function StoreHome() {
  const store = useStore()
  const base = useStoreBase()

  const allProducts = getAllProducts(store.categories)
  const featuredProducts = allProducts.slice(0, 8)
  const newProducts = allProducts.slice(0, 4)
  const accent = store.colors.accent
  const headerBg = store.colors.header

  // If merchant published a custom home page, render it instead.
  const homePage = store.pages?.find(
    (p) =>
      (p.pageType?.toUpperCase() === 'HOME' || p.slug === 'home' || p.slug === '/' || p.navOrder === 0) &&
      p.isPublished !== false &&
      (p.components?.some((c) => c.isVisible !== false) ?? false),
  )
  if (homePage) return <StorefrontRenderer components={homePage.components} />

  return (
    <div style={{ background: '#f7f9fb', color: '#191c1e' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="sf-hero" style={{
        position: 'relative',
        background: headerBg,
        minHeight: 560,
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>
        {/* subtle grid pattern overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        {/* accent gradient orb */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-5%',
          width: '55%', paddingBottom: '55%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
          zIndex: 0,
        }} />

        <div className="sf-section" style={{
          position: 'relative', zIndex: 1,
          maxWidth: 1440, margin: '0 auto',
          padding: '80px 32px',
          width: '100%',
        }}>
          <div style={{ maxWidth: 600 }}>
            <span style={{
              display: 'inline-block', marginBottom: 16,
              background: `${accent}22`, color: accent,
              fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.18em',
              padding: '5px 14px', borderRadius: 99,
              border: `1px solid ${accent}40`,
            }}>
              Official Store
            </span>
            <h1 style={{
              fontSize: 'clamp(36px, 5.5vw, 60px)',
              fontWeight: 800,
              color: textOnBg(headerBg),
              margin: '0 0 18px',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}>
              Welcome to {store.brandName}
            </h1>
            <p style={{
              fontSize: 'clamp(15px, 1.8vw, 18px)',
              color: textOnBg(headerBg),
              opacity: 0.75,
              margin: '0 0 36px',
              lineHeight: 1.65,
              maxWidth: 480,
            }}>
              Discover {allProducts.length > 0
                ? `${allProducts.length} curated products across ${store.categories.length} ${store.categories.length === 1 ? 'category' : 'categories'}.`
                : 'our curated collection of quality products.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                href={store.categories[0] ? `${base}/category/${store.categories[0].id}` : '#products'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: accent, color: textOnBg(accent),
                  padding: '13px 28px', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  transition: 'opacity 0.18s',
                  boxShadow: `0 4px 16px ${accent}50`,
                }}
                className="store-cta-btn"
              >
                Shop Now
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              {store.categories.length > 1 && (
                <Link
                  href="#categories"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    border: `1.5px solid ${textOnBg(headerBg) === '#fff' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)'}`,
                    color: textOnBg(headerBg),
                    padding: '12px 24px', borderRadius: 10,
                    fontSize: 14, fontWeight: 500, textDecoration: 'none',
                    transition: 'background 0.18s',
                  }}
                  className="store-ghost-btn"
                >
                  Browse Categories
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CATEGORIES — bento grid
      ══════════════════════════════════════════════════════════════════════ */}
      {store.categories.length > 0 && (
        <section id="categories" className="sf-section" style={{ maxWidth: 1440, margin: '0 auto', padding: '64px 32px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                Browse Categories
              </h2>
              <p style={{ fontSize: 14, color: '#75777d', margin: 0 }}>Find the perfect product for your needs</p>
            </div>
            {store.categories.length > 4 && (
              <Link href={base} style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }} className="store-text-link">
                View all
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Link>
            )}
          </div>

          {/* Bento: 2-col + 1-col + 1-col for first 4 categories */}
          {store.categories.length >= 4 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto', gap: 16 }} className="sf-bento-grid">
              <div style={{ gridColumn: 'span 2', gridRow: 'span 1' }}>
                <CategoryBentoCard cat={store.categories[0]} href={`${base}/category/${store.categories[0].id}`} size="lg" accent={accent} />
              </div>
              <div><CategoryBentoCard cat={store.categories[1]} href={`${base}/category/${store.categories[1].id}`} accent={accent} /></div>
              <div><CategoryBentoCard cat={store.categories[2]} href={`${base}/category/${store.categories[2].id}`} accent={accent} /></div>
              {store.categories.slice(3, 7).map((cat) => (
                <div key={cat.id}><CategoryBentoCard cat={cat} href={`${base}/category/${cat.id}`} accent={accent} /></div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {store.categories.map((cat) => (
                <CategoryBentoCard key={cat.id} cat={cat} href={`${base}/category/${cat.id}`} accent={accent} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          NEW ARRIVALS / FEATURED PRODUCTS
      ══════════════════════════════════════════════════════════════════════ */}
      {featuredProducts.length > 0 && (
        <section id="products" style={{ background: '#eceef0', padding: '64px 0', marginTop: 64 }}>
          <div className="sf-section" style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                  {store.categories.length > 0 ? 'New Arrivals' : 'Our Products'}
                </h2>
                <p style={{ fontSize: 14, color: '#75777d', margin: 0 }}>Handpicked for you this season</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Prev/next — cosmetic only, navigation handled per-category */}
                {['chevron_left', 'chevron_right'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: '1px solid #c5c6cd',
                      background: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'default',
                      color: '#45474c',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {d === 'chevron_left'
                        ? <polyline points="15 18 9 12 15 6" />
                        : <polyline points="9 18 15 12 9 6" />}
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 24,
            }}>
              {featuredProducts.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  categoryName={p.categoryName}
                  isNew={i < 4}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TRUST BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="sf-section" style={{ maxWidth: 1440, margin: '0 auto', padding: '56px 32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 0,
          borderTop: '1px solid #e2e8f0',
          paddingTop: 48,
        }}>
          {TRUST_FEATURES.map((f, i) => (
            <div key={f.title} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '0 24px',
              borderRight: i < TRUST_FEATURES.length - 1 ? '1px solid #e2e8f0' : 'none',
            }} className="sf-trust-item">
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `${accent}15`,
                color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>{f.title}</h4>
                <p style={{ fontSize: 13, color: '#75777d', margin: 0 }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          EMPTY STATE
      ══════════════════════════════════════════════════════════════════════ */}
      {allProducts.length === 0 && (
        <section style={{
          maxWidth: 500, margin: '0 auto',
          padding: '80px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#eceef0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#75777d',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>No products yet</h2>
          <p style={{ color: '#75777d', fontSize: 14, lineHeight: 1.6 }}>
            The store owner is still setting things up. Check back soon!
          </p>
        </section>
      )}

      <style>{`
        .store-cta-btn:hover { opacity: 0.88 !important; }
        .store-ghost-btn:hover { background: rgba(255,255,255,0.1) !important; }
        .store-text-link:hover { text-decoration: underline !important; }
        @media (max-width: 768px) {
          .sf-bento-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .sf-trust-item { border-right: none !important; padding: 12px 0 !important; }
        }
        @media (max-width: 480px) {
          .sf-bento-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
