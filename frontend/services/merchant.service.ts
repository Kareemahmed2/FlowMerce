/**
 * Merchant service — wraps /merchants/me endpoints.
 *
 * Backend endpoints (auth: MERCHANT):
 *   POST   /merchants/me    → createProfile()
 *   GET    /merchants/me    → getMyProfile()
 *   DELETE /merchants/me    → deleteMyAccount()
 *
 * All methods return ApiResult<T>, never throw.
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'

export interface MerchantRequest {
  businessName: string
}

export interface MerchantResponse {
  merchantId: number
  userId: number
  businessName: string
  isVerified: boolean
  email: string
  fullName: string
}

export const merchantService = {
  async createProfile(
    request: MerchantRequest,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<MerchantResponse>> {
    return httpClient.post<MerchantResponse>('/merchants/me', request, authHeaders)
  },

  async getMyProfile(authHeaders?: Record<string, string>): Promise<ApiResult<MerchantResponse>> {
    return httpClient.get<MerchantResponse>('/merchants/me', authHeaders)
  },

  async deleteMyAccount(authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>('/merchants/me', authHeaders)
  },
}
