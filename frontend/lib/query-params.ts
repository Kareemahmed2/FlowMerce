/**
 * Reusable URL query-parameter parsing and serialization utilities.
 *
 * Pure functions — no React, no browser globals, fully unit-testable.
 *
 * Reusable across:
 *  - Storefront search
 *  - Admin / dashboard tables
 *  - Order history filters
 *  - Analytics date-range pickers
 */

// ── Numeric parsers ────────────────────────────────────────────────────────────

/** Parse a query param string as a safe integer. Returns fallback on missing/NaN/Infinity. */
export function parseQueryInt(
  value: string | null | undefined,
  fallback: number,
  options?: { min?: number; max?: number }
): number {
  if (value == null || value === '') return fallback
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  if (options?.min !== undefined && n < options.min) return options.min
  if (options?.max !== undefined && n > options.max) return options.max
  return n
}

/** Parse a query param string as a safe float. Returns fallback on missing/NaN/Infinity. */
export function parseQueryFloat(
  value: string | null | undefined,
  fallback: number,
  options?: { min?: number; max?: number }
): number {
  if (value == null || value === '') return fallback
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return fallback
  if (options?.min !== undefined && n < options.min) return options.min
  if (options?.max !== undefined && n > options.max) return options.max
  return n
}

// ── Boolean parser ─────────────────────────────────────────────────────────────

/**
 * Parse a query param string as a boolean.
 * 'true' | '1' | 'yes' → true  |  'false' | '0' | 'no' → false  |  else → fallback
 */
export function parseQueryBool(
  value: string | null | undefined,
  fallback: boolean
): boolean {
  if (value == null) return fallback
  const lower = value.toLowerCase()
  if (lower === 'true' || lower === '1' || lower === 'yes') return true
  if (lower === 'false' || lower === '0' || lower === 'no') return false
  return fallback
}

// ── String parser ──────────────────────────────────────────────────────────────

/**
 * Parse a query param string, trimming whitespace and enforcing a max length.
 * Returns fallback for missing, empty, or whitespace-only values.
 */
export function parseQueryString(
  value: string | null | undefined,
  fallback: string,
  maxLength = 500
): string {
  if (value == null) return fallback
  const trimmed = value.trim().slice(0, maxLength)
  return trimmed || fallback
}

// ── Enum parser ────────────────────────────────────────────────────────────────

/**
 * Validate a query param string against a finite set of allowed values.
 * Returns fallback when the value is absent or not in the allowed set.
 */
export function parseQueryEnum<T extends string>(
  value: string | null | undefined,
  validValues: readonly T[],
  fallback: T
): T {
  if (value == null) return fallback
  return (validValues as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

// ── Array parser ───────────────────────────────────────────────────────────────

/**
 * Parse a delimited query param string as an array of non-empty strings.
 * e.g. parseQueryArray('a,b,,c') → ['a', 'b', 'c']
 */
export function parseQueryArray(
  value: string | null | undefined,
  separator = ','
): string[] {
  if (value == null || value === '') return []
  return value.split(separator).map((s) => s.trim()).filter(Boolean)
}

// ── Serialization helpers ──────────────────────────────────────────────────────

/**
 * Build a URLSearchParams from a plain object, omitting null / undefined / '' / false
 * values so the resulting URL stays clean.
 */
export function buildSearchParams(
  params: Record<string, string | number | boolean | null | undefined>
): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || value === false) continue
    sp.set(key, String(value))
  }
  return sp
}

/**
 * Return a new object with null / undefined / empty-string values removed.
 * Useful for cleaning filter objects before serializing to the URL.
 */
export function cleanParams<T extends Record<string, unknown>>(
  params: T
): { [K in keyof T]?: NonNullable<T[K]> } {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value
    }
  }
  return result as { [K in keyof T]?: NonNullable<T[K]> }
}
