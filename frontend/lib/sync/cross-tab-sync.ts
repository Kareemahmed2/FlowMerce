/**
 * Cross-tab synchronisation layer.
 *
 * Bridges storeEvents across browser tabs so that:
 *   - Adding to wishlist in tab A updates the wishlist icon in tab B.
 *   - Placing an order in tab A refreshes the orders list in tab B.
 *   - Clearing the cart in tab A reflects in tab B.
 *
 * ## Strategy
 * Primary:  BroadcastChannel API (all modern browsers ≥ 2020).
 * Fallback: localStorage "storage" event (triggers on write in OTHER tabs).
 *
 * ## Loop prevention
 * The `_receiving` flag marks dispatches that originated from another tab.
 * When the storeEvents listener sees `_receiving === true`, it skips the
 * re-broadcast to prevent an infinite cross-tab relay.
 *
 * ## Integration
 * Call initCrossTabSync() inside a useEffect in any long-lived client
 * component (e.g. WishlistProvider, a dedicated CrossTabSyncInit component).
 * It returns the cleanup function — pass directly to the useEffect return.
 *
 * @example
 *   useEffect(() => initCrossTabSync(), [])
 */

import { storeEvents } from '@/lib/store-events'
import type { StoreEventMap, StoreEventName } from '@/lib/store-events'

// Events to synchronise. productViewed is intentionally excluded — it would
// cause the recently-viewed list to update in every open tab on every navigation.
const SYNCED_EVENTS: StoreEventName[] = [
  'wishlistUpdated',
  'orderCreated',
  'cartUpdated',
]

const CHANNEL_NAME = 'flowmerce_sync'
const LS_FALLBACK_KEY = 'flowmerce_sync_event'

interface SyncMessage {
  name: StoreEventName
  detail: StoreEventMap[StoreEventName]
  id: string
  ts: number
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Initialise cross-tab synchronisation.
 * @returns Cleanup function for useEffect.
 */
export function initCrossTabSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  let _receiving = false
  const unsubs: Array<() => void> = []

  // ── Helper: receive a message from another tab and relay locally ─────────────

  function receiveFromOtherTab(raw: unknown): void {
    try {
      const msg = raw as SyncMessage
      if (!SYNCED_EVENTS.includes(msg.name)) return
      _receiving = true
      try {
        storeEvents.dispatch(
          msg.name,
          msg.detail as StoreEventMap[typeof msg.name]
        )
      } finally {
        _receiving = false
      }
    } catch {
      // Ignore malformed messages
    }
  }

  // ── BroadcastChannel (primary) ────────────────────────────────────────────────

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME)

    const onMessage = (e: MessageEvent) => receiveFromOtherTab(e.data)
    channel.addEventListener('message', onMessage)

    // Subscribe to local events and broadcast them to other tabs
    for (const name of SYNCED_EVENTS) {
      const unsub = storeEvents.on(name, (detail) => {
        if (_receiving) return // don't re-broadcast received events
        const msg: SyncMessage = { name, detail, id: generateId(), ts: Date.now() }
        channel.postMessage(msg)
      })
      unsubs.push(unsub)
    }

    return () => {
      channel.removeEventListener('message', onMessage)
      channel.close()
      unsubs.forEach((u) => u())
    }
  }

  // ── localStorage fallback ─────────────────────────────────────────────────────

  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_FALLBACK_KEY || !e.newValue) return
    try {
      receiveFromOtherTab(JSON.parse(e.newValue))
    } catch { /* ignore */ }
  }
  // Cast to Window: TS narrows the type in the else branch of the
  // BroadcastChannel check, but the global is still a valid Window.
  ;(window as Window & typeof globalThis).addEventListener('storage', onStorage)

  const recentMsgIds = new Set<string>()

  for (const name of SYNCED_EVENTS) {
    const unsub = storeEvents.on(name, (detail) => {
      if (_receiving) return
      const msg: SyncMessage = { name, detail, id: generateId(), ts: Date.now() }
      if (recentMsgIds.has(msg.id)) return
      recentMsgIds.add(msg.id)
      // Write the event; other tabs detect it via the "storage" event
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(msg))
      // Remove after a tick so repeated writes still trigger the storage event
      setTimeout(() => {
        localStorage.removeItem(LS_FALLBACK_KEY)
        recentMsgIds.delete(msg.id)
      }, 200)
    })
    unsubs.push(unsub)
  }

  return () => {
    window.removeEventListener('storage', onStorage)
    unsubs.forEach((u) => u())
  }
}
