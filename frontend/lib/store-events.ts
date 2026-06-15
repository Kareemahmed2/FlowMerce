/**
 * Typed cross-feature event bus with buffered replay.
 *
 * Framework-agnostic — zero React imports.
 * SSR-safe — every function guards typeof window.
 *
 * ## Race condition fix
 * Events fired before a listener mounts are stored in a ring buffer (capped at
 * BUFFER_MAX_SIZE entries). When on() is called, it replays buffered events of
 * the requested type that were fired within BUFFER_TTL_MS and BEFORE the
 * subscription was created. This covers the "checkout fires orderCreated on
 * page A, orders page mounts on page B after navigation" scenario.
 *
 * ## Replay delivery
 * Replayed events are delivered via setTimeout(fn, 0) so they run after the
 * calling useEffect has fully initialised its React state.
 *
 * ## Existing public API — UNCHANGED
 *   storeEvents.dispatch(name, detail)
 *   storeEvents.on(name, handler)  → returns unsubscribe fn
 *
 * ## Added fields on the storeEvents object
 *   storeEvents.flushBuffer()  — clear all buffered events (useful in tests)
 */

// ── Event payload shapes ───────────────────────────────────────────────────────

export interface StoreEventMap {
  /** Cart item count changed (add / remove / clear). */
  cartUpdated: { itemCount: number }
  /** Wishlist item added or removed. */
  wishlistUpdated: { productId: number; action: 'add' | 'remove' }
  /** A new order was successfully placed via checkout. */
  orderCreated: { orderId: string; total: number }
  /** Customer viewed a product detail page. */
  productViewed: { productId: number; productName: string; storeSlug: string }
}

export type StoreEventName = keyof StoreEventMap

// ── Internal buffer ────────────────────────────────────────────────────────────

const BUFFER_MAX_SIZE = 30
const BUFFER_TTL_MS = 4_000 // events older than 4 s are never replayed

interface BufferedEvent<K extends StoreEventName = StoreEventName> {
  readonly id: string
  readonly name: K
  readonly detail: StoreEventMap[K]
  readonly timestamp: number
}

// Module-level ring buffer — survives component remounts, cleared on flushBuffer()
const _buffer: BufferedEvent[] = []

function _generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function _push(event: BufferedEvent): void {
  _buffer.push(event)
  if (_buffer.length > BUFFER_MAX_SIZE) _buffer.shift() // FIFO eviction
}

// ── DOM event name helper ──────────────────────────────────────────────────────

const PREFIX = 'flowmerce:' as const

function _domKey(name: StoreEventName): string {
  return `${PREFIX}${name}`
}

// ── Public API ─────────────────────────────────────────────────────────────────

function dispatch<K extends StoreEventName>(
  name: K,
  detail: StoreEventMap[K]
): void {
  if (typeof window === 'undefined') return

  const event: BufferedEvent<K> = {
    id: _generateId(),
    name,
    detail,
    timestamp: Date.now(),
  }

  _push(event)

  window.dispatchEvent(
    new CustomEvent(_domKey(name), {
      detail: event, // wrap so the id is accessible to the listener
      bubbles: false,
      cancelable: false,
    })
  )
}

/**
 * Subscribe to a store event.
 *
 * @param name    Event name.
 * @param handler Callback — receives only the typed payload (id/timestamp are
 *                stripped; use them internally if you need dedup).
 * @returns Unsubscribe function — MUST be called in useEffect cleanup.
 *
 * @example
 *   useEffect(() => storeEvents.on('orderCreated', (d) => refresh(d.orderId)), [])
 */
function on<K extends StoreEventName>(
  name: K,
  handler: (detail: StoreEventMap[K]) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const subscribedAt = Date.now()
  const processedIds = new Set<string>()

  const listener = (e: Event) => {
    const buffered = (e as CustomEvent<BufferedEvent<K>>).detail
    if (processedIds.has(buffered.id)) return
    processedIds.add(buffered.id)
    handler(buffered.detail)
  }

  window.addEventListener(_domKey(name), listener)

  // Replay buffered events that were fired BEFORE this subscription
  // and are still within the TTL window.
  const now = Date.now()
  const toReplay = _buffer.filter(
    (ev): ev is BufferedEvent<K> =>
      ev.name === name &&
      ev.timestamp < subscribedAt && // fired before we registered
      now - ev.timestamp <= BUFFER_TTL_MS
  )

  if (toReplay.length > 0) {
    setTimeout(() => {
      for (const ev of toReplay) {
        if (!processedIds.has(ev.id)) {
          processedIds.add(ev.id)
          handler(ev.detail)
        }
      }
    }, 0)
  }

  return () => {
    window.removeEventListener(_domKey(name), listener)
    processedIds.clear()
  }
}

/** Clear all buffered events. Intended for test environments. */
function flushBuffer(): void {
  _buffer.length = 0
}

export const storeEvents = { dispatch, on, flushBuffer } as const
