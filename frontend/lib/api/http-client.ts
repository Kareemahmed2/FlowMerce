/**
 * HTTP client abstraction — the single integration point between the frontend
 * and the backend REST API.
 *
 * ## Mock mode (default)
 * When NEXT_PUBLIC_API_URL is not set, isMockMode === true.
 * In mock mode, all calls resolve immediately with apiSuccess(empty data) so
 * services can use optimistic-update patterns without a real server.
 * The existing service mock implementations remain active and unchanged.
 *
 * ## Live mode
 * Set NEXT_PUBLIC_API_URL=https://api.flowmerce.io/api/v1 in .env.production.
 * Every service call will hit the real backend; mock logic is bypassed.
 *
 * ## Backend swap: ONE environment-variable change
 * NEXT_PUBLIC_API_URL="" (unset or empty) → mock mode
 * NEXT_PUBLIC_API_URL="https://..." → live mode
 * No service, hook, component, or page code changes required.
 *
 * ## Interceptors
 * Request interceptors: add auth headers, correlation IDs, etc.
 * Response interceptors: handle 401 → redirect to login, normalise envelopes, etc.
 *
 * ## Retry
 * - Up to 2 retries (3 total attempts) with exponential backoff: 300 → 600ms.
 * - GET: retries on 5xx responses OR network errors (status 0).
 * - Mutations (POST/PUT/PATCH/DELETE): retries on network errors only.
 * - 4xx responses are never retried.
 *
 * ## Deduplication
 * Concurrent GET requests with the same path share a single in-flight fetch.
 * Resolved automatically — callers don't need to be aware.
 *
 * ## Offline queue
 * Mutations that fail with a network error when offline are queued in
 * offline-manager and replayed when the device comes back online.
 *
 * ## TODO(BACKEND-INTEGRATION)
 * Wire up the auth token interceptor once login is implemented:
 *
 *   httpClient.addRequestInterceptor((cfg) => ({
 *     ...cfg,
 *     headers: { ...cfg.headers, Authorization: `Bearer ${getAccessToken()}` },
 *   }))
 */

import { apiSuccess, apiFailure } from '@/types/api.types'
import type { ApiResult } from '@/types/api.types'
import { dedupeRequest } from '@/lib/api/request-dedupe'
import { startSpan, endSpan, failSpan } from '@/lib/observability/tracer'
import {
  enqueueOffline,
  initOfflineManager,
  registerReplayFn,
} from '@/lib/sync/offline-manager'
import type { QueuedMutation } from '@/lib/sync/offline-manager'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger('http-client')

// ── Configuration ──────────────────────────────────────────────────────────────

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
const BASE_URL = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL.slice(0, -1) : RAW_BASE_URL

export const isMockMode: boolean = false

const DEFAULT_TIMEOUT_MS = 12_000

const MAX_RETRIES = 2
const RETRY_BASE_MS = 300

// ── Interceptor types ──────────────────────────────────────────────────────────

export interface RequestConfig {
  readonly url: string
  readonly method: string
  readonly headers: Record<string, string>
  readonly body?: string
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export type RequestInterceptorFn = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>

export type ResponseInterceptorFn = <T>(
  result: ApiResult<T>,
  config: RequestConfig
) => ApiResult<T> | Promise<ApiResult<T>>

// ── Interceptor registry ───────────────────────────────────────────────────────

const _reqInterceptors: RequestInterceptorFn[] = []
const _resInterceptors: ResponseInterceptorFn[] = []

/**
 * Register a request interceptor. Returns an unsubscribe function.
 *
 * @example Auth header injection:
 *   httpClient.addRequestInterceptor((cfg) => ({
 *     ...cfg,
 *     headers: { ...cfg.headers, Authorization: `Bearer ${token}` },
 *   }))
 */
function addRequestInterceptor(fn: RequestInterceptorFn): () => void {
  _reqInterceptors.push(fn)
  return () => {
    const idx = _reqInterceptors.indexOf(fn)
    if (idx !== -1) _reqInterceptors.splice(idx, 1)
  }
}

/**
 * Register a response interceptor. Returns an unsubscribe function.
 *
 * @example Redirect on 401:
 *   httpClient.addResponseInterceptor((result) => {
 *     if (!result.ok && result.status === 401) router.push('/login')
 *     return result
 *   })
 */
function addResponseInterceptor(fn: ResponseInterceptorFn): () => void {
  _resInterceptors.push(fn)
  return () => {
    const idx = _resInterceptors.indexOf(fn)
    if (idx !== -1) _resInterceptors.splice(idx, 1)
  }
}

// ── Retry helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(method: string, result: ApiResult<unknown>, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false
  if (!result.ok) {
    const isGet = method === 'GET'
    const isNetworkError = result.status === 0
    const isServerError = result.status >= 500
    if (isGet && (isNetworkError || isServerError)) return true
    if (!isGet && isNetworkError) return true
  }
  return false
}

// ── Core fetch (single attempt) ────────────────────────────────────────────────

async function fetchOnce<T>(config: RequestConfig): Promise<ApiResult<T>> {
  const controller = new AbortController()
  const effectiveTimeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout)

  // Merge provided signal (if any) with our timeout signal
  const signal = config.signal
    ? anySignal([config.signal, controller.signal])
    : controller.signal

  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.body,
      signal,
      // SEC-6: send httpOnly auth cookies automatically on every request.
      credentials: 'include',
    })
    clearTimeout(timeoutId)

    let parsed: unknown = null
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        parsed = await response.json()
      } catch {
        parsed = null
      }
    }

    if (response.ok) {
      const data =
        parsed !== null &&
        typeof parsed === 'object' &&
        'data' in (parsed as Record<string, unknown>)
          ? (parsed as Record<string, unknown>).data
          : parsed
      return apiSuccess(data as T)
    }

    const errBody = parsed as Partial<{ message: string; error: string; code: string }> | null
    const message =
      errBody?.message ?? errBody?.error ?? response.statusText ?? 'Request failed'
    return apiFailure(message, response.status, errBody?.code)
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      return apiFailure(`Request timed out after ${effectiveTimeout}ms`, 408)
    }
    const message = err instanceof Error ? err.message : 'Network error'
    return apiFailure(message, 0)
  }
}

// ── Core request (with retry + interceptors + tracing) ─────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  timeoutMs?: number
): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${path}`
  const span = startSpan(`http.${method.toLowerCase()}`, { url, method })

  let config: RequestConfig = {
    url,
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    timeoutMs,
  }

  // Apply request interceptors
  for (const interceptor of _reqInterceptors) {
    config = await interceptor(config)
  }

  // ── Retry loop ────────────────────────────────────────────────────────────
  let result: ApiResult<T> = apiFailure('Not started', 0)
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1)
      log.info(`retrying ${method} ${path} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`, { delay })
      await sleep(delay)
    }

    result = await fetchOnce<T>(config)

    if (!shouldRetry(method, result, attempt)) break
  }

  // ── Offline queue for failed mutations ────────────────────────────────────
  if (!result.ok && result.status === 0 && method !== 'GET') {
    enqueueOffline({
      method,
      path,
      body,
      headers: config.headers,
    })
    log.warn(`${method} ${path} queued for offline replay`)
  }

  // Apply response interceptors
  for (const interceptor of _resInterceptors) {
    result = await interceptor(result, config)
  }

  endSpan(span, { ok: result.ok, status: result.ok ? 200 : result.status })

  return result
}

// ── Replay handler for offline-manager ────────────────────────────────────────

async function replayMutation(mutation: QueuedMutation): Promise<boolean> {
  const result = await fetchOnce({
    url: `${BASE_URL}${mutation.path}`,
    method: mutation.method.toUpperCase(),
    headers: mutation.headers,
    body: mutation.body !== undefined ? JSON.stringify(mutation.body) : undefined,
  })
  if (!result.ok && result.status === 0) throw new Error('Still offline')
  return result.ok
}

// ── Bootstrap offline listener ─────────────────────────────────────────────────
// Only in browser context — SSR has no window
if (typeof window !== 'undefined') {
  registerReplayFn(replayMutation)
  initOfflineManager()
}

// ── anySignal helper ──────────────────────────────────────────────────────────
// Combines multiple AbortSignals so the first one to abort cancels the fetch.

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}

// ── Public convenience methods ─────────────────────────────────────────────────

export const httpClient = {
  isMockMode,

  get<T>(path: string, headers?: Record<string, string>, timeoutMs?: number): Promise<ApiResult<T>> {
    const key = `GET:${BASE_URL}${path}`
    return dedupeRequest(key, () => request<T>('GET', path, undefined, headers, timeoutMs))
  },

  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResult<T>> {
    return request<T>('POST', path, body, headers)
  },

  put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResult<T>> {
    return request<T>('PUT', path, body, headers)
  },

  patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResult<T>> {
    return request<T>('PATCH', path, body, headers)
  },

  delete<T>(path: string, headers?: Record<string, string>): Promise<ApiResult<T>> {
    return request<T>('DELETE', path, undefined, headers)
  },

  addRequestInterceptor,
  addResponseInterceptor,
} as const
