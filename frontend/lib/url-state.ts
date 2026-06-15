'use client'

/**
 * Reusable URL search-parameter state hook.
 *
 * Reusable across:
 *  - Storefront product search
 *  - Dashboard / admin tables with column filters
 *  - Order history filters
 *  - Analytics date-range pickers
 *
 * Key properties:
 *  - SSR-safe: useSearchParams() is called inside a Suspense boundary at the
 *    page level — see app/store/[slug]/search/page.tsx.
 *  - Preserves unrelated params on every update.
 *  - Removes params whose value is null / undefined / '' / false.
 *  - Supports router.replace (default) and router.push for history control.
 *  - useDebouncedUrlState wraps the base hook to delay URL writes for inputs.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type UrlParamValue = string | number | boolean | null | undefined

export interface UpdateParamsOptions {
  /** Use router.push (adds to browser history) instead of router.replace. Default: replace. */
  push?: boolean
  /** Restore scroll position after navigation. Default: false. */
  scroll?: boolean
}

// ── Base hook ──────────────────────────────────────────────────────────────────

/**
 * Read and write URL search parameters.
 * Returns a stable `params` object (only a new reference when the URL actually changes)
 * and a stable `updateParams` function.
 */
export function useUrlState() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Convert ReadonlyURLSearchParams → a plain Record for easy destructuring.
  // useMemo ensures `params` keeps the same reference when searchParams haven't changed.
  const params = useMemo<Record<string, string>>(() => {
    const obj: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  }, [searchParams])

  const updateParams = useCallback(
    (
      updates: Record<string, UrlParamValue>,
      options?: UpdateParamsOptions
    ) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        // Treat null / undefined / '' / false as "remove this param"
        if (value === null || value === undefined || value === '' || value === false) {
          next.delete(key)
        } else {
          next.set(key, String(value))
        }
      }

      const qs = next.toString()
      const url = qs ? `${pathname}?${qs}` : pathname

      const scroll = options?.scroll ?? false
      if (options?.push) {
        router.push(url, { scroll })
      } else {
        router.replace(url, { scroll })
      }
    },
    [router, searchParams, pathname]
  )

  return { params, updateParams }
}

// ── Debounced variant ──────────────────────────────────────────────────────────

export interface DebouncedUrlState {
  params: Record<string, string>
  updateParams: (updates: Record<string, UrlParamValue>, opts?: UpdateParamsOptions) => void
  /** Delayed updateParams — useful for text inputs to avoid a URL write per keystroke. */
  debouncedUpdate: (updates: Record<string, UrlParamValue>, opts?: UpdateParamsOptions) => void
  /** Cancel any pending debounced update (e.g. when user submits immediately). */
  cancelDebounce: () => void
}

/**
 * Extends useUrlState with a debounced update helper.
 *
 * Usage:
 *   const { params, updateParams, debouncedUpdate, cancelDebounce } =
 *     useDebouncedUrlState(350)
 *
 *   // Text input: update after 350 ms of inactivity
 *   onChange={q => debouncedUpdate({ q })}
 *   // Submit button / Enter key: update immediately
 *   onSubmit={q => { cancelDebounce(); updateParams({ q }) }}
 */
export function useDebouncedUrlState(delayMs: number): DebouncedUrlState {
  const { params, updateParams } = useUrlState()

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Use a ref for updateParams so the debounced closure is always current
  const updateRef = useRef(updateParams)
  useEffect(() => {
    updateRef.current = updateParams
  }, [updateParams])

  const debouncedUpdate = useCallback(
    (
      updates: Record<string, UrlParamValue>,
      options?: UpdateParamsOptions
    ) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        updateRef.current(updates, options)
      }, delayMs)
    },
    [delayMs]
  )

  const cancelDebounce = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Flush/cancel on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { params, updateParams, debouncedUpdate, cancelDebounce }
}
