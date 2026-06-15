/**
 * Inventory service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   PATCH  /products/{productId}/stock                                    → updateStock()
 *   GET    /stores/{storeId}/inventory                                     → getStoreInventory()
 *   POST   /stores/{storeId}/inventory/{productId}/restock                 → restockProduct()
 *   GET    /stores/{storeId}/inventory/{productId}/history                 → getStockHistory()
 *   GET    /inventory/{productId}                                          → getInventoryDetail()
 *   GET    /inventory/{productId}/check?qty={qty}                         → checkAvailability()
 *   POST   /inventory/adjust                                               → adjustStock()
 *   POST   /inventory/reserve                                              → reserveStock()
 *   POST   /inventory/release                                              → releaseStock()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  InventoryAdjustRequest,
  InventoryResponse,
  InventoryTransaction,
  RestockRequest,
  StockUpdateRequest,
} from '@/types/inventory.types'

export const inventoryService = {
  async getStoreInventory(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<InventoryResponse[]>> {
    return httpClient.get<InventoryResponse[]>(`/stores/${storeId}/inventory`, authHeaders)
  },

  async getInventoryDetail(productId: number): Promise<ApiResult<InventoryResponse>> {
    return httpClient.get<InventoryResponse>(`/inventory/${productId}`)
  },

  async checkAvailability(productId: number, qty: number): Promise<ApiResult<boolean>> {
    return httpClient.get<boolean>(`/inventory/${productId}/check?qty=${qty}`)
  },

  async updateStock(productId: number, request: StockUpdateRequest, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.patch<void>(`/products/${productId}/stock`, request, authHeaders)
  },

  async restockProduct(storeId: number, productId: number, request: RestockRequest, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.post<void>(`/stores/${storeId}/inventory/${productId}/restock`, request, authHeaders)
  },

  async getStockHistory(storeId: number, productId: number, authHeaders?: Record<string, string>): Promise<ApiResult<InventoryTransaction[]>> {
    return httpClient.get<InventoryTransaction[]>(`/stores/${storeId}/inventory/${productId}/history`, authHeaders)
  },

  async adjustStock(request: InventoryAdjustRequest, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.post<void>('/inventory/adjust', request, authHeaders)
  },

  async reserveStock(request: InventoryAdjustRequest, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.post<void>('/inventory/reserve', request, authHeaders)
  },

  async releaseStock(request: InventoryAdjustRequest, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.post<void>('/inventory/release', request, authHeaders)
  },
}
