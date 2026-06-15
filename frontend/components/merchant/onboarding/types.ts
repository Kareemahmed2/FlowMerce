import type { CSSProperties } from 'react'

export type WizardStyles = Record<string, CSSProperties>

export type BrandData = {
  name: string
  logo: File | null
  logoPreview: string | null
}

export type CatalogProduct = {
  id: number
  name: string
  price: string
  description: string
  images: string[]
  /** Set from dashboard / products; onboarding defaults */
  stock?: number
  sales?: number
  status?: 'active' | 'inactive'
  /** INT-36: star rating from backend ProductResponse.rating (null = no reviews yet). */
  rating?: number | null
}

export type CatalogCategory = {
  id: number
  name: string
  products: CatalogProduct[]
}

export type ThemeColors = {
  background: string
  header: string
  footer: string
  accent: string
  /** Body text on storefront (optional for older saved stores) */
  text?: string
  /** Product card surface (optional for older saved stores) */
  card?: string
}

/** Full palette for storefront / design studio */
export type StorefrontColors = Required<ThemeColors>

export const DEFAULT_STOREFRONT_COLORS: StorefrontColors = {
  background: '#FFFFFF',
  header: '#1A1A2E',
  footer: '#16213E',
  accent: '#E94560',
  text: '#1A1A1A',
  card: '#F9F9F9',
}

export function normalizeStorefrontColors(c: ThemeColors): StorefrontColors {
  return {
    background: c.background,
    header: c.header,
    footer: c.footer,
    accent: c.accent,
    text: c.text ?? DEFAULT_STOREFRONT_COLORS.text,
    card: c.card ?? DEFAULT_STOREFRONT_COLORS.card,
  }
}

export type OnboardingState = {
  brand: BrandData
  categories: CatalogCategory[]
  colors: ThemeColors
  aiSuggestions: string | null
  published: boolean
  storeUrl: string
}
