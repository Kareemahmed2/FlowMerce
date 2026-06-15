'use client'

/**
 * useEventStream — React hook wrapping fetch-based SSE.
 *
 * Opens a single SSE connection per (url + headers) tuple. Re-opens when
 * `enabled` toggles or `url` changes. Closes on unmount.
 *
 * Backend event types (see UserManagement/service/SseService.java):
 *   - CONNECTED       — welcome event when subscription opens
 *   - ORDER_UPDATE    — { orderId, status, message }
 *   - STOCK_ALERT     — { productId, newQuantity, threshold, alertLevel, ... }
 *   - ACCOUNT_ACTIVITY — { message }
 *
 * Each callback receives the parsed JSON payload (or the raw string if not JSON).
 */

import { useEffect, useRef } from 'react'
import { openSseConnection, parseSseJson, type SseEvent } from '@/lib/sse/sse-client'

export type SseEventHandler = (data: unknown, rawEvent: SseEvent) => void

export interface UseEventStreamOptions {
  /** Absolute or app-relative URL of the SSE endpoint. */
  url: string
  /** Optional headers — usually `{ Authorization: 'Bearer ...' }`. */
  headers?: Record<string, string>
  /** If false, the connection is not opened. Default true. */
  enabled?: boolean
  /** Map of event type → handler. Use '*' to catch all events. */
  handlers?: Record<string, SseEventHandler>
  /** Fired once when the stream is open. */
  onOpen?: () => void
  /** Fired before each reconnect attempt. */
  onError?: (err: unknown) => void
}

export function useEventStream(options: UseEventStreamOptions): void {
  const {
    url,
    headers,
    enabled = true,
    handlers,
    onOpen,
    onError,
  } = options

  // Keep latest handlers in a ref so connection isn't torn down when handlers change.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // Serialise headers for the effect dep — primitive comparison.
  const headersKey = headers ? JSON.stringify(headers) : ''

  useEffect(() => {
    if (!enabled || !url) return
    if (typeof window === 'undefined') return // SSR guard

    const conn = openSseConnection({
      url,
      headers,
      onOpen: () => onOpenRef.current?.(),
      onError: (err) => onErrorRef.current?.(err),
      onEvent: (event) => {
        const map = handlersRef.current
        if (!map) return
        // Try JSON; fall back to raw string.
        const parsed = parseSseJson(event) ?? event.data
        const typeHandler = map[event.type]
        if (typeHandler) typeHandler(parsed, event)
        // Wildcard listener
        if (event.type !== '*' && map['*']) map['*'](parsed, event)
      },
    })

    return () => conn.close()
    // headers is captured by JSON.stringify(headers) in headersKey to avoid
    // reconnect-on-every-render when the consumer passes an inline object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, headersKey])
}
