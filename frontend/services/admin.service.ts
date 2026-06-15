/**
 * Admin service — all methods return ApiResult<T>, never throw.
 * Requires ADMIN role JWT in Authorization header.
 *
 * Backend endpoints:
 *   GET    /admin/users                          → getUsers()
 *   DELETE /admin/users/{id}                     → deleteUser()
 *   GET    /admin/merchants                      → getMerchants()
 *   PUT    /admin/merchants/{id}/verify          → verifyMerchant()
 *   DELETE /admin/merchants/{id}                 → deleteMerchant()
 *   GET    /admin/stores                         → getStores()
 *   GET    /orders/admin/all?page&size&sort       → getAllOrders()
 */

import { httpClient } from '@/lib/api/http-client'
import { apiSuccess } from '@/types/api.types'
import type { ApiResult } from '@/types/api.types'
import type {
  AdminMerchantResponse,
  AdminOrderPage,
  AdminOrderSummary,
  AdminStoreResponse,
  AdminUserResponse,
} from '@/types/admin.types'

export const adminService = {
  async getUsers(authHeaders?: Record<string, string>): Promise<ApiResult<AdminUserResponse[]>> {
    return httpClient.get<AdminUserResponse[]>('/admin/users', authHeaders)
  },

  async deleteUser(userId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/admin/users/${userId}`, authHeaders)
  },

  async getMerchants(authHeaders?: Record<string, string>): Promise<ApiResult<AdminMerchantResponse[]>> {
    return httpClient.get<AdminMerchantResponse[]>('/admin/merchants', authHeaders)
  },

  async verifyMerchant(merchantId: number, authHeaders?: Record<string, string>): Promise<ApiResult<AdminMerchantResponse>> {
    return httpClient.put<AdminMerchantResponse>(`/admin/merchants/${merchantId}/verify`, undefined, authHeaders)
  },

  async deleteMerchant(merchantId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/admin/merchants/${merchantId}`, authHeaders)
  },

  async getStores(authHeaders?: Record<string, string>): Promise<ApiResult<AdminStoreResponse[]>> {
    return httpClient.get<AdminStoreResponse[]>('/admin/stores', authHeaders)
  },

  async getAllOrders(page = 0, size = 20, authHeaders?: Record<string, string>): Promise<ApiResult<AdminOrderPage>> {
    // INT-32: the endpoint returns a raw Spring Data Page, which uses `number`/`size`
    // (not `currentPage`/`pageSize`). Normalize it to AdminOrderPage here.
    const result = await httpClient.get<{
      content: AdminOrderSummary[]
      totalElements: number
      totalPages: number
      number: number
      size: number
    }>(`/orders/admin/all?page=${page}&size=${size}&sort=orderDate,desc`, authHeaders)
    if (!result.ok) return result
    const p = result.data
    return apiSuccess<AdminOrderPage>({
      content: p.content ?? [],
      totalElements: p.totalElements ?? 0,
      totalPages: p.totalPages ?? 0,
      currentPage: p.number ?? 0,
      pageSize: p.size ?? size,
    })
  },
}
