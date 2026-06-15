/**
 * Store Management types — aligned with Spring Boot StoreMangement module.
 * Keep in sync with: StoreDTOs.java, StoreSettingsDTOs.java, CatalogDTOs.java,
 *                    StorefrontDTOs.java
 *
 * TODO(BACKEND-INTEGRATION): Validate all field names against actual JSON responses.
 *
 * Design notes:
 *  - StoreStatus is the canonical definition here; admin.types.ts re-exports it.
 *  - StoreColors mirrors the design token structure used by StoreProvider.
 *  - StorefrontPublicData is what the storefront pages consume from the backend.
 */

import type { FrontendPaymentMethod } from '@/types/payment.types'

// ── Store status ───────────────────────────────────────────────────────────────

/** Backend enum: DRAFT → setup in progress, PUBLISHED → live, PAUSED → visible but
 *  not accepting orders, DEACTIVATED → removed from public */
export type StoreStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'DEACTIVATED'

// ── Theme colors ───────────────────────────────────────────────────────────────

/** Design tokens for a storefront — returned by GET /public/storefront/{storeId}
 *  and saved via PUT /stores/{storeId}/storefront/design */
export interface StoreColors {
  background: string
  header: string
  footer: string
  accent: string
  text: string
  card: string
}

// ── Brand ──────────────────────────────────────────────────────────────────────

export interface StoreBrand {
  brandName: string
  logoUrl: string | null
  /** Transient — base64 preview before upload. Not persisted. */
  logoPreview?: string | null
}

// ── Store entity ───────────────────────────────────────────────────────────────

/** Returned by GET /stores/{storeId}, GET /stores/slug/{slug}, GET /stores/me */
export interface StoreResponse {
  storeId: number
  storeName: string
  /** URL-slug — e.g. "cairo-boutique". Used in /store/{slug}/ routes. */
  storeUrl: string
  description: string | null
  status: StoreStatus
  merchantId: number
  brandName: string
  logoUrl: string | null
  /** Active payment methods configured by the merchant */
  paymentMethods: FrontendPaymentMethod[]
  /** Onboarding step tracker (0-based) */
  currentStep: number
  createdAt: string
}

// ── Store settings ─────────────────────────────────────────────────────────────

/** Returned by GET /stores/{storeId}/settings */
export interface StoreSettingsResponse {
  currency: string           // e.g. "EGP"
  timezone: string           // e.g. "Africa/Cairo"
  language: string           // e.g. "ar"
  storeName: string | null
  contactEmail: string | null
  supportPhone: string | null
}

// ── Storefront public data ─────────────────────────────────────────────────────

/** Returned by GET /public/storefront/{storeId} — everything a storefront page needs */
export interface StorefrontPublicData {
  storeId: number
  storeName: string
  storeUrl: string
  status: StoreStatus
  brandName: string
  logoUrl: string | null
  colors: StoreColors
  paymentMethods: FrontendPaymentMethod[]
  /** FEAT-RENDER: published page tree (components) built in the design studio.
   *  When present and non-empty, the storefront renders these instead of the
   *  default hard-coded home layout. */
  pages?: import('@/types/storefront.types').PageSummary[]
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

/** POST /stores */
export interface CreateStoreRequest {
  storeName: string
  storeUrl: string
  description?: string
}

/** PUT /stores/{storeId} */
export interface UpdateStoreRequest {
  storeName?: string
  description?: string
  storeUrl?: string
}

/** PUT /stores/{storeId}/brand */
export interface BrandUpdateRequest {
  brandName: string
  logoUrl: string | null
}

/** PUT /stores/{storeId}/payment-methods */
export interface PaymentMethodsRequest {
  methods: FrontendPaymentMethod[]
}

/** PUT /stores/{storeId}/onboarding-step */
export interface OnboardingStepRequest {
  step: number
}

/** PUT /stores/{storeId}/settings */
export interface UpdateSettingsRequest {
  currency?: string
  timezone?: string
  language?: string
  storeName?: string
  contactEmail?: string
  supportPhone?: string
}

// ── Storefront customization DTOs ──────────────────────────────────────────────

/** POST /stores/{storeId}/storefront/init */
export interface CreateStorefrontRequest {
  background?: string
  accent?: string
}

/** PUT /stores/{storeId}/storefront/design */
export interface UpdateDesignRequest {
  background?: string
  header?: string
  footer?: string
  accent?: string
  text?: string
  card?: string
}

/** PUT /stores/{storeId}/storefront/colors */
export interface UpdateThemeRequest {
  background?: string
  accent?: string
}

// ── Display config ─────────────────────────────────────────────────────────────

export const STORE_STATUS_CONFIG: Record<StoreStatus, { label: string; bg: string; color: string; border: string }> = {
  DRAFT:       { label: 'Draft',       bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  PUBLISHED:   { label: 'Published',   bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  PAUSED:      { label: 'Paused',      bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  DEACTIVATED: { label: 'Deactivated', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
}

// ── useStore hook return shape ─────────────────────────────────────────────────

export interface UseStoreDataReturn {
  /** Numeric backend ID — needed for all /stores/{storeId}/* API calls */
  storeId: number | null
  storefront: StorefrontPublicData | null
  isLoading: boolean
  error: string
  /** Manually re-fetch storefront data. Pass force=true to bypass the session cache. */
  refresh: (force?: boolean) => Promise<void>
}
