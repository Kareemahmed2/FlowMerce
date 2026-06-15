/**
 * Payment service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   POST   /payments/initiate                          → initiatePayment()
 *   GET    /payments/{paymentId}                       → getPayment()
 *   GET    /payments/order/{orderId}                   → getPaymentByOrder()
 *   POST   /payments/{paymentId}/confirm               → confirmPayment()
 *   GET    /payments/store/{storeId}                   → getStorePayments()
 *   POST   /payments/{paymentId}/refund                → refundPayment()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type {
  ConfirmPaymentRequest,
  InitiatePaymentRequest,
  PaymentResponse,
  RefundRequest,
} from '@/types/payment.types'

export const paymentService = {
  async initiatePayment(request: InitiatePaymentRequest, authHeaders?: Record<string, string>): Promise<ApiResult<PaymentResponse>> {
    return httpClient.post<PaymentResponse>('/payments/initiate', request, authHeaders)
  },

  async getPayment(paymentId: number, authHeaders?: Record<string, string>): Promise<ApiResult<PaymentResponse>> {
    return httpClient.get<PaymentResponse>(`/payments/${paymentId}`, authHeaders)
  },

  async getPaymentByOrder(orderId: number, authHeaders?: Record<string, string>): Promise<ApiResult<PaymentResponse>> {
    return httpClient.get<PaymentResponse>(`/payments/order/${orderId}`, authHeaders)
  },

  async confirmPayment(paymentId: number, request: ConfirmPaymentRequest, authHeaders?: Record<string, string>): Promise<ApiResult<PaymentResponse>> {
    return httpClient.post<PaymentResponse>(`/payments/${paymentId}/confirm`, request, authHeaders)
  },

  async getStorePayments(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<PaymentResponse[]>> {
    return httpClient.get<PaymentResponse[]>(`/payments/store/${storeId}`, authHeaders)
  },

  async refundPayment(paymentId: number, request: RefundRequest, authHeaders?: Record<string, string>): Promise<ApiResult<PaymentResponse>> {
    return httpClient.post<PaymentResponse>(`/payments/${paymentId}/refund`, request, authHeaders)
  },
}
