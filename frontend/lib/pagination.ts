/**
 * Shared pagination utilities.
 *
 * Reusable across storefront search, admin tables, order history, analytics.
 * Cursor-ready architecture for future backend cursor-based pagination.
 */

export const DEFAULT_PAGE_SIZE = 12
export const ALLOWED_PAGE_SIZES = [12, 24, 48] as const
export type AllowedPageSize = (typeof ALLOWED_PAGE_SIZES)[number]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  /** Current page, 1-indexed. */
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  isFirst: boolean
  isLast: boolean
  /** 1-based index of the first item shown on this page (0 when empty). */
  startIndex: number
  /** 1-based index of the last item shown on this page (0 when empty). */
  endIndex: number
  /**
   * Cursor fields — reserved for cursor-based pagination.
   * TODO(BACKEND-INTEGRATION): Populate from the backend pagination envelope
   * { nextCursor, prevCursor } once cursor-based navigation is implemented.
   */
  nextCursor: string | null
  prevCursor: string | null
}

// ── Normalizers ────────────────────────────────────────────────────────────────

/**
 * Clamp a raw page value to a valid 1-based integer.
 * Respects an optional totalPages ceiling.
 */
export function normalizePage(
  raw: string | number | null | undefined,
  totalPages?: number
): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : (raw ?? 1)
  if (!Number.isFinite(n) || n < 1) return 1
  if (totalPages !== undefined) return Math.min(n, Math.max(1, totalPages))
  return n
}

/**
 * Validate a raw page size against the allowed list.
 * Silently falls back to DEFAULT_PAGE_SIZE for invalid values.
 */
export function normalizePageSize(
  raw: string | number | null | undefined
): AllowedPageSize {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : (raw ?? DEFAULT_PAGE_SIZE)
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n)
    ? (n as AllowedPageSize)
    : DEFAULT_PAGE_SIZE
}

// ── Meta builder ───────────────────────────────────────────────────────────────

/** Compute a complete PaginationMeta from the three core values. */
export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIndex = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems)

  return {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    isFirst: safePage === 1,
    isLast: safePage >= totalPages,
    startIndex,
    endIndex,
    nextCursor: null,
    prevCursor: null,
  }
}

// ── In-memory paginator ────────────────────────────────────────────────────────

/** Slice an in-memory array to only the items belonging to the given page. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(1, page) - 1) * pageSize
  return items.slice(start, start + pageSize)
}

// ── Page-number generator (for pagination UI) ──────────────────────────────────

/**
 * Return the list of page numbers (and '...' ellipsis markers) to render.
 * Always includes page 1 and the last page; shows at most 7 items total.
 *
 * e.g. current=5, total=10 → [1, '...', 4, 5, 6, '...', 10]
 */
export function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)

  return pages
}
