'use client'

/**
 * Orchestrates the customer orders list state.
 *
 * Responsibilities:
 *  - Reads/writes URL params via useDebouncedUrlState (status, sort, page)
 *  - Loads orders from orderService on param change
 *  - Exposes typed action functions with stable references
 *  - Handles cancel and reorder actions (with cart integration for reorder)
 *  - Emits a refresh signal when localStorage orders change externally
 *
 * React Query migration path:
 *  Replace the useEffect + useState block with a useQuery / useMutation pair.
 *  The URL sync and action functions stay identical.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useCart } from '@/components/store/StoreProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { useRealtime } from '@/components/store/RealtimeProvider'
import { useDebouncedUrlState } from '@/lib/url-state'
import { parseQueryEnum, parseQueryString } from '@/lib/query-params'
import { normalizePage, normalizePageSize } from '@/lib/pagination'
import { useSafeEffect } from '@/lib/react/use-safe-effect'
import { storeEvents } from '@/lib/store-events'
import { orderService } from '@/services/order.service'
import {
  CUSTOMER_ORDER_STATUSES,
  DEFAULT_ORDER_FILTER,
  ORDER_SORT_OPTIONS,
} from '@/types/order.types'
import type {
  CustomerOrderStatus,
  OrderFilterState,
  OrderListResponse,
  OrderSortOption,
  OrderStatusFilter,
  UseCustomerOrdersReturn,
} from '@/types/order.types'

// ── URL ↔ filter mapping ───────────────────────────────────────────────────────

function parseFiltersFromUrl(params: Record<string, string>): OrderFilterState {
  const statusRaw = parseQueryString(params.status ?? null, 'all')
  const status: OrderStatusFilter =
    statusRaw === 'all'
      ? 'all'
      : parseQueryEnum(statusRaw, CUSTOMER_ORDER_STATUSES, 'pending' as CustomerOrderStatus)

  return {
    status,
    sort: parseQueryEnum(params.sort ?? null, ORDER_SORT_OPTIONS, DEFAULT_ORDER_FILTER.sort),
    page: normalizePage(params.page),
    pageSize: normalizePageSize(params.size),
  }
}

function hasActiveFilters(filters: OrderFilterState): boolean {
  return filters.status !== DEFAULT_ORDER_FILTER.status || filters.sort !== DEFAULT_ORDER_FILTER.sort
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCustomerOrders(): UseCustomerOrdersReturn {
  const auth = useCustomerAuth()
  const store = useStore()
  const cart = useCart()
  const realtime = useRealtime()
  const { params, updateParams } = useDebouncedUrlState(0) // orders don't need debounce

  const filters = useMemo(() => parseFiltersFromUrl(params), [params])

  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [response, setResponse] = useState<OrderListResponse | null>(null)
  const [error, setError] = useState('')
  // Increment to force a re-fetch without URL change (e.g. after cancel)
  const [refreshToken, setRefreshToken] = useState(0)

  const categoriesRef = useRef(store.categories)
  categoriesRef.current = store.categories

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useSafeEffect((isMounted) => {
    if (!auth.customer?.email) {
      setFetchStatus('idle')
      return
    }

    setFetchStatus('loading')
    setError('')

    orderService
      .getCustomerOrders(auth.customer.email, params, auth.getAuthHeader())
      .then((result) => {
        if (!isMounted()) return
        if (result.ok) {
          setResponse(result.data)
          setFetchStatus('success')
        } else {
          setError(result.error)
          setFetchStatus('error')
        }
      })
    // refreshToken is intentionally in the dep array so manual refresh works
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, auth.customer?.email, refreshToken])

  // ── Listen for external order updates ─────────────────────────────────────────
  // Three sources:
  //  - storeEvents.orderCreated: fired by apply-checkout via the typed event bus
  //  - flowmerce-orders-updated: legacy raw DOM event from saveOrders() for
  //    backwards compat (merchant dashboard updates, etc.)
  //  - realtime.orderTick: SSE ORDER_UPDATE event from the backend
  useSafeEffect(() => {
    const unsubTyped = storeEvents.on('orderCreated', () => {
      setRefreshToken((t) => t + 1)
    })
    const handleLegacy = () => setRefreshToken((t) => t + 1)
    window.addEventListener('flowmerce-orders-updated', handleLegacy)
    return () => {
      unsubTyped()
      window.removeEventListener('flowmerce-orders-updated', handleLegacy)
    }
  }, [])

  // SSE-driven refresh: bump refreshToken when an ORDER_UPDATE arrives.
  useEffect(() => {
    if (realtime.orderTick === 0) return
    setRefreshToken((t) => t + 1)
  }, [realtime.orderTick])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const setStatusFilter = useCallback(
    (status: OrderStatusFilter) => {
      updateParams({ status: status === 'all' ? null : status, page: null })
    },
    [updateParams]
  )

  const setSort = useCallback(
    (sort: OrderSortOption) => {
      updateParams({ sort: sort === DEFAULT_ORDER_FILTER.sort ? null : sort, page: null })
    },
    [updateParams]
  )

  const goToPage = useCallback(
    (page: number) => {
      updateParams({ page: page <= 1 ? null : String(page) }, { scroll: false })
    },
    [updateParams]
  )

  const resetFilters = useCallback(() => {
    updateParams({ status: null, sort: null, page: null })
  }, [updateParams])

  const refreshOrders = useCallback(() => {
    setRefreshToken((t) => t + 1)
  }, [])

  const cancelOrder = useCallback(
    async (orderId: string) => {
      const result = await orderService.cancelOrder(orderId, auth.getAuthHeader())
      if (result.ok) {
        setRefreshToken((t) => t + 1)
        return { ok: true as const }
      }
      return { ok: false as const, message: result.error }
    },
    [auth.getAuthHeader]
  )

  const reorder = useCallback(
    async (orderId: string) => {
      const result = await orderService.getReorderItems(orderId, categoriesRef.current, auth.getAuthHeader())
      if (!result.ok) return { ok: false as const, addedCount: 0, message: result.error }

      let addedCount = 0
      for (const item of result.data) {
        if (item.productId === null) continue
        // Find the product in the current catalog
        for (const category of categoriesRef.current) {
          const product = category.products.find((p) => p.id === item.productId)
          if (product) {
            cart.addItem(product, category.name)
            addedCount++
            break
          }
        }
      }

      return {
        ok: true as const,
        addedCount,
        message:
          addedCount === 0
            ? 'No items could be re-added — products may no longer be available.'
            : addedCount === result.data.length
            ? 'All items added to your cart.'
            : `${addedCount} of ${result.data.length} items added to cart.`,
      }
    },
    [cart]
  )

  return {
    filters,
    status: fetchStatus,
    response,
    error,
    hasOrders: (response?.totalOrders ?? 0) > 0,
    hasActiveFilters: hasActiveFilters(filters),
    setStatusFilter,
    setSort,
    goToPage,
    resetFilters,
    refreshOrders,
    cancelOrder,
    reorder,
  }
}
