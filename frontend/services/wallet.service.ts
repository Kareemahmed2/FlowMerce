/**
 * Wallet service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   GET    /wallets/me                                 → getMyWallet()
 *   POST   /wallets/me/topup                           → topUpWallet()
 *   GET    /wallets/me/transactions                    → getMyTransactions()
 *   GET    /wallets/store/{storeId}                    → getStoreWallet()
 *   GET    /wallets/store/{storeId}/transactions       → getStoreTransactions()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  TopUpRequest,
  WalletResponse,
  WalletTransactionResponse,
} from '@/types/wallet.types'

export const walletService = {
  async getMyWallet(authHeaders?: Record<string, string>): Promise<ApiResult<WalletResponse>> {
    return httpClient.get<WalletResponse>('/wallets/me', authHeaders)
  },

  async topUpWallet(request: TopUpRequest, authHeaders?: Record<string, string>): Promise<ApiResult<WalletResponse>> {
    return httpClient.post<WalletResponse>('/wallets/me/topup', request, authHeaders)
  },

  async getMyTransactions(authHeaders?: Record<string, string>): Promise<ApiResult<WalletTransactionResponse[]>> {
    return httpClient.get<WalletTransactionResponse[]>('/wallets/me/transactions', authHeaders)
  },

  async getStoreWallet(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<WalletResponse>> {
    return httpClient.get<WalletResponse>(`/wallets/store/${storeId}`, authHeaders)
  },

  async getStoreTransactions(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<WalletTransactionResponse[]>> {
    return httpClient.get<WalletTransactionResponse[]>(`/wallets/store/${storeId}/transactions`, authHeaders)
  },
}
