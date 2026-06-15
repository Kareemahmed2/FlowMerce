/**
 * Review service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   GET    /products/{productId}/reviews             → getReviews() (public)
 *   POST   /products/{productId}/reviews             → createReview() (BUYER auth)
 *   PUT    /products/{productId}/reviews             → updateReview() (BUYER auth)
 *   DELETE /products/{productId}/reviews/{reviewId} → deleteReview() (BUYER or ADMIN auth)
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type { ReviewResponse, CreateReviewRequest, UpdateReviewRequest } from '@/types/review.types'

export const reviewService = {
  async getReviews(productId: number): Promise<ApiResult<ReviewResponse[]>> {
    return httpClient.get<ReviewResponse[]>(`/products/${productId}/reviews`)
  },

  async createReview(
    productId: number,
    _customerId: string,
    _customerName: string,
    request: CreateReviewRequest,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<ReviewResponse>> {
    return httpClient.post<ReviewResponse>(`/products/${productId}/reviews`, request, authHeaders)
  },

  async updateReview(
    productId: number,
    _reviewId: number,
    request: UpdateReviewRequest,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<ReviewResponse>> {
    return httpClient.put<ReviewResponse>(`/products/${productId}/reviews`, request, authHeaders)
  },

  async deleteReview(productId: number, reviewId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.delete<void>(`/products/${productId}/reviews/${reviewId}`, authHeaders)
  },
}
