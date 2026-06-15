'use client'

import type { BrandData, CatalogCategory, ThemeColors } from './types'
import { generateStoreUrl } from './constants'
import { styles } from './wizard-styles'

type Props = {
  brandData: BrandData
  categories: CatalogCategory[]
  colors: ThemeColors
}

export function StepPublish({ brandData, categories, colors }: Props) {
  const url = generateStoreUrl(brandData.name || 'my-store')
  const totalProducts = categories.reduce((sum, c) => sum + c.products.length, 0)

  return (
    <div style={styles.stepContent}>
      <div style={styles.publishSummary}>
        <div style={styles.summarySection}>
          <p style={styles.summaryTitle}>Ready to launch</p>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryNum}>{categories.length}</span>
              <span style={styles.summaryLabel}>Categories</span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryNum}>{totalProducts}</span>
              <span style={styles.summaryLabel}>Products</span>
            </div>
          </div>
        </div>

        <div style={styles.urlPreview}>
          <p style={styles.summaryLabel}>Your store URL will be</p>
          <p style={styles.urlText}>https://{url}</p>
        </div>

        <div style={styles.colorPreviewRow}>
          {Object.entries(colors).map(([key, val]) => (
            <div key={key} style={styles.colorPreviewItem}>
              <div style={{ ...styles.colorDot, background: val, width: 24, height: 24 }} />
              <span style={styles.colorPreviewKey}>{key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
