/**
 * Shared API contract types — the foundation for all service response shapes.
 *
 * TODO(BACKEND-INTEGRATION): These interfaces must be validated against the
 * Spring Boot global response envelope before switching to real API calls.
 * Adjust field names if the backend uses snake_case or a different envelope.
 */

// ── Generic wrappers ───────────────────────────────────────────────────────────

/** Standard single-resource response envelope. */
export interface ApiResponse<T> {
  data: T
  success: boolean
  message: string | null
  /** CON-2: the success envelope (backend ApiResponse) does not emit a timestamp — optional. */
  timestamp?: string
}

/** Standard paginated-list response envelope. */
export interface PaginatedApiResponse<T> {
  data: T[]
  pagination: ApiPaginationMeta
  success: boolean
  message: string | null
  /** CON-2: optional — only the error envelope carries a timestamp. */
  timestamp?: string
}

/** Pagination metadata as returned by the backend. */
export interface ApiPaginationMeta {
  page: number
  size: number
  total: number
  totalPages: number
  isFirst: boolean
  isLast: boolean
  /** Cursor for cursor-based pagination. TODO(BACKEND-INTEGRATION): populate from API. */
  nextCursor: string | null
  prevCursor: string | null
}

// ── Error shape ────────────────────────────────────────────────────────────────

/**
 * Error response body returned by the backend on 4xx/5xx responses.
 * Matches the existing ApiErrorResponse in types/auth.types.ts — kept separate
 * here so non-auth services can import it without circular dependency risk.
 */
export interface ApiErrorResponse {
  status: number
  error: string
  message: string
  code?: string
  path?: string
  timestamp?: string
  fieldErrors?: Record<string, string>
}

// ── Result discriminated union ─────────────────────────────────────────────────

/**
 * Discriminated union for service call return values.
 *
 * Use this pattern in services instead of throwing, so consumers can handle
 * errors with exhaustive type narrowing:
 *
 *   const result = await orderService.cancelOrder(id)
 *   if (!result.ok) { showError(result.error); return }
 *   doSomethingWith(result.data)
 */
export type ApiSuccess<T> = {
  readonly ok: true
  readonly data: T
}

export type ApiFailure = {
  readonly ok: false
  readonly error: string
  readonly status: number
  readonly code?: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

// ── Convenience constructors ───────────────────────────────────────────────────

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

export function apiFailure(error: string, status = 500, code?: string): ApiFailure {
  return { ok: false, error, status, code }
}
