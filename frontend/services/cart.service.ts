/**
 * Cart service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   GET    /cart/{storeId}                              → getCart()
 *   POST   /cart/items                                  → addItem()
 *   PUT    /cart/items/{cartItemId}                     → updateItem()
 *   DELETE /cart/items/{cartItemId}                     → removeItem()
 *   DELETE /cart/{storeId}                              → clearCart()
 *   POST   /cart/checkout                               → previewCheckout()
 *
 * Auth: pass getAuthHeader() from CustomerAuthProvider as authHeaders.
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  AddToCartRequest,
  CartResponse,
  CartCheckoutRequest,
  CheckoutSummary,
  UpdateQuantityRequest,
} from '@/types/cart.types'

export const cartService = {
  async getCart(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<CartResponse>> {
    return httpClient.get<CartResponse>(`/cart/${storeId}`, authHeaders)
  },

  async addItem(
    request: AddToCartRequest & { storeId?: number; productName?: string; productImage?: string | null; priceAtAdd?: number },
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<CartResponse>> {
    return httpClient.post<CartResponse>('/cart/items', { productId: request.productId, quantity: request.quantity }, authHeaders)
  },

  async updateItem(cartItemId: number, request: UpdateQuantityRequest, authHeaders?: Record<string, string>): Promise<ApiResult<CartResponse>> {
    return httpClient.put<CartResponse>(`/cart/items/${cartItemId}`, request, authHeaders)
  },

  async removeItem(cartItemId: number, authHeaders?: Record<string, string>): Promise<ApiResult<CartResponse>> {
    return httpClient.delete<CartResponse>(`/cart/items/${cartItemId}`, authHeaders)
  },

  async clearCart(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/cart/${storeId}`, authHeaders)
  },

  async previewCheckout(request: CartCheckoutRequest & { storeId: number }, authHeaders?: Record<string, string>): Promise<ApiResult<CheckoutSummary>> {
    return httpClient.post<CheckoutSummary>('/cart/checkout', request, authHeaders)
  },
}
