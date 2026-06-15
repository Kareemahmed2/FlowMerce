/**
 * Category service — wraps /categories endpoints.
 *
 * Backend endpoints:
 *   GET    /categories          → getAll()   (public)
 *   GET    /categories/{id}     → getById()  (public)
 *   POST   /categories          → create()   (ADMIN)
 *   PUT    /categories/{id}     → update()   (ADMIN)
 *   DELETE /categories/{id}     → delete()   (ADMIN)
 *
 * All methods return ApiResult<T>, never throw.
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type { CategoryRequest, CategoryResponse } from '@/types/category.types'

export const categoryService = {
  async getAll(): Promise<ApiResult<CategoryResponse[]>> {
    return httpClient.get<CategoryResponse[]>('/categories')
  },

  /** Returns global categories + this store's own categories combined (merchant auth). */
  async getStoreCategories(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<CategoryResponse[]>> {
    return httpClient.get<CategoryResponse[]>(`/stores/${storeId}/categories`, authHeaders)
  },

  /** Creates a store-owned category (merchant auth). */
  async createStoreCategory(storeId: number, request: CategoryRequest, authHeaders?: Record<string, string>): Promise<ApiResult<CategoryResponse>> {
    return httpClient.post<CategoryResponse>(`/stores/${storeId}/categories`, request, authHeaders)
  },

  /** Deletes a store-owned category (merchant auth). */
  async deleteStoreCategory(storeId: number, categoryId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/stores/${storeId}/categories/${categoryId}`, authHeaders)
  },

  async getById(id: number): Promise<ApiResult<CategoryResponse>> {
    return httpClient.get<CategoryResponse>(`/categories/${id}`)
  },

  async create(request: CategoryRequest, authHeaders?: Record<string, string>): Promise<ApiResult<CategoryResponse>> {
    return httpClient.post<CategoryResponse>('/categories', request, authHeaders)
  },

  async update(id: number, request: CategoryRequest, authHeaders?: Record<string, string>): Promise<ApiResult<CategoryResponse>> {
    return httpClient.put<CategoryResponse>(`/categories/${id}`, request, authHeaders)
  },

  async delete(id: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/categories/${id}`, authHeaders)
  },
}
