/**
 * Shared error utilities for all auth and API interactions.
 *
 * Provides a single parsing path so every page extracts errors the same way,
 * whether they come from the mock service or the real backend.
 *
 * TODO(BACKEND-INTEGRATION): The real backend returns:
 *   { status, error, message, code, path, fieldErrors? }
 * This parser handles that shape automatically.
 */

import type { ApiErrorResponse } from '@/types/auth.types'

// ─── Normalised shape every page consumes ────────────────────────────────────

export interface NormalizedError {
  /** Human-readable message, safe to show in the UI */
  message: string
  /** HTTP-equivalent status code */
  status: number
  /** Machine-readable code from backend (e.g. "CONFLICT", "NOT_FOUND") */
  code?: string
  /** Per-field validation errors from backend (field → message map) */
  fieldErrors?: Record<string, string>
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Normalise anything thrown by a service call into a consistent shape.
 *
 * Priority order:
 *  1. Backend ApiErrorResponse (has `.status` + `.message` as plain object)
 *  2. Error with attached `.status` property (from mockError helper)
 *  3. Plain Error with just `.message`
 *  4. Unknown — generic fallback
 */
export function parseAuthError(err: unknown): NormalizedError {
  if (err === null || err === undefined) {
    return { message: 'Something went wrong. Please try again.', status: 500 }
  }

  // Backend ApiErrorResponse arrives as a parsed JSON object (not an Error instance)
  if (typeof err === 'object' && !(err instanceof Error)) {
    const e = err as Partial<ApiErrorResponse>
    if (e.status && e.message) {
      return {
        message: e.message,
        status: e.status,
        code: e.code,
        fieldErrors: e.fieldErrors,
      }
    }
  }

  // Error instance (mock errors + network errors)
  if (err instanceof Error) {
    const withStatus = err as Error & { status?: number }
    return {
      message: err.message || 'Something went wrong. Please try again.',
      status: withStatus.status ?? 500,
    }
  }

  // String thrown directly
  if (typeof err === 'string') {
    return { message: err, status: 500 }
  }

  return { message: 'Something went wrong. Please try again.', status: 500 }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true for errors that warrant showing the "request new link" prompt */
export function isExpiredTokenError(err: NormalizedError): boolean {
  return err.status === 400 || err.status === 410
}

/** Returns true for conflict errors (e.g. email already exists) */
export function isConflictError(err: NormalizedError): boolean {
  return err.status === 409
}
