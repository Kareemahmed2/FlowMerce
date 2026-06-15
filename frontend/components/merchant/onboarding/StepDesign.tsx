'use client'

import type { ThemeColors } from './types'
import { styles } from './wizard-styles'

type Props = {
  colors: ThemeColors
  onChange: (v: ThemeColors) => void
}

const colorFields = [
  { key: 'background' as const, label: 'Background', desc: 'Main page background' },
  { key: 'header' as const, label: 'Header', desc: 'Navigation bar color' },
  { key: 'footer' as const, label: 'Footer', desc: 'Footer section color' },
  { key: 'accent' as const, label: 'Accent', desc: 'Buttons & highlights' },
]

export function StepDesign({ colors, onChange }: Props) {
  return (
    <div style={styles.stepContent}>
      <p style={styles.hint}>
        Pick the color palette for your storefront. The AI will evaluate these next.
      </p>

      <div style={styles.colorGrid}>
        {colorFields.map((f) => (
          <div key={f.key} style={styles.colorCard}>
            <div style={styles.colorPreviewWrap}>
              <div style={{ ...styles.colorSwatch, background: colors[f.key] }} />
              <input
                type="color"
                value={colors[f.key]}
                onChange={(e) => onChange({ ...colors, [f.key]: e.target.value })}
                style={styles.colorInput}
                title={f.label}
              />
            </div>
            <div>
              <p style={styles.colorLabel}>{f.label}</p>
              <p style={styles.colorDesc}>{f.desc}</p>
              <p style={styles.colorHex}>{colors[f.key]}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.previewLabel}>Live Preview</div>
      <div style={{ ...styles.previewStrip, background: colors.background }}>
        <div style={{ ...styles.previewHeader, background: colors.header }}>
          <span style={styles.previewHeaderText}>Your Store</span>
          <div style={{ display: 'flex', gap: 12 }}>
            {['Home', 'Shop', 'About'].map((t) => (
              <span key={t} style={styles.previewNav}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={styles.previewBody}>
          <div style={styles.previewProductCard}>
            <div style={styles.previewProductImg} />
            <p style={styles.previewProductName}>Sample Product</p>
            <p style={styles.previewProductPrice}>250 EGP</p>
            <div style={{ ...styles.previewBtn, background: colors.accent }}>Add to Cart</div>
          </div>
          <div style={styles.previewProductCard}>
            <div style={styles.previewProductImg} />
            <p style={styles.previewProductName}>Sample Product</p>
            <p style={styles.previewProductPrice}>450 EGP</p>
            <div style={{ ...styles.previewBtn, background: colors.accent }}>Add to Cart</div>
          </div>
        </div>
        <div style={{ ...styles.previewFooter, background: colors.footer }}>
          <span style={styles.previewFooterText}>© Your Store 2026</span>
        </div>
      </div>
    </div>
  )
}
