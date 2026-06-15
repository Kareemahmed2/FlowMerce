'use client'

import type { StorefrontColors } from '@/components/merchant/onboarding/types'
import { hexToRgb, luminance } from '@/lib/design/color-utils'
import type { PreviewPage } from './design-constants'
import { DEFAULT_PREVIEW_PRODUCTS } from './design-constants'

export type PreviewProduct = {
  name: string
  price: string
  tag: string | null
}

type Props = {
  colors: StorefrontColors
  activePage: PreviewPage
  storeName: string
  categories: string[]
  products: PreviewProduct[]
}

function parseEgp(price: string): number {
  const digits = price.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

function formatEgp(n: number): string {
  return n.toLocaleString('en-EG')
}

export function StorePreview({
  colors,
  activePage,
  storeName,
  categories,
  products,
}: Props) {
  const bgLum = luminance(hexToRgb(colors.background))
  const headerLum = luminance(hexToRgb(colors.header))
  const list = products.length ? products : DEFAULT_PREVIEW_PRODUCTS
  const p0 = list[0] ?? DEFAULT_PREVIEW_PRODUCTS[0]
  const cartLines =
    list.length >= 2
      ? [list[0], list[1]]
      : list.length === 1
        ? [list[0]]
        : DEFAULT_PREVIEW_PRODUCTS.slice(0, 2)
  const cartTotal = cartLines.reduce((s, p) => s + parseEgp(p.price), 0)
  const year = new Date().getFullYear()

  const navTextColor =
    colors.text === '#111111' || headerLum < 0.2 ? '#FFFFFFBB' : colors.text

  const cardBorder =
    colors.background === '#FFFFFF' || bgLum > 0.8
      ? '#E8E4DE'
      : 'rgba(255,255,255,0.08)'

  const subtleBorder =
    bgLum > 0.8 ? '#E8E4DE' : 'rgba(255,255,255,0.06)'

  const cartDivider = bgLum > 0.8 ? '#E8E4DE' : 'rgba(255,255,255,0.1)'

  if (activePage === 'Home') {
    return (
      <div style={{ background: colors.background, minHeight: 420, fontFamily: 'inherit' }}>
        <div
          style={{
            background: colors.header,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              color: colors.accent,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '0.05em',
            }}
          >
            {storeName}
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            {categories.map((c) => (
              <span key={c} style={{ color: navTextColor, fontSize: 11 }}>
                {c}
              </span>
            ))}
          </div>
          <div
            style={{
              background: colors.accent,
              color: '#FFFFFF',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Cart (0)
          </div>
        </div>
        <div style={{ padding: '28px 20px 20px', textAlign: 'center' }}>
          <p
            style={{
              color: colors.text,
              fontSize: 22,
              fontWeight: 700,
              margin: '0 0 6px',
              letterSpacing: '-0.01em',
            }}
          >
            Timeless Elegance
          </p>
          <p style={{ color: colors.text, fontSize: 12, opacity: 0.6, margin: '0 0 16px' }}>
            Handcrafted jewelry for every moment
          </p>
          <div
            style={{
              background: colors.accent,
              color: '#FFFFFF',
              display: 'inline-block',
              padding: '9px 22px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Shop Now
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '0 20px 24px' }}>
          {list.slice(0, 3).map((p, i) => (
            <div
              key={`${p.name}-${i}`}
              style={{
                background: colors.card,
                borderRadius: 10,
                overflow: 'hidden',
                border: `1px solid ${cardBorder}`,
              }}
            >
              <div
                style={{
                  height: 80,
                  background: `${colors.accent}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 24 }}>◈</span>
              </div>
              <div style={{ padding: '8px 10px' }}>
                {p.tag && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      background: colors.accent,
                      color: '#FFF',
                      padding: '2px 5px',
                      borderRadius: 3,
                      marginBottom: 4,
                      display: 'inline-block',
                    }}
                  >
                    {p.tag}
                  </span>
                )}
                <p
                  style={{
                    color: colors.text,
                    fontSize: 11,
                    fontWeight: 600,
                    margin: '4px 0 2px',
                    lineHeight: 1.3,
                  }}
                >
                  {p.name}
                </p>
                <p style={{ color: colors.accent, fontSize: 12, fontWeight: 700, margin: 0 }}>{p.price}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: colors.footer, padding: '12px 20px', textAlign: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
            © {year} {storeName} · All rights reserved
          </span>
        </div>
      </div>
    )
  }

  if (activePage === 'Product') {
    return (
      <div style={{ background: colors.background, minHeight: 420 }}>
        <div style={{ background: colors.header, padding: '10px 20px' }}>
          <span style={{ color: colors.accent, fontWeight: 700, fontSize: 14 }}>{storeName}</span>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            style={{
              background: `${colors.accent}18`,
              borderRadius: 10,
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 48, opacity: 0.3 }}>◈</span>
          </div>
          <div>
            <p style={{ color: colors.text, fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>{p0.name}</p>
            <p style={{ color: colors.accent, fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>{p0.price}</p>
            <p
              style={{
                color: colors.text,
                fontSize: 11,
                opacity: 0.6,
                margin: '0 0 16px',
                lineHeight: 1.5,
              }}
            >
              Classic 18k gold ring set. Comes in pairs. Available in sizes 6–10.
            </p>
            <div
              style={{
                background: colors.accent,
                color: '#FFF',
                padding: '10px',
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Add to Cart
            </div>
            <div
              style={{
                background: 'transparent',
                border: `1px solid ${colors.accent}`,
                color: colors.accent,
                padding: '10px',
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              Add to Wishlist
            </div>
          </div>
        </div>
        <div style={{ background: colors.footer, padding: '10px 20px', textAlign: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
            © {year} {storeName}
          </span>
        </div>
      </div>
    )
  }

  if (activePage === 'Cart') {
    return (
      <div style={{ background: colors.background, minHeight: 420 }}>
        <div style={{ background: colors.header, padding: '10px 20px' }}>
          <span style={{ color: colors.accent, fontWeight: 700, fontSize: 14 }}>{storeName}</span>
        </div>
        <div style={{ padding: '20px' }}>
          <p style={{ color: colors.text, fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>
            Your Cart ({cartLines.length} {cartLines.length === 1 ? 'item' : 'items'})
          </p>
          {cartLines.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px',
                background: colors.card,
                borderRadius: 8,
                marginBottom: 8,
                border: `1px solid ${subtleBorder}`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: `${colors.accent}22`,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 16 }}>◈</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: colors.text, fontSize: 12, fontWeight: 600, margin: 0 }}>{item.name}</p>
                <p style={{ color: colors.accent, fontSize: 12, fontWeight: 700, margin: 0 }}>{item.price}</p>
              </div>
              <span style={{ color: colors.text, opacity: 0.3, fontSize: 14, cursor: 'pointer' }}>×</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${cartDivider}`, paddingTop: 12, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>Total</span>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: 14 }}>
                {formatEgp(cartTotal)} EGP
              </span>
            </div>
            <div
              style={{
                background: colors.accent,
                color: '#FFF',
                padding: '10px',
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Checkout
            </div>
          </div>
        </div>
        <div style={{ background: colors.footer, padding: '10px 20px', textAlign: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
            © {year} {storeName}
          </span>
        </div>
      </div>
    )
  }

  return null
}
