/**
 * Offline mutation queue.
 *
 * When the device loses its network connection, write mutations (POST / PUT /
 * PATCH / DELETE) that fail with a network error (status 0) are stored here
 * instead of being silently dropped. When the browser fires the "online" event
 * the queue is replayed automatically.
 *
 * ## Integration
 * The http-client calls `enqueueOffline` on network-failure mutations. This
 * module handles all queue management; callers don't need to know about it.
 *
 * ## Persistence
 * The queue is written to localStorage via versioned-storage so it survives
 * page refreshes. A queued item that is still pending when the page reloads
 * will be replayed when the connection is next restored.
 *
 * ## Ordering
 * Mutations are replayed in FIFO order. If a replay call fails with a non-
 * network error (e.g. 422 Unprocessable), the item is removed from the queue —
 * it will not retry indefinitely.
 *
 * ## Limits
 * At most MAX_QUEUE_SIZE mutations are queued (oldest drop on overflow).
 */

import { readVersioned, writeVersioned, versionedSchema } from '@/lib/storage/versioned-storage'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger('offline-manager')

const MAX_QUEUE_SIZE = 50

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QueuedMutation {
  readonly id: string
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly headers: Record<string, string>
  readonly enqueuedAt: string
}

// ── Storage schema ─────────────────────────────────────────────────────────────

function isQueuedMutation(v: unknown): v is QueuedMutation {
  if (!v || typeof v !== 'object') return false
  const m = v as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    typeof m.method === 'string' &&
    typeof m.path === 'string' &&
    typeof m.enqueuedAt === 'string'
  )
}

function isMutationArray(v: unknown): v is QueuedMutation[] {
  return Array.isArray(v) && v.every(isQueuedMutation)
}

const QUEUE_SCHEMA = versionedSchema<QueuedMutation[]>({
  key: 'flowmerce_offline_queue',
  version: 1,
  validator: isMutationArray,
  defaultValue: () => [],
})

// ── Replay fn (set by http-client to avoid circular import) ───────────────────

type ReplayFn = (mutation: QueuedMutation) => Promise<boolean>
let _replayFn: ReplayFn | null = null

export function registerReplayFn(fn: ReplayFn): void {
  _replayFn = fn
}

// ── Queue state ────────────────────────────────────────────────────────────────

function loadQueue(): QueuedMutation[] {
  return readVersioned(QUEUE_SCHEMA)
}

function saveQueue(queue: QueuedMutation[]): void {
  writeVersioned(QUEUE_SCHEMA, queue)
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Add a mutation to the offline queue.
 * Called by http-client when a network error is detected.
 */
export function enqueueOffline(mutation: Omit<QueuedMutation, 'id' | 'enqueuedAt'>): void {
  const queue = loadQueue()
  const item: QueuedMutation = {
    ...mutation,
    id: generateId(),
    enqueuedAt: new Date().toISOString(),
  }

  const trimmed = queue.length >= MAX_QUEUE_SIZE
    ? queue.slice(queue.length - MAX_QUEUE_SIZE + 1)
    : queue

  saveQueue([...trimmed, item])
  log.info('mutation queued (offline)', { method: item.method, path: item.path, id: item.id })
}

/**
 * Returns a snapshot of the current queue (does not mutate state).
 */
export function getQueueSnapshot(): QueuedMutation[] {
  return loadQueue()
}

/**
 * Returns the number of pending mutations.
 */
export function getPendingCount(): number {
  return loadQueue().length
}

/**
 * Replay all queued mutations in order.
 * Called automatically when the browser comes online.
 * Can also be called manually (e.g. a "Retry" button).
 */
export async function replayQueue(): Promise<void> {
  if (!_replayFn) {
    log.warn('replayQueue called before replayFn was registered — skipping')
    return
  }

  const queue = loadQueue()
  if (queue.length === 0) return

  log.info(`replaying ${queue.length} queued mutation(s)`)

  for (const mutation of queue) {
    try {
      const ok = await _replayFn(mutation)
      if (ok) {
        dequeue(mutation.id)
        log.info('queued mutation replayed', { id: mutation.id, path: mutation.path })
      } else {
        // Non-network failure — discard; do not retry
        dequeue(mutation.id)
        log.warn('queued mutation discarded (non-network error)', { id: mutation.id })
      }
    } catch {
      // Still offline — keep in queue, stop trying for now
      log.warn('queue replay aborted — still offline', { id: mutation.id })
      break
    }
  }
}

function dequeue(id: string): void {
  const queue = loadQueue()
  saveQueue(queue.filter((m) => m.id !== id))
}

// ── Online event listener ──────────────────────────────────────────────────────

let _listenerAttached = false

export function initOfflineManager(): void {
  if (typeof window === 'undefined') return
  if (_listenerAttached) return
  _listenerAttached = true

  window.addEventListener('online', () => {
    log.info('network restored — replaying offline queue')
    replayQueue()
  })

  window.addEventListener('offline', () => {
    log.info('network lost — mutations will be queued')
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
