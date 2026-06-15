'use client'

/**
 * NotificationListener — merchant-side SSE listener.
 *
 * Opens two connections:
 *   /stream/stock   — public broadcast, no auth required
 *   /stream/private — merchant-authenticated, requires Bearer token
 *
 * Events handled:
 *   STOCK_ALERT  → toast.warning  (low-stock broadcast from /stream/stock)
 *   ORDER_UPDATE → toast.info     (per-merchant order updates from /stream/private)
 *
 * Renders nothing — side-effect only component.
 * Uses the existing useEventStream hook (fetch-based, supports auth headers,
 * auto-reconnect) instead of native EventSource which cannot send custom headers.
 */

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useMerchantAuth } from '@/store/auth-store'
import { useEventStream } from '@/hooks/useEventStream'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function NotificationListener() {
  const auth = useMerchantAuth()
  const enabled = auth.isHydrated && auth.isAuthenticated

  // If an SSE stream gets a 401, the backend session is invalid (DB reset or
  // token expired). Clear the local session so the user is prompted to log in.
  const handleSseAuthError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('auth error: 401') || msg.includes('auth error: 403')) {
      auth.clearSession()
    }
  }, [auth])

  // Auth headers memo — only recompute when login state changes
  const headers = useMemo(
    () => (enabled ? auth.getAuthHeader() : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled]
  )

  // ── Stock broadcast — only when merchant is authenticated ──────────────────
  // SEC-13: /stream/stock requires auth (anyRequest().authenticated()).
  // With credentials:'include' in sse-client, the httpOnly cookie handles it.
  useEventStream({
    url: `${BASE_URL}/stream/stock`,
    headers,
    enabled,
    onError: handleSseAuthError,
    handlers: {
      STOCK_ALERT: (data) => {
        const d = data as { message?: string; productId?: number }
        toast.warning(d.message ?? 'Stock alert received', {
          description: d.productId ? `Product #${d.productId}` : undefined,
          duration: 6000,
        })
      },
    },
  })

  // ── Merchant-authenticated private stream ──────────────────────────────────
  useEventStream({
    url: `${BASE_URL}/stream/private`,
    headers,
    enabled,
    onError: handleSseAuthError,
    handlers: {
      ORDER_UPDATE: (data) => {
        const d = data as { message?: string; orderId?: number; status?: string }
        toast.info(d.message ?? 'Order updated', {
          description: d.orderId ? `Order #${d.orderId}` : undefined,
          duration: 5000,
        })
      },
    },
  })

  return null
}
