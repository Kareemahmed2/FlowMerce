/**
 * Per-store provider integration types — aligned with the backend
 * IntegrationManagement module (StoreIntegrationController / IntegrationDTOs).
 *
 * Every merchant supplies their OWN Paymob/DHL/Aramex/Bosta credentials here.
 * FlowMerce never holds a shared account — these credentials are stored
 * encrypted per-store and used only for that store's own API calls.
 */

export type IntegrationProvider = 'PAYMOB' | 'DHL' | 'ARAMEX' | 'BOSTA'

export type VerificationStatus = 'UNVERIFIED' | 'SUCCESS' | 'FAILED'

/**
 * Never carries decrypted credential values — only enough to render the
 * dashboard's connected/disconnected state. Editing means resubmitting every
 * field; there is no "view existing secret" path.
 */
export interface IntegrationStatusResponse {
  provider: IntegrationProvider
  enabled: boolean
  configured: boolean
  maskedPreview: string | null
  lastVerifiedAt: string | null
  lastVerifiedStatus: VerificationStatus | null
}

/** PUT /stores/{storeId}/integrations/{provider} */
export interface SaveCredentialsRequest {
  credentials: Record<string, string>
}

/** PUT /stores/{storeId}/integrations/{provider}/enabled */
export interface SetEnabledRequest {
  enabled: boolean
}

/** POST /stores/{storeId}/integrations/{provider}/test */
export interface TestConnectionResponse {
  success: boolean
  message: string
}

/** The credential fields a merchant must fill in per provider — mirrors the
 * backend's RequiredCredentialFields registry. */
export const PROVIDER_FIELDS: Record<IntegrationProvider, { key: string; label: string }[]> = {
  PAYMOB: [
    { key: 'apiKey', label: 'API Key' },
    { key: 'integrationIdCard', label: 'Card Integration ID' },
    { key: 'iframeId', label: 'Iframe ID' },
    { key: 'hmacSecret', label: 'HMAC Secret' },
  ],
  BOSTA: [
    { key: 'apiKey', label: 'API Key' },
  ],
  ARAMEX: [
    { key: 'accountCountryCode', label: 'Account Country Code' },
    { key: 'accountEntity', label: 'Account Entity' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'accountPin', label: 'Account PIN' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password' },
  ],
  DHL: [
    { key: 'apiKey', label: 'API Key' },
    { key: 'apiSecret', label: 'API Secret' },
    { key: 'accountNumber', label: 'Account Number' },
  ],
}

export const PROVIDER_LABELS: Record<IntegrationProvider, { name: string; description: string }> = {
  PAYMOB: { name: 'Paymob', description: 'Egyptian cards, wallets, and online payments.' },
  DHL: { name: 'DHL Express', description: 'International courier and rate calculation.' },
  ARAMEX: { name: 'Aramex', description: 'Regional courier — Egypt and the wider Middle East.' },
  BOSTA: { name: 'Bosta', description: 'Local Egyptian courier — Cairo, Alexandria, and nationwide.' },
}
