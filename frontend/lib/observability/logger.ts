/**
 * Structured logger — thin wrapper around console that emits JSON-style entries.
 *
 * ## Features
 * - Four log levels: debug / info / warn / error
 * - Global context bag (slug, sessionId, etc.) attached to every entry
 * - createLogger(scope) produces a namespaced sub-logger
 * - Optional remote hook (noop by default) for sending logs to a backend
 * - Level gate: only entries ≥ minLevel are emitted (default: 'info' in prod, 'debug' in dev)
 *
 * ## Usage
 * ```ts
 * import { logger, createLogger } from '@/lib/observability/logger'
 *
 * logger.info('cart updated', { itemCount: 3 })
 *
 * const log = createLogger('wishlist')
 * log.warn('add failed', { productId: 42, error: 'timeout' })
 * ```
 *
 * ## Remote logging
 * ```ts
 * logger.setRemoteHook((entry) => fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) }))
 * ```
 *
 * ## Store context
 * ```ts
 * logger.setContext({ slug: 'my-store', sessionId: 'abc123' })
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  readonly level: LogLevel
  readonly scope: string
  readonly message: string
  readonly timestamp: string
  readonly context: Record<string, unknown>
  readonly data?: unknown
}

export type RemoteLogFn = (entry: LogEntry) => void

// ── Level ordering ─────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// ── Global state ───────────────────────────────────────────────────────────────

const _globalContext: Record<string, unknown> = {}
let _remoteHook: RemoteLogFn | null = null

// 'debug' in dev, 'info' in production
const _defaultMinLevel: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug'
let _minLevel: LogLevel = _defaultMinLevel

// ── Core emit ──────────────────────────────────────────────────────────────────

function emit(level: LogLevel, scope: string, message: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[_minLevel]) return

  const entry: LogEntry = {
    level,
    scope,
    message,
    timestamp: new Date().toISOString(),
    context: { ..._globalContext },
    ...(data !== undefined && { data }),
  }

  // ── Console output ─────────────────────────────────────────────────────────
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${scope}]`
  const consoleFn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : level === 'debug' ? console.debug
    : console.info

  if (data !== undefined) {
    consoleFn(prefix, message, data)
  } else {
    consoleFn(prefix, message)
  }

  // ── Remote hook (fire-and-forget, never throws) ───────────────────────────
  if (_remoteHook) {
    try {
      _remoteHook(entry)
    } catch {
      // Swallow — remote logging must never affect the application
    }
  }
}

// ── ScopedLogger factory ───────────────────────────────────────────────────────

export interface ScopedLogger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export function createLogger(scope: string): ScopedLogger {
  return {
    debug: (msg, data) => emit('debug', scope, msg, data),
    info: (msg, data) => emit('info', scope, msg, data),
    warn: (msg, data) => emit('warn', scope, msg, data),
    error: (msg, data) => emit('error', scope, msg, data),
  }
}

// ── Root logger ────────────────────────────────────────────────────────────────

export const logger = {
  ...createLogger('app'),

  /** Merge additional fields into every subsequent log entry's context. */
  setContext(ctx: Record<string, unknown>): void {
    Object.assign(_globalContext, ctx)
  },

  /** Remove a previously set context field. */
  clearContext(key: string): void {
    delete _globalContext[key]
  },

  /** Replace the global context entirely. */
  replaceContext(ctx: Record<string, unknown>): void {
    for (const k of Object.keys(_globalContext)) delete _globalContext[k]
    Object.assign(_globalContext, ctx)
  },

  /** Register a remote sink. Pass null to remove it. */
  setRemoteHook(fn: RemoteLogFn | null): void {
    _remoteHook = fn
  },

  /** Override the minimum log level at runtime. */
  setMinLevel(level: LogLevel): void {
    _minLevel = level
  },

  /** Reset min level to environment default. */
  resetMinLevel(): void {
    _minLevel = _defaultMinLevel
  },
}
