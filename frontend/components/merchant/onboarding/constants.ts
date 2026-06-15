import type { OnboardingState } from './types'
import { DEFAULT_STOREFRONT_COLORS } from './types'

export const STEPS = [
  { id: 'brand',   label: 'Brand',    icon: '◈' },
  { id: 'catalog', label: 'Catalog',  icon: '⊞' },
  { id: 'design',  label: 'Design',   icon: '◑' },
  { id: 'ai',      label: 'AI Check', icon: '✦' },
  { id: 'publish', label: 'Publish',  icon: '▷' },
] as const

const defaultColors = DEFAULT_STOREFRONT_COLORS

export const INITIAL_STATE: OnboardingState = {
  brand: { name: '', logo: null, logoPreview: null },
  categories: [],
  colors: defaultColors,
  aiSuggestions: null,
  published: false,
  storeUrl: '',
}

// ── Arabic → Latin transliteration map ────────────────────────────────────────
const AR: Record<string, string> = {
  'ا': 'a',  'أ': 'a',  'إ': 'i',  'آ': 'aa', 'ء': 'a',  'ئ': 'y',  'ؤ': 'w',
  'ب': 'b',  'ت': 't',  'ث': 'th', 'ج': 'j',  'ح': 'h',  'خ': 'kh',
  'د': 'd',  'ذ': 'dh', 'ر': 'r',  'ز': 'z',  'س': 's',  'ش': 'sh',
  'ص': 's',  'ض': 'd',  'ط': 't',  'ظ': 'z',  'ع': 'a',  'غ': 'gh',
  'ف': 'f',  'ق': 'q',  'ك': 'k',  'ل': 'l',  'م': 'm',  'ن': 'n',
  'ه': 'h',  'و': 'w',  'ي': 'y',  'ى': 'a',  'ة': 'a',
  // diacritics (tashkeel) — just strip them
  'ً': '', 'ٌ': '', 'ٍ': '', 'َ': '',
  'ُ': '', 'ِ': '', 'ّ': '', 'ْ': '',
}

function transliterate(text: string): string {
  return text.split('').map((ch) => AR[ch] ?? ch).join('')
}

export function generateStoreUrl(name: string): string {
  const slug = transliterate(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || ('store-' + Date.now().toString(36).slice(-5))
}
