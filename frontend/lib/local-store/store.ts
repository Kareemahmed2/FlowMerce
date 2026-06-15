import { INITIAL_STATE } from '@/components/merchant/onboarding/constants'
import type { CatalogCategory, OnboardingState, ThemeColors } from '@/components/merchant/onboarding/types'

export const STORAGE_KEY_STORE = 'flowmerce_store_v1'

export type PersistedBrand = {
  name: string
  logoPreview: string | null
}

export type PersistedStorePayload = {
  version: 1
  brand: PersistedBrand
  categories: CatalogCategory[]
  colors: ThemeColors
  aiSuggestions: string | null
  published: boolean
  storeUrl: string
  currentStep: number
  /** Until backend: shown in sidebar */
  planLabel: string
}

export function loadPersistedStore(): PersistedStorePayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedStorePayload
    if (!parsed || parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

/** Strip data: URLs (base64 images) before persisting — they blow the 5 MB localStorage quota.
 *  Real https:// URLs are kept as-is. The in-memory state still holds the full data: URL
 *  so the UI keeps showing the image; only the persisted copy is trimmed.
 */
function stripDataUrls(payload: PersistedStorePayload): PersistedStorePayload {
  return {
    ...payload,
    // Strip logo data: URL
    brand: {
      ...payload.brand,
      logoPreview:
        payload.brand.logoPreview?.startsWith('data:')
          ? null
          : payload.brand.logoPreview,
    },
    // Strip product image data: URLs — keep only real https:// ones
    categories: payload.categories.map((cat) => ({
      ...cat,
      products: cat.products.map((p) => ({
        ...p,
        images: p.images.filter((img) => !img.startsWith('data:')),
      })),
    })),
  }
}

export function savePersistedStore(payload: PersistedStorePayload): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(stripDataUrls(payload)))
    window.dispatchEvent(new Event('flowmerce-store-updated'))
  } catch (e) {
    // If quota is still exceeded (e.g. too many real-URL products), clear and retry once
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try {
        localStorage.removeItem(STORAGE_KEY_STORE)
        localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(stripDataUrls(payload)))
        window.dispatchEvent(new Event('flowmerce-store-updated'))
      } catch {
        console.warn('[FlowMerce] localStorage quota exceeded even after cleanup — store not persisted.')
      }
    }
  }
}

export function onboardingToPayload(
  data: OnboardingState,
  currentStep: number,
  published: boolean,
  planLabel: string = 'Local'
): PersistedStorePayload {
  return {
    version: 1,
    brand: {
      name: data.brand.name,
      logoPreview: data.brand.logoPreview,
    },
    categories: data.categories,
    colors: data.colors,
    aiSuggestions: data.aiSuggestions,
    published,
    storeUrl: data.storeUrl,
    currentStep,
    planLabel,
  }
}

export function payloadToOnboarding(payload: PersistedStorePayload): OnboardingState {
  return {
    brand: {
      name: payload.brand.name,
      logo: null,
      logoPreview: payload.brand.logoPreview,
    },
    categories: payload.categories,
    colors: payload.colors,
    aiSuggestions: payload.aiSuggestions,
    published: payload.published,
    storeUrl: payload.storeUrl,
  }
}

export function createDefaultPersistedStore(): PersistedStorePayload {
  return {
    version: 1,
    brand: { name: INITIAL_STATE.brand.name, logoPreview: INITIAL_STATE.brand.logoPreview },
    categories: [],
    colors: INITIAL_STATE.colors,
    aiSuggestions: null,
    published: false,
    storeUrl: '',
    currentStep: 0,
    planLabel: 'Local',
  }
}

export function patchPersistedStore(
  partial: Partial<Omit<PersistedStorePayload, 'version'>>
): void {
  const cur = loadPersistedStore()
  const base = cur ?? createDefaultPersistedStore()
  savePersistedStore({ ...base, ...partial, version: 1 })
}
