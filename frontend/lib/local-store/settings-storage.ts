/**
 * Merchant settings — `flowmerce_settings_v1`.
 * Migrates legacy flat payment/shipping/notification shapes when detected.
 * Syncs brand + storeUrl to `flowmerce_store_v1` on save.
 */

import { STORAGE_KEY_ORDERS } from '@/lib/local-store/orders'
import { STORAGE_KEY_STORE } from '@/lib/local-store/store'
import type {
  MerchantSettingsState,
  PersistedMerchantSettings,
} from '@/lib/local-store/settings-types'
import {
  createDefaultPersistedStore,
  loadPersistedStore,
  patchPersistedStore,
  savePersistedStore,
  type PersistedStorePayload,
} from '@/lib/local-store/store'

export const STORAGE_KEY_SETTINGS = 'flowmerce_settings_v1'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mergeDeep<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out = { ...base }
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const pv = patch[key]
    const bv = base[key]
    if (pv === undefined) continue
    if (isPlainObject(bv) && isPlainObject(pv as object)) {
      out[key] = mergeDeep(bv as Record<string, unknown>, pv as Record<string, unknown>) as T[keyof T]
    } else {
      out[key] = pv as T[keyof T]
    }
  }
  return out
}

function slugFromStoreUrl(storeUrl: string | undefined): string {
  if (!storeUrl) return ''
  return storeUrl
    .replace(/^https?:\/\//i, '')
    .replace(/\.flowmerce\.io.*$/i, '')
    .replace(/\/.*$/, '')
    .trim()
}

export function buildDefaultsFromStore(store: PersistedStorePayload | null): MerchantSettingsState {
  const urlSlug = slugFromStoreUrl(store?.storeUrl)
  return {
    store: {
      name: store?.brand.name ?? '',
      url: urlSlug,
      description: '',
      email: '',
      phone: '',
      address: '',
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      language: 'en',
      logo: store?.brand.logoPreview ?? null,
    },
    shipping: {
      freeThreshold: '500',
      defaultCost: '50',
      aramex: false,
      bosta: true,
      dhl: false,
    },
    notifications: {
      orderPlaced: true,
      orderShipped: true,
      orderDelivered: true,
      lowStock: true,
      newReview: false,
      aiSuggestions: true,
      emailDigest: 'daily',
    },
    tax: {
      enabled: true,
      rate: '14',
      inclusive: false,
      vatNumber: '',
    },
  }
}

export function loadMerchantSettings(): MerchantSettingsState {
  const store = loadPersistedStore()
  const defaults = buildDefaultsFromStore(store)
  if (typeof window === 'undefined') return defaults

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return mergeDeep(defaults as unknown as Record<string, unknown>, parsed as Record<string, unknown>) as MerchantSettingsState
  } catch {
    return defaults
  }
}

function storeUrlFromSlug(slug: string): string {
  const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
  return s ? `${s}.flowmerce.tech` : ''
}

export function saveMerchantSettings(state: MerchantSettingsState): void {
  if (typeof window === 'undefined') return
  const persistable: PersistedMerchantSettings = state
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(persistable))
  patchPersistedStore({
    brand: {
      name: state.store.name,
      logoPreview: state.store.logo,
    },
    storeUrl: storeUrlFromSlug(state.store.url),
  })
  window.dispatchEvent(new Event('flowmerce-settings-updated'))
}

export function exportAllLocalData(): void {
  if (typeof window === 'undefined') return
  const payload = {
    exportedAt: new Date().toISOString(),
    store: localStorage.getItem(STORAGE_KEY_STORE),
    orders: localStorage.getItem(STORAGE_KEY_ORDERS),
    settings: localStorage.getItem(STORAGE_KEY_SETTINGS),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flowmerce-export-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function clearAllLocalMerchantData(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY_SETTINGS)
  localStorage.removeItem(STORAGE_KEY_ORDERS)
  savePersistedStore(createDefaultPersistedStore())
  window.dispatchEvent(new Event('flowmerce-store-updated'))
  window.dispatchEvent(new Event('flowmerce-orders-updated'))
  window.dispatchEvent(new Event('flowmerce-settings-updated'))
}
