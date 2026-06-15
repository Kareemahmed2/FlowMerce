/**
 * Wishlist service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints (auth: Bearer BUYER token):
 *   GET    /wishlist                          → getWishlist()
 *   POST   /wishlist                          → addToWishlist()
 *   DELETE /wishlist/{productId}              → removeFromWishlist()
 *   POST   /wishlist/{productId}/move-to-cart → moveToCart()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type { WishlistResponse, AddToWishlistRequest } from '@/types/wishlist.types'
import type { CartResponse } from '@/types/cart.types'

export const wishlistService = {
  async getWishlist(authHeaders?: Record<string, string>): Promise<ApiResult<WishlistResponse>> {
    return httpClient.get<WishlistResponse>('/wishlist', authHeaders)
  },

  async addToWishlist(request: AddToWishlistRequest, authHeaders?: Record<string, string>): Promise<ApiResult<WishlistResponse>> {
    // INT-44: backend returns the updated wishlist (with real wishlistId), not void.
    return httpClient.post<WishlistResponse>('/wishlist', request, authHeaders)
  },

  async removeFromWishlist(productId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/wishlist/${productId}`, authHeaders)
  },

  async moveToCart(productId: number, authHeaders?: Record<string, string>): Promise<ApiResult<CartResponse>> {
    // INT-44: backend returns the updated cart after moving the item.
    return httpClient.post<CartResponse>(`/wishlist/${productId}/move-to-cart`, undefined, authHeaders)
  },
}
