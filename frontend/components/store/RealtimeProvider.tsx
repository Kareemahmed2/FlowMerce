'use client'

/**
 * RealtimeProvider — opens an SSE connection to /stream/private when the
 * customer is logged in, and exposes a small context that other hooks can
 * subscribe to for live updates.
 *
 * Design:
 *   - Lives INSIDE CustomerAuthProvider (uses useCustomerAuth)
 *   - Renders {children} unchanged — adds a context layer
 *   - Exposes:
 *       isConnected       — current connection state
 *       lastEvent         — most recent server event (full envelope)
 *       notificationTick  — increments on any event that should refresh notifications
 *       orderTick         — increments on ORDER_UPDATE events
 *
 * Consumers (e.g. useNotifications, useCustomerOrders) include these ticks in
 * their effect deps so they refetch automatically when a relevant event arrives.
 *
 * In mock mode (no NEXT_PUBLIC_API_URL) the connection is skipped — ticks stay 0.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { useEventStream, type SseEventHandler } from '@/hooks/useEventStream'

export interface ServerEvent {
  type: string
  data: unknown
  receivedAt: number
}

export interface RealtimeState {
  isConnected: boolean
  lastEvent: ServerEvent | null
  /** Increments on any event that touches notifications (ORDER_UPDATE, ACCOUNT_ACTIVITY). */
  notificationTick: number
  /** Increments on ORDER_UPDATE events. */
  orderTick: number
}

const RealtimeCtx = createContext<RealtimeState>({
  isConnected: false,
  lastEvent: null,
  notificationTick: 0,
  orderTick: 0,
})

export function useRealtime(): RealtimeState {
  return useContext(RealtimeCtx)
}

// ── Provider ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const auth = useCustomerAuth()

  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<ServerEvent | null>(null)
  const [notificationTick, setNotificationTick] = useState(0)
  const [orderTick, setOrderTick] = useState(0)

  const recordEvent = useCallback((type: string, data: unknown) => {
    setLastEvent({ type, data, receivedAt: Date.now() })
  }, [])

  const handlers: Record<string, SseEventHandler> = useMemo(
    () => ({
      CONNECTED: (data) => {
        setIsConnected(true)
        recordEvent('CONNECTED', data)
      },
      ORDER_UPDATE: (data) => {
        recordEvent('ORDER_UPDATE', data)
        setOrderTick((t) => t + 1)
        setNotificationTick((t) => t + 1)
      },
      ACCOUNT_ACTIVITY: (data) => {
        recordEvent('ACCOUNT_ACTIVITY', data)
        setNotificationTick((t) => t + 1)
      },
      STOCK_ALERT: (data) => {
        recordEvent('STOCK_ALERT', data)
        setNotificationTick((t) => t + 1)
      },
    }),
    [recordEvent]
  )

  const enabled = auth.isHydrated && auth.isLoggedIn

  const headers = useMemo(() => {
    const h = auth.getAuthHeader()
    return Object.keys(h).length > 0 ? h : undefined
    // re-compute when login state flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isLoggedIn, auth.isHydrated])

  useEventStream({
    url: enabled ? `${BASE_URL}/stream/private` : '',
    headers,
    enabled,
    handlers,
    onError: () => setIsConnected(false),
  })

  const value: RealtimeState = useMemo(
    () => ({ isConnected, lastEvent, notificationTick, orderTick }),
    [isConnected, lastEvent, notificationTick, orderTick]
  )

  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>
}
