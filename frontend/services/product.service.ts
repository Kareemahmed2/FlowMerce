/**
 * Product service — wraps /stores/{storeId}/products endpoints.
 *
 * Backend endpoints:
 *   POST   /stores/{storeId}/products                       → create()       (MERCHANT)
 *   GET    /stores/{storeId}/products                       → getStoreProducts() (MERCHANT)
 *   GET    /stores/{storeId}/products/public                → getActiveProducts() (public)
 *   GET    /stores/{storeId}/products/{productId}           → getById()      (public)
 *   PUT    /stores/{storeId}/products/{productId}           → update()       (MERCHANT)
 *   PATCH  /stores/{storeId}/products/{productId}/status    → toggleStatus() (MERCHANT)
 *   DELETE /stores/{storeId}/products/{productId}           → delete()       (MERCHANT)
 *   GET    /stores/{storeId}/products/search?keyword=       → search()       (public)
 *   POST   /stores/{storeId}/products/{productId}/media     → addMedia()     (MERCHANT)
 *   DELETE /stores/{storeId}/products/{productId}/media/{mediaId} → deleteMedia() (MERCHANT)
 *
 * All methods return ApiResult<T>, never throw.
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  AddMediaRequest,
  CreateProductRequest,
  ProductMediaResponse,
  ProductResponse,
  UpdateProductRequest,
} from '@/types/product.types'

export const productService = {
  async create(storeId: number, request: CreateProductRequest, authHeaders?: Record<string, string>): Promise<ApiResult<ProductResponse>> {
    return httpClient.post<ProductResponse>(`/stores/${storeId}/products`, request, authHeaders)
  },

  async getStoreProducts(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<ProductResponse[]>> {
    return httpClient.get<ProductResponse[]>(`/stores/${storeId}/products`, authHeaders)
  },

  async getActiveProducts(storeId: number): Promise<ApiResult<ProductResponse[]>> {
    return httpClient.get<ProductResponse[]>(`/stores/${storeId}/products/public`)
  },

  async getById(storeId: number, productId: number): Promise<ApiResult<ProductResponse>> {
    return httpClient.get<ProductResponse>(`/stores/${storeId}/products/${productId}`)
  },

  async update(storeId: number, productId: number, request: UpdateProductRequest, authHeaders?: Record<string, string>): Promise<ApiResult<ProductResponse>> {
    return httpClient.put<ProductResponse>(`/stores/${storeId}/products/${productId}`, request, authHeaders)
  },

  async toggleStatus(storeId: number, productId: number, authHeaders?: Record<string, string>): Promise<ApiResult<ProductResponse>> {
    return httpClient.patch<ProductResponse>(`/stores/${storeId}/products/${productId}/status`, undefined, authHeaders)
  },

  async delete(storeId: number, productId: number, authHeaders?: Record<string, string>): Promise<ApiResult<{ message: string }>> {
    return httpClient.delete<{ message: string }>(`/stores/${storeId}/products/${productId}`, authHeaders)
  },

  async search(storeId: number, keyword: string): Promise<ApiResult<ProductResponse[]>> {
    return httpClient.get<ProductResponse[]>(`/stores/${storeId}/products/search?keyword=${encodeURIComponent(keyword)}`)
  },

  async addMedia(storeId: number, productId: number, request: AddMediaRequest, authHeaders?: Record<string, string>): Promise<ApiResult<ProductMediaResponse>> {
    return httpClient.post<ProductMediaResponse>(`/stores/${storeId}/products/${productId}/media`, request, authHeaders)
  },

  async deleteMedia(storeId: number, productId: number, mediaId: number, authHeaders?: Record<string, string>): Promise<ApiResult<{ message: string }>> {
    return httpClient.delete<{ message: string }>(`/stores/${storeId}/products/${productId}/media/${mediaId}`, authHeaders)
  },
}
