/** Merchant settings — persisted in `flowmerce_settings_v1` (v2 shape). */

export type StoreSettingsSlice = {
  name: string
  /** URL slug (e.g. luma-jewelry) — synced to `storeUrl` as `{slug}.flowmerce.io` */
  url: string
  description: string
  email: string
  phone: string
  address: string
  currency: string
  timezone: string
  /** `en` | `ar` */
  language: string
  /** Data URL or remote URL */
  logo: string | null
}

export type ShippingSettingsSlice = {
  freeThreshold: string
  defaultCost: string
  aramex: boolean
  bosta: boolean
  dhl: boolean
}

export type NotificationsSettingsSlice = {
  orderPlaced: boolean
  orderShipped: boolean
  orderDelivered: boolean
  lowStock: boolean
  newReview: boolean
  aiSuggestions: boolean
  emailDigest: 'daily' | 'weekly' | 'never'
}

export type TaxSettingsSlice = {
  enabled: boolean
  rate: string
  inclusive: boolean
  vatNumber: string
}

export type SecuritySettingsSlice = {
  twoFactor: boolean
}

export type MerchantSettingsState = {
  store: StoreSettingsSlice
  shipping: ShippingSettingsSlice
  notifications: NotificationsSettingsSlice
  tax: TaxSettingsSlice
  security: SecuritySettingsSlice
}

export type PersistedMerchantSettings = MerchantSettingsState
