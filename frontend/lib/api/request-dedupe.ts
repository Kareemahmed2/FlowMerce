/**
 * In-flight request deduplication.
 *
 * Guarantees that two concurrent GET calls to the same URL share a single
 * in-flight fetch rather than each making an independent HTTP call.
 *
 * ## Guarantees
 * - Same key, same promise: all callers that arrive while a request is
 *   in-flight receive the exact same Promise (and the same resolved value).
 * - Auto-cleanup: the cache entry is removed immediately after the Promise
 *   settles, so the next call always creates a fresh request.
 * - TTL guard: if somehow a promise never settles (framework leak), an entry
 *   is evicted after MAX_TTL_MS to prevent unbounded memory growth.
 *
 * ## Key convention
 * Use `method:url` as the key — e.g. `"GET:/products/search?q=shirt"`.
 * The http-client builds this key automatically for all GET calls.
 *
 * ## Usage (direct)
 * ```ts
 * const data = await dedupeRequest('GET:/products', () => fetch('/products'))
 * ```
 */

const MAX_TTL_MS = 30_000

interface CacheEntry<T> {
  promise: Promise<T>
  timerId: ReturnType<typeof setTimeout>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _cache = new Map<string, CacheEntry<any>>()

/**
 * Execute `fn` or return the existing in-flight result for the same `key`.
 */
export function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = _cache.get(key)
  if (existing) return existing.promise as Promise<T>

  const promise = fn().finally(() => {
    const entry = _cache.get(key)
    if (entry) {
      clearTimeout(entry.timerId)
      _cache.delete(key)
    }
  })

  const timerId = setTimeout(() => {
    _cache.delete(key)
  }, MAX_TTL_MS)

  _cache.set(key, { promise, timerId })
  return promise
}

/** Current size of the in-flight cache — useful for debugging / tests. */
export function getDedupeCount(): number {
  return _cache.size
}

/** Force-clear all in-flight entries (test helper only). */
export function clearDedupeCache(): void {
  for (const entry of _cache.values()) clearTimeout(entry.timerId)
  _cache.clear()
}
