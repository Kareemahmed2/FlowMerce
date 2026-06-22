/**
 * Customer & merchant order service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   GET    /orders/me                          → getCustomerOrders()  (BUYER)
 *   GET    /orders/{id}                        → getOrderById()       (BUYER)
 *   POST   /orders/{id}/cancel                 → cancelOrder()        (BUYER)
 *   POST   /orders/place                       → placeOrder()         (BUYER)
 *   POST   /orders/{id}/reorder                → getReorderItems()    (BUYER)
 *   GET    /orders/store/{storeId}             → getStoreOrders()     (MERCHANT)
 *   GET    /orders/store/{storeId}/{orderId}   → getStoreOrderDetails() (MERCHANT)
 *   GET    /orders/store/{storeId}/customers   → getStoreCustomers()  (MERCHANT)
 *   PUT    /orders/{orderId}/status            → updateOrderStatus()  (MERCHANT)
 */

import { httpClient } from '@/lib/api/http-client'
import { buildPaginationMeta } from '@/lib/pagination'
import type {
  CustomerOrder,
  CustomerOrderStatus,
  MerchantCustomerSummary,
  MerchantOrderResponse,
  MerchantOrderSummary,
  OrderConfirmationResponse,
  OrderItem,
  OrderListItem,
  OrderListResponse,
  PlaceOrderRequest,
  UpdateOrderStatusRequest,
} from '@/types/order.types'
import { apiSuccess } from '@/types/api.types'
import type { ApiResult } from '@/types/api.types'
import { parseOrderAddress } from '@/types/order.types'

/**
 * CON-8: map the backend OrderResponse (orderId, status, shippingAddress string, …)
 * into the frontend CustomerOrder presentation shape.
 */
function mapOrderResponse(raw: {
  orderId: number
  customerId?: number
  status: string
  subtotal?: number
  shippingCost?: number
  tax?: number
  total: number
  shippingAddress?: string | null
  paymentMethod?: string | null
  invoiceNumber?: string | null
  orderDate: string
  items?: Array<{
    orderItemId?: number
    productId?: number
    productName?: string
    quantity: number
    price?: number
    subtotal?: number
  }>
}): CustomerOrder {
  const addr = parseOrderAddress(raw.shippingAddress)
  const status = (raw.status?.toLowerCase() ?? 'pending') as CustomerOrderStatus
  return {
    id: `ORD-${raw.orderId}`,
    orderNumber: `#${raw.orderId}`,
    customerName: addr.fullName ?? '',
    customerEmail: '',
    status,
    paymentStatus: status === 'delivered' ? 'paid' : 'pending',
    fulfillmentStatus: status === 'delivered' ? 'fulfilled' : status === 'cancelled' ? 'cancelled' : 'unfulfilled',
    items: (raw.items ?? []).map((i) => ({
      productId: i.productId ?? null,
      productName: i.productName ?? '',
      categoryName: '',
      unitPrice: Number(i.price ?? 0),
      quantity: i.quantity,
      totalPrice: Number(i.subtotal ?? (i.quantity * Number(i.price ?? 0))),
      imageUrl: null,
    })),
    shippingAddress: {
      fullName: addr.fullName ?? '',
      street: addr.street ?? '',
      city: addr.city ?? '',
      country: addr.country ?? '',
    },
    paymentSummary: {
      subtotal: Number(raw.subtotal ?? 0),
      shipping: Number(raw.shippingCost ?? 0),
      tax: Number(raw.tax ?? 0),
      discount: 0,
      total: Number(raw.total),
      paymentMethod: raw.paymentMethod ?? '',
      paymentStatus: status === 'delivered' ? 'paid' : 'pending',
    },
    shipment: { carrier: null, trackingNumber: null, estimatedDelivery: null, shippedAt: null },
    timeline: [],
    placedAt: raw.orderDate,
    updatedAt: raw.orderDate,
    canCancel: raw.status === 'PENDING',
    canReorder: true,
  }
}

/** Backend OrderStatus (UPPERCASE) → customer-facing status (lowercase). */
function backendStatusToCustomerStatus(s: string): CustomerOrderStatus {
  switch (s) {
    case 'PENDING':   return 'pending'
    case 'CONFIRMED': return 'confirmed'
    case 'SHIPPED':   return 'shipped'
    case 'DELIVERED': return 'delivered'
    case 'CANCELLED': return 'cancelled'
    default:          return 'pending'
  }
}

export const orderService = {
  /**
   * GET /orders/me
   * Backend filters by the authenticated user's ID from the JWT.
   * The `customerEmail` param is kept for API compatibility but ignored in live mode.
   */
  async getCustomerOrders(
    _customerEmail: string,
    rawParams: Record<string, string | undefined>,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<OrderListResponse>> {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(rawParams).filter(([, v]) => v !== undefined) as [string, string][]
      )
    ).toString()
    const backendResult = await httpClient.get<MerchantOrderSummary[]>(
      `/orders/me${qs ? `?${qs}` : ''}`,
      authHeaders
    )
    if (!backendResult.ok) return backendResult
    const items: OrderListItem[] = backendResult.data.map((s) => ({
      id: `ORD-${s.orderId}`,
      orderNumber: `#${s.orderId}`,
      status: backendStatusToCustomerStatus(s.status),
      placedAt: s.orderDate,
      total: Number(s.total),
      itemCount: s.itemCount,
      itemPreview: s.itemCount === 1 ? '1 item' : `${s.itemCount} items`,
      paymentMethod: '—',
      // INT-33: backend only permits cancelling a PENDING order.
      canCancel: s.status === 'PENDING',
    }))
    return apiSuccess({
      orders: items,
      pagination: buildPaginationMeta(1, items.length || 1, items.length),
      totalOrders: items.length,
    })
  },

  /**
   * GET /orders/{id}
   * `categories` param is kept for API compatibility but ignored in live mode.
   */
  async getOrderById(
    orderId: string,
    _categories: unknown,
    authHeaders?: Record<string, string>
  ): Promise<CustomerOrder | null> {
    const numericId = orderId.replace(/^ORD-/i, '')
    const result = await httpClient.get<Parameters<typeof mapOrderResponse>[0]>(
      `/orders/${numericId}`,
      authHeaders
    )
    return result.ok ? mapOrderResponse(result.data) : null
  },

  /** POST /orders/{id}/cancel */
  async cancelOrder(orderId: string, authHeaders?: Record<string, string>): Promise<ApiResult<{ orderId: string }>> {
    const numericId = orderId.replace(/^ORD-/i, '')
    return httpClient.post<{ orderId: string }>(`/orders/${numericId}/cancel`, undefined, authHeaders)
  },

  /** POST /orders/place */
  async placeOrder(request: PlaceOrderRequest, authHeaders?: Record<string, string>): Promise<ApiResult<OrderConfirmationResponse>> {
    type OrderPlaceResponse = {
      order: { orderId: number; status: string; total: number; paymentMethod: string }
      payment: { redirectUrl: string | null }
    }
    const wireBody = {
      storeId: request.storeId,
      shippingAddress: JSON.stringify(request.shippingAddress),
      billingAddress: JSON.stringify(request.shippingAddress),
      paymentMethod: request.paymentMethod,
      idempotencyKey: request.idempotencyKey ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      // INT-11: send cart items so the backend can reconcile if the server cart is empty
      // (e.g. guest-added items before login). Backend ignores this field when server cart
      // already has items.
      items: request.items,
    }
    const raw = await httpClient.post<OrderPlaceResponse>('/orders/place', wireBody, authHeaders)
    if (!raw.ok) return raw
    return {
      ok: true,
      data: {
        orderId: String(raw.data.order.orderId),
        orderNumber: `#${raw.data.order.orderId}`,
        status: (raw.data.order.status?.toLowerCase() ?? 'pending') as CustomerOrderStatus,
        total: Number(raw.data.order.total),
        paymentMethod: raw.data.order.paymentMethod as import('@/types/payment.types').BackendPaymentMethod,
        redirectUrl: raw.data.payment?.redirectUrl ?? null,
      },
    }
  },

  /**
   * POST /orders/{id}/reorder
   * `categories` param is kept for API compatibility but ignored in live mode.
   */
  async getReorderItems(
    orderId: string,
    _categories: unknown,
    authHeaders?: Record<string, string>
  ): Promise<ApiResult<OrderItem[]>> {
    const numericId = orderId.replace(/^ORD-/i, '')
    return httpClient.post<OrderItem[]>(`/orders/${numericId}/reorder`, undefined, authHeaders)
  },

  /** GET /orders/store/{storeId} */
  async getStoreOrders(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<MerchantOrderSummary[]>> {
    return httpClient.get<MerchantOrderSummary[]>(`/orders/store/${storeId}`, authHeaders)
  },

  /** GET /orders/store/{storeId}/{orderId} */
  async getStoreOrderDetails(storeId: number, orderId: number, authHeaders?: Record<string, string>): Promise<ApiResult<MerchantOrderResponse>> {
    return httpClient.get<MerchantOrderResponse>(`/orders/store/${storeId}/${orderId}`, authHeaders)
  },

  /** GET /orders/store/{storeId}/customers */
  async getStoreCustomers(storeId: number, authHeaders?: Record<string, string>): Promise<ApiResult<MerchantCustomerSummary[]>> {
    return httpClient.get<MerchantCustomerSummary[]>(`/orders/store/${storeId}/customers`, authHeaders)
  },

  /** PUT /orders/{orderId}/status */
  async updateOrderStatus(orderId: number, request: UpdateOrderStatusRequest, authHeaders?: Record<string, string>): Promise<ApiResult<MerchantOrderResponse>> {
    return httpClient.put<MerchantOrderResponse>(`/orders/${orderId}/status`, request, authHeaders)
  },
}
