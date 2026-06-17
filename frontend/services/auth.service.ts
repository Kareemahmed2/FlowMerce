/**
 * Auth service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   POST /auth/merchant/register       → registerMerchant()
 *   POST /auth/merchant/login          → loginMerchant()
 *   GET  /auth/merchant/activate       → activateMerchant()
 *   POST /auth/merchant/forgot-password→ forgotPasswordMerchant()
 *   POST /auth/merchant/reset-password → resetPasswordMerchant()
 *   POST /auth/merchant/logout         → logoutMerchant()
 *   POST /auth/merchant/refresh        → refreshMerchantToken()
 *   POST /auth/customer/register       → registerCustomer()
 *   POST /auth/customer/login          → loginCustomer()
 *   GET  /auth/customer/activate       → activateCustomer()
 *   POST /auth/customer/forgot-password→ forgotPasswordCustomer()
 *   POST /auth/customer/reset-password → resetPasswordCustomer()
 *   POST /auth/customer/logout         → logoutCustomer()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  AuthResponse,
  CustomerRegisterRequest,
  ForgotPasswordRequest,
  LoginRequest,
  MerchantRegisterRequest,
  ResetPasswordRequest,
  UserResponse,
} from '@/types/auth.types'

// ── Merchant ──────────────────────────────────────────────────────────────────

export const authService = {
  async registerMerchant(payload: MerchantRegisterRequest): Promise<ApiResult<{ message: string }>> {
    return httpClient.post<{ message: string }>('/auth/merchant/register', payload)
  },

  async loginMerchant(payload: LoginRequest): Promise<ApiResult<AuthResponse>> {
    return httpClient.post<AuthResponse>('/auth/merchant/login', payload)
  },

  async activateMerchant(token: string): Promise<ApiResult<{ message: string }>> {
    return httpClient.get<{ message: string }>(`/auth/merchant/activate?token=${encodeURIComponent(token)}`)
  },

  async forgotPasswordMerchant(payload: ForgotPasswordRequest): Promise<ApiResult<{ message: string }>> {
    return httpClient.post<{ message: string }>('/auth/merchant/forgot-password', payload)
  },

  async resetPasswordMerchant(payload: ResetPasswordRequest): Promise<ApiResult<{ message: string }>> {
    return httpClient.post<{ message: string }>('/auth/merchant/reset-password', payload)
  },

  async logoutMerchant(accessToken: string): Promise<ApiResult<void>> {
    return httpClient.post<void>('/auth/merchant/logout', undefined, {
      Authorization: `Bearer ${accessToken}`,
    })
  },

  async refreshMerchantToken(refreshToken: string): Promise<ApiResult<AuthResponse>> {
    return httpClient.post<AuthResponse>('/auth/merchant/refresh', { refreshToken })
  },

  async getMerchantMe(authHeaders?: Record<string, string>): Promise<ApiResult<UserResponse>> {
    return httpClient.get<UserResponse>('/auth/merchant/me', authHeaders)
  },

  // ── Customer ──────────────────────────────────────────────────────────────

  async registerCustomer(payload: CustomerRegisterRequest): Promise<ApiResult<{ message: string }>> {
    return httpClient.post<{ message: string }>('/auth/customer/register', payload)
  },

  async loginCustomer(payload: LoginRequest): Promise<ApiResult<AuthResponse>> {
    return httpClient.post<AuthResponse>('/auth/customer/login', payload)
  },

  async activateCustomer(token: string): Promise<ApiResult<{ message: string }>> {
    // 35 s gives Supabase cold-start (up to ~30 s after project resume) time to respond.
    return httpClient.get<{ message: string }>(`/auth/customer/activate?token=${encodeURIComponent(token)}`, undefined, 35_000)
  },

  async forgotPasswordCustomer(payload: ForgotPasswordRequest): Promise<ApiResult<{ message: string }>> {
    return httpClient.post<{ message: string }>('/auth/customer/forgot-password', payload)
  },

  async resetPasswordCustomer(payload: ResetPasswordRequest): Promise<ApiResult<{ message: string }>> {
    return httpClient.post<{ message: string }>('/auth/customer/reset-password', payload)
  },

  async logoutCustomer(accessToken: string): Promise<ApiResult<void>> {
    return httpClient.post<void>('/auth/customer/logout', undefined, {
      Authorization: `Bearer ${accessToken}`,
    })
  },

  async refreshCustomerToken(refreshToken: string): Promise<ApiResult<AuthResponse>> {
    return httpClient.post<AuthResponse>('/auth/customer/refresh', { refreshToken })
  },

  async getCustomerMe(authHeaders?: Record<string, string>): Promise<ApiResult<UserResponse>> {
    return httpClient.get<UserResponse>('/auth/customer/me', authHeaders)
  },

  async deleteCustomerAccount(authHeaders?: Record<string, string>): Promise<ApiResult<{ message: string }>> {
    return httpClient.delete<{ message: string }>('/auth/customer/me', authHeaders)
  },
}
