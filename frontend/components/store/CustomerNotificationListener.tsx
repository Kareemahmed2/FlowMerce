'use client'

/**
 * CustomerNotificationListener — customer-side SSE toast listener.
 *
 * Mirrors components/NotificationListener.tsx (merchant side). Subscribes to
 * RealtimeProvider's `lastEvent` and surfaces a toast for events that matter
 * to the shopper: order status changes and account activity (payment
 * confirmed/failed/refunded, etc.). RealtimeProvider already manages the
 * underlying SSE connection — this component only reacts to it.
 *
 * Renders nothing — side-effect only component.
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useRealtime } from './RealtimeProvider'

export default function CustomerNotificationListener() {
  const { lastEvent } = useRealtime()
  const lastShownRef = useRef(0)

  useEffect(() => {
    if (!lastEvent || lastEvent.receivedAt === lastShownRef.current) return
    lastShownRef.current = lastEvent.receivedAt

    if (lastEvent.type === 'ORDER_UPDATE') {
      const d = lastEvent.data as { message?: string; orderId?: number; status?: string }
      toast.info(d.message ?? 'Order updated', {
        description: d.orderId ? `Order #${d.orderId}` : undefined,
        duration: 6000,
      })
    } else if (lastEvent.type === 'ACCOUNT_ACTIVITY') {
      const d = lastEvent.data as { message?: string }
      toast.info(d.message ?? 'Account activity', { duration: 6000 })
    }
  }, [lastEvent])

  return null
}
