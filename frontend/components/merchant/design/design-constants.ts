import type { StorefrontColors } from '@/components/merchant/onboarding/types'

export const COLOR_FIELDS = [
  {
    key: 'background' as const,
    label: 'Background',
    desc: 'Main page background',
    section: 'page' as const,
  },
  {
    key: 'header' as const,
    label: 'Header',
    desc: 'Navigation bar',
    section: 'page' as const,
  },
  {
    key: 'footer' as const,
    label: 'Footer',
    desc: 'Footer section',
    section: 'page' as const,
  },
  {
    key: 'accent' as const,
    label: 'Accent / CTA',
    desc: 'Buttons & highlights',
    section: 'brand' as const,
  },
  {
    key: 'text' as const,
    label: 'Body Text',
    desc: 'Main content text color',
    section: 'brand' as const,
  },
  {
    key: 'card' as const,
    label: 'Product Card',
    desc: 'Product card background',
    section: 'brand' as const,
  },
]

export const PRESET_THEMES: { name: string; colors: StorefrontColors }[] = [
  {
    name: 'Midnight Luxe',
    colors: {
      background: '#0D0D0D',
      header: '#1A1A1A',
      footer: '#111111',
      accent: '#C9A84C',
      text: '#F0EDE8',
      card: '#1E1E1E',
    },
  },
  {
    name: 'Ivory & Rose',
    colors: {
      background: '#FDF8F4',
      header: '#FFFFFF',
      footer: '#F5EFE8',
      accent: '#C97D7D',
      text: '#2C2C2C',
      card: '#FFFFFF',
    },
  },
  {
    name: 'Ocean Depth',
    colors: {
      background: '#F0F6FF',
      header: '#1B3A6B',
      footer: '#162E57',
      accent: '#3D8EFF',
      text: '#1A2B42',
      card: '#FFFFFF',
    },
  },
  {
    name: 'Forest Calm',
    colors: {
      background: '#F2F7F2',
      header: '#2D4A2D',
      footer: '#243D24',
      accent: '#5A9A5A',
      text: '#1E321E',
      card: '#FFFFFF',
    },
  },
  {
    name: 'Desert Sand',
    colors: {
      background: '#FBF6EE',
      header: '#6B4E2A',
      footer: '#5A4022',
      accent: '#C4873B',
      text: '#2C1E0F',
      card: '#FFFFFF',
    },
  },
  {
    name: 'Monochrome',
    colors: {
      background: '#F7F7F7',
      header: '#111111',
      footer: '#222222',
      accent: '#555555',
      text: '#111111',
      card: '#FFFFFF',
    },
  },
]

export const PREVIEW_PAGES = ['Home', 'Product', 'Cart'] as const
export type PreviewPage = (typeof PREVIEW_PAGES)[number]

export const DEFAULT_PREVIEW_PRODUCTS: {
  name: string
  price: string
  tag: string | null
}[] = [
  { name: 'Gold Ring Set', price: '850 EGP', tag: 'Bestseller' },
  { name: 'Diamond Earrings', price: '1,200 EGP', tag: 'New' },
  { name: 'Pearl Necklace', price: '640 EGP', tag: null },
]
