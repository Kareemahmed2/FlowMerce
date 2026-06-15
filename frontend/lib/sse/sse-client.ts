/**
 * Framework-agnostic Server-Sent Events client using fetch + ReadableStream.
 *
 * Why fetch instead of native EventSource:
 *   The backend filter (JwtAuthFilter) only accepts JWT via the Authorization
 *   header. Native EventSource cannot set custom headers. fetch streaming
 *   gives us full control and works in all evergreen browsers.
 *
 * Features:
 *   - Custom headers (Authorization: Bearer <token>)
 *   - Automatic reconnect with exponential backoff (capped)
 *   - Last-Event-ID tracking
 *   - Typed event dispatch (callback-based)
 *   - Clean abort via AbortController
 *
 * SSE wire format:
 *   event: TYPE\n
 *   data: <line 1>\n
 *   data: <line 2>\n
 *   id: <event-id>\n
 *   retry: <ms>\n
 *   \n
 */

export interface SseEvent {
  /** Event type (from `event:` field). Falls back to "message". */
  type: string
  /** Raw data payload (concatenated `data:` lines). */
  data: string
  /** Optional event id from the `id:` field. */
  id?: string
}

export interface SseClientOptions {
  url: string
  headers?: Record<string, string>
  /** Called on every parsed event. */
  onEvent: (event: SseEvent) => void
  /** Called when the connection is open and ready. */
  onOpen?: () => void
  /** Called on transient error before reconnect attempt. */
  onError?: (err: unknown) => void
  /** Initial reconnect delay in ms. Default 1000. */
  initialReconnectDelayMs?: number
  /** Maximum reconnect delay in ms. Default 30000. */
  maxReconnectDelayMs?: number
  /** If true, stops on first error (no reconnect). Default false. */
  noReconnect?: boolean
}

export interface SseConnection {
  /** Close the connection — no more events, no reconnect. */
  close: () => void
}

const DEFAULT_INITIAL_DELAY = 1000
const DEFAULT_MAX_DELAY = 30_000

/**
 * Opens a managed SSE connection. Returns a handle to close it.
 *
 * The connection auto-reconnects on network errors with exponential backoff
 * unless explicitly closed via the returned close() function or noReconnect
 * was set in options.
 */
export function openSseConnection(options: SseClientOptions): SseConnection {
  const {
    url,
    headers = {},
    onEvent,
    onOpen,
    onError,
    initialReconnectDelayMs = DEFAULT_INITIAL_DELAY,
    maxReconnectDelayMs = DEFAULT_MAX_DELAY,
    noReconnect = false,
  } = options

  let closed = false
  let controller: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let lastEventId: string | null = null

  const close = () => {
    closed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    controller?.abort()
    controller = null
  }

  const scheduleReconnect = () => {
    if (closed || noReconnect) return
    const delay = Math.min(
      initialReconnectDelayMs * 2 ** attempt,
      maxReconnectDelayMs
    )
    attempt += 1
    reconnectTimer = setTimeout(() => {
      void connect()
    }, delay)
  }

  const connect = async () => {
    if (closed) return
    controller = new AbortController()

    const finalHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...headers,
    }
    if (lastEventId) {
      finalHeaders['Last-Event-ID'] = lastEventId
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: finalHeaders,
        signal: controller.signal,
        // SEC-6: send httpOnly auth cookie automatically on every SSE request.
        // This is equivalent to the http-client credentials:'include' setting.
        credentials: 'include',
        // Important: SSE responses are infinite — disable caching
        cache: 'no-store',
      })

      if (!response.ok || !response.body) {
        // 401 / 403: auth problem — don't reconnect indefinitely.
        // The token is invalid or the session is revoked. Stop reconnecting.
        if (response.status === 401 || response.status === 403) {
          onError?.(new Error(`SSE auth error: ${response.status} — not reconnecting`))
          return // exit without scheduling reconnect
        }
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      attempt = 0 // reset backoff on successful connect
      onOpen?.()

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!closed) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Events are separated by a blank line (\n\n).
        // Some servers use \r\n\r\n — handle both.
        let separator: number
        while (
          (separator = findEventBoundary(buffer)) !== -1
        ) {
          const rawEvent = buffer.slice(0, separator)
          // Skip the separator itself (1 or 2 line endings).
          buffer = buffer.slice(separator).replace(/^(\r?\n){1,2}/, '')

          const parsed = parseSseChunk(rawEvent)
          if (parsed) {
            if (parsed.id) lastEventId = parsed.id
            try {
              onEvent(parsed)
            } catch {
              /* swallow handler errors so the stream stays healthy */
            }
          }
        }
      }
    } catch (err) {
      // AbortError is expected on close — ignore.
      if (controller?.signal.aborted) return
      onError?.(err)
      scheduleReconnect()
    }
  }

  void connect()

  return { close }
}

/** Returns the index of the end of the first SSE event (blank line) or -1. */
function findEventBoundary(buffer: string): number {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf === -1) return crlf
  if (crlf === -1) return lf
  return Math.min(lf, crlf)
}

/** Parses a single SSE chunk (no trailing blank line). */
function parseSseChunk(chunk: string): SseEvent | null {
  const lines = chunk.split(/\r?\n/)
  let type = 'message'
  let data = ''
  let id: string | undefined

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue // comment / heartbeat
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const field = line.slice(0, colonIdx)
    // Spec: a single space after the colon is ignored.
    const value = line.slice(colonIdx + 1).replace(/^ /, '')

    switch (field) {
      case 'event':
        type = value
        break
      case 'data':
        data = data ? `${data}\n${value}` : value
        break
      case 'id':
        id = value
        break
      // 'retry' is intentionally ignored — we use exponential backoff instead.
    }
  }

  if (!data && type === 'message') return null
  return { type, data, id }
}

/** Convenience: parse JSON data payload, returning null on failure. */
export function parseSseJson<T = unknown>(event: SseEvent): T | null {
  if (!event.data) return null
  try {
    return JSON.parse(event.data) as T
  } catch {
    return null
  }
}
