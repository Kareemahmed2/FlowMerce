/**
 * Wallet types — aligned with Spring Boot PaymentManagement / Wallet module.
 * Sources: PaymentDTOs.java (WalletResponse, WalletTransactionResponse),
 *          WalletTransaction.java (TransactionType, ReferenceType),
 *          Wallet.java (OwnerType)
 */

// ── Wallet owner ──────────────────────────────────────────────────────────────

export type WalletOwnerType = 'CUSTOMER' | 'MERCHANT'

// ── Transaction types — matches WalletTransaction.TransactionType exactly ─────

/** CON-9: backend only has CREDIT | DEBIT. */
export type WalletTransactionType = 'CREDIT' | 'DEBIT'

/** CON-9: backend WalletTransaction.ReferenceType. */
export type WalletReferenceType = 'PAYMENT' | 'REFUND' | 'TOPUP' | 'ADJUSTMENT'

// ── Entities ──────────────────────────────────────────────────────────────────

export interface WalletResponse {
  walletId: number
  ownerType: WalletOwnerType
  balance: number
  currency: string
  /** CON-9: backend Wallet entity carries an isActive flag. */
  isActive: boolean
  createdAt: string
}

export interface WalletTransactionResponse {
  transactionId: number
  /** CON-9: no walletId on WalletTransactionResponse DTO — referenceId is an Integer. */
  amount: number
  type: WalletTransactionType
  referenceType: WalletReferenceType | null
  referenceId: number | null
  balanceAfter: number
  description: string | null
  createdAt: string
}

// ── Requests ──────────────────────────────────────────────────────────────────

export interface TopUpRequest {
  amount: number
}

// ── State shape for useWallet hook ────────────────────────────────────────────

export interface WalletState {
  wallet: WalletResponse | null
  transactions: WalletTransactionResponse[]
  isLoading: boolean
  isTopUpLoading: boolean
  error: string
  fetchWallet: () => Promise<void>
  fetchTransactions: () => Promise<void>
  topUp: (amount: number) => Promise<{ ok: boolean; message: string }>
}

// ── Transaction display config ─────────────────────────────────────────────────
// Keyed by WalletTransactionType (CREDIT | DEBIT); extra display details
// can be inferred from referenceType where needed.

export const TRANSACTION_TYPE_CONFIG: Record<WalletTransactionType, { label: string; color: string; sign: '+' | '-' }> = {
  CREDIT: { label: 'Credit', color: '#16a34a', sign: '+' },
  DEBIT:  { label: 'Debit',  color: '#dc2626', sign: '-' },
}

/** Human-readable label for the reference type (topup, payment, etc.) */
export function referenceTypeLabel(ref: WalletReferenceType | null | undefined): string {
  switch (ref) {
    case 'TOPUP':      return 'Top Up'
    case 'PAYMENT':    return 'Payment'
    case 'REFUND':     return 'Refund'
    case 'ADJUSTMENT': return 'Adjustment'
    default:           return '—'
  }
}
