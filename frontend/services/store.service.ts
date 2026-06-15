/**
 * Store management service — all methods return ApiResult<T>.
 *
 * Backend endpoints:
 *   GET    /stores/slug/{slug}                        → getStoreBySlug()
 *   GET    /stores/me                                 → getMyStores()
 *   POST   /stores                                    → createStore()
 *   GET    /stores/{storeId}                          → getStoreById()
 *   PUT    /stores/{storeId}                          → updateStore()
 *   PUT    /stores/{storeId}/brand                    → updateBrand()
 *   PUT    /stores/{storeId}/payment-methods          → updatePaymentMethods()
 *   PUT    /stores/{storeId}/onboarding-step          → updateOnboardingStep()
 *   POST   /stores/{storeId}/publish                  → publishStore()
 *   POST   /stores/{storeId}/unpublish                → unpublishStore()
 *   DELETE /stores/{storeId}                          → deleteStore()
 *   GET    /stores/{storeId}/settings                 → getSettings()
 *   PUT    /stores/{storeId}/settings                 → updateSettings()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  BrandUpdateRequest,
  CreateStoreRequest,
  OnboardingStepRequest,
  PaymentMethodsRequest,
  StoreResponse,
  StoreSettingsResponse,
  UpdateSettingsRequest,
  UpdateStoreRequest,
} from '@/types/store.types'

export const storeService = {
  async getStoreBySlug(slug: string): Promise<ApiResult<StoreResponse>> {
    return httpClient.get<StoreResponse>(`/stores/slug/${slug}`)
  },

  async getMyStores(authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse[]>> {
    return httpClient.get<StoreResponse[]>('/stores/me', authHeaders)
  },

  async getStoreById(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.get<StoreResponse>(`/stores/${storeId}`, authHeaders)
  },

  async createStore(request: CreateStoreRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.post<StoreResponse>('/stores', request, authHeaders)
  },

  async updateStore(storeId: number, request: UpdateStoreRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.put<StoreResponse>(`/stores/${storeId}`, request, authHeaders)
  },

  async updateBrand(storeId: number, request: BrandUpdateRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.put<StoreResponse>(`/stores/${storeId}/brand`, request, authHeaders)
  },

  async updatePaymentMethods(storeId: number, request: PaymentMethodsRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.put<StoreResponse>(`/stores/${storeId}/payment-methods`, request, authHeaders)
  },

  async updateOnboardingStep(storeId: number, request: OnboardingStepRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.put<StoreResponse>(`/stores/${storeId}/onboarding-step`, request, authHeaders)
  },

  async publishStore(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.post<StoreResponse>(`/stores/${storeId}/publish`, undefined, authHeaders)
  },

  async unpublishStore(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StoreResponse>> {
    return httpClient.post<StoreResponse>(`/stores/${storeId}/unpublish`, undefined, authHeaders)
  },

  async deleteStore(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/stores/${storeId}`, authHeaders)
  },

  async getSettings(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<StoreSettingsResponse>> {
    return httpClient.get<StoreSettingsResponse>(`/stores/${storeId}/settings`, authHeaders)
  },

  async updateSettings(storeId: number, request: UpdateSettingsRequest, authHeaders?: Record<string, string>): Promise<ApiResult<StoreSettingsResponse>> {
    return httpClient.put<StoreSettingsResponse>(`/stores/${storeId}/settings`, request, authHeaders)
  },
}
