/**
 * Lightweight request/action tracer.
 *
 * Generates a traceId per unit of async work, measures wall-clock duration,
 * and attaches trace data to logger output.
 *
 * ## Design
 * No external dependencies. Not distributed tracing (W3C traceparent) — it is
 * a local profiling and correlation aid. Each call to `trace()` is independent.
 *
 * ## Usage
 * ```ts
 * import { trace } from '@/lib/observability/tracer'
 *
 * const result = await trace('order.cancel', async () => {
 *   return orderService.cancelOrder(id)
 * }, { orderId: id })
 * ```
 *
 * ## HTTP integration
 * The HTTP client calls `startSpan` / `endSpan` around each fetch so that all
 * requests are visible in the structured logs without wrapping call sites.
 */

import { createLogger } from '@/lib/observability/logger'

const log = createLogger('tracer')

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Span {
  readonly traceId: string
  readonly operation: string
  readonly startedAt: number
  durationMs?: number
  attributes: Record<string, unknown>
  error?: string
}

// ── ID generation ──────────────────────────────────────────────────────────────

function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ── Manual span API (used by http-client) ──────────────────────────────────────

export function startSpan(operation: string, attributes?: Record<string, unknown>): Span {
  return {
    traceId: generateTraceId(),
    operation,
    startedAt: performance.now(),
    attributes: { ...attributes },
  }
}

export function endSpan(span: Span, result?: { ok: boolean; status?: number }): void {
  span.durationMs = Math.round(performance.now() - span.startedAt)

  const logData: Record<string, unknown> = {
    traceId: span.traceId,
    durationMs: span.durationMs,
    ...span.attributes,
    ...(result && { ok: result.ok, status: result.status }),
  }

  if (result?.ok === false) {
    log.warn(`${span.operation} failed`, logData)
  } else {
    log.debug(`${span.operation} completed`, logData)
  }
}

export function failSpan(span: Span, error: unknown): void {
  span.durationMs = Math.round(performance.now() - span.startedAt)
  span.error = error instanceof Error ? error.message : String(error)

  log.error(`${span.operation} threw`, {
    traceId: span.traceId,
    durationMs: span.durationMs,
    error: span.error,
    ...span.attributes,
  })
}

// ── High-level wrapper ─────────────────────────────────────────────────────────

/**
 * Wrap an async function with automatic span start/end logging.
 * Rethrows any error after logging the span failure.
 *
 * @example
 *   const result = await trace('search.execute', () => searchService.search(params, cats))
 */
export async function trace<T>(
  operation: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const span = startSpan(operation, attributes)
  log.debug(`${operation} started`, { traceId: span.traceId, ...attributes })

  try {
    const result = await fn(span)
    span.durationMs = Math.round(performance.now() - span.startedAt)
    log.debug(`${operation} done`, { traceId: span.traceId, durationMs: span.durationMs })
    return result
  } catch (err) {
    failSpan(span, err)
    throw err
  }
}
