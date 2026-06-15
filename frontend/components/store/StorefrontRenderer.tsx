'use client'

/**
 * FEAT-RENDER — renders a published storefront page built in the design studio.
 *
 * Each backend ComponentResponse has a `componentType` and a `content` JSON
 * string. We parse the content and render the matching React block, pulling
 * live products/categories from the StoreProvider context.
 *
 * Component types (see COMPONENT_PALETTE in types/storefront.types.ts):
 *   HERO, TEXT, IMAGE, PRODUCT_GRID, CATEGORY_LIST, CTA, SPACER, DIVIDER
 *
 * Unknown component types are skipped gracefully so a future builder addition
 * never crashes an existing storefront.
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useStore } from '@/components/store/StoreProvider'
import ProductCard from '@/components/store/ProductCard'
import { getAllProducts, textOnBg } from '@/components/store/store-types'
import type { ComponentResponse } from '@/types/storefront.types'

function safeParse(content: string): Record<string, unknown> {
  try {
    const v = JSON.parse(content || '{}')
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

export function StorefrontRenderer({ components }: { components: ComponentResponse[] }) {
  const { slug } = useParams<{ slug: string }>()
  const store = useStore()
  const base = `/store/${slug}`
  const accent = store.colors.accent

  const visible = [...components]
    .filter((c) => c.isVisible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  return (
    <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '100%' }}>
      {visible.map((c) => {
        const data = safeParse(c.content)
        switch (c.componentType?.toUpperCase()) {
          // ── HERO ──────────────────────────────────────────────────────────
          case 'HERO': {
            const title = str(data.title) || `Welcome to ${store.brandName}`
            const subtitle = str(data.subtitle)
            const cta = str(data.cta) || 'Shop Now'
            const href = store.categories[0] ? `${base}/category/${store.categories[0].id}` : '#'
            return (
              <section key={c.componentId} style={{
                background: `linear-gradient(135deg, ${store.colors.header}, ${accent}88)`,
                color: textOnBg(store.colors.header),
                padding: '80px 24px', textAlign: 'center',
              }}>
                <div style={{ maxWidth: 680, margin: '0 auto' }}>
                  <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-0.03em' }}>{title}</h1>
                  {subtitle && <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', opacity: 0.85, margin: '0 0 32px', lineHeight: 1.6 }}>{subtitle}</p>}
                  <Link href={href} style={{ display: 'inline-block', background: '#fff', color: store.colors.header, padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>{cta}</Link>
                </div>
              </section>
            )
          }

          // ── TEXT ──────────────────────────────────────────────────────────
          case 'TEXT': {
            const heading = str(data.heading)
            const body = str(data.body)
            return (
              <section key={c.componentId} style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
                {heading && <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em' }}>{heading}</h2>}
                {body && <p style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.85, whiteSpace: 'pre-line', margin: 0 }}>{body}</p>}
              </section>
            )
          }

          // ── IMAGE ─────────────────────────────────────────────────────────
          case 'IMAGE': {
            const url = str(data.url)
            if (!url) return null
            return (
              <section key={c.componentId} style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={str(data.alt)} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
              </section>
            )
          }

          // ── PRODUCT_GRID ──────────────────────────────────────────────────
          case 'PRODUCT_GRID': {
            const rows = num(data.rows, 2)
            const cols = num(data.cols, 3)
            const categoryId = data.categoryId == null ? null : num(data.categoryId)
            const pool = categoryId !== null
              ? (store.categories.find((cat) => cat.id === categoryId)?.products ?? []).map((p) => ({ ...p, categoryName: store.categories.find((cat) => cat.id === categoryId)?.name ?? '' }))
              : getAllProducts(store.categories)
            const limit = Math.max(1, rows * cols)
            const items = pool.slice(0, limit)
            if (items.length === 0) return null
            return (
              <section key={c.componentId} style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
                {c.name && <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 24px', letterSpacing: '-0.02em' }}>{c.name}</h2>}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(240px, 1fr))`, gap: 24 }}>
                  {items.map((p) => (
                    <ProductCard key={p.id} product={p} categoryName={p.categoryName} />
                  ))}
                </div>
              </section>
            )
          }

          // ── CATEGORY_LIST ─────────────────────────────────────────────────
          case 'CATEGORY_LIST': {
            if (store.categories.length === 0) return null
            return (
              <section key={c.componentId} style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 24px', letterSpacing: '-0.02em' }}>{c.name || 'Shop by Category'}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                  {store.categories.map((cat) => {
                    const thumb = cat.products[0]?.images?.[0] || null
                    return (
                      <Link key={cat.id} href={`${base}/category/${cat.id}`} style={{ textDecoration: 'none', color: store.colors.text }}>
                        <div style={{ borderRadius: 12, overflow: 'hidden', background: store.colors.card, border: '1px solid #00000008' }}>
                          <div style={{ aspectRatio: '16/10', background: thumb ? undefined : `${accent}15`, overflow: 'hidden' }}>
                            {thumb && <img src={thumb} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ padding: '12px 14px' }}>
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{cat.name}</h3>
                            <span style={{ fontSize: 12, color: '#999' }}>{cat.products.length} products</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          }

          // ── CTA ───────────────────────────────────────────────────────────
          case 'CTA': {
            const label = str(data.label) || 'Browse all'
            const rawHref = str(data.href) || '/products'
            // Relative hrefs are scoped under the store; absolute (http) pass through.
            const href = rawHref.startsWith('http') ? rawHref : `${base}${rawHref.startsWith('/') ? rawHref : `/${rawHref}`}`
            return (
              <section key={c.componentId} style={{ textAlign: 'center', padding: '40px 24px' }}>
                <Link href={href} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>{label}</Link>
              </section>
            )
          }

          // ── SPACER ────────────────────────────────────────────────────────
          case 'SPACER':
            return <div key={c.componentId} style={{ height: num(data.heightPx, 32) }} />

          // ── DIVIDER ───────────────────────────────────────────────────────
          case 'DIVIDER':
            return (
              <div key={c.componentId} style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
                <hr style={{ border: 0, borderTop: '1px solid #00000012', margin: '24px 0' }} />
              </div>
            )

          // Unknown types are skipped gracefully.
          default:
            return null
        }
      })}
    </div>
  )
}
