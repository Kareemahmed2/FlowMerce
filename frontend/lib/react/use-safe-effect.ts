'use client'

/**
 * useSafeEffect — useEffect wrapper that provides an isMounted() guard.
 *
 * Prevents the classic "setState after unmount" warning in async effects.
 * The cleanup function automatically sets mounted = false before the
 * optional user-provided cleanup runs, so components never need to manage
 * their own mounted ref.
 *
 * ## StrictMode safety
 * In React StrictMode (development), effects run twice. The mounted flag is
 * reset to true on each mount, so the guard works correctly on both runs.
 *
 * ## Usage
 * ```ts
 * useSafeEffect((isMounted) => {
 *   fetchData().then((data) => {
 *     if (!isMounted()) return  // component unmounted while fetching
 *     setData(data)
 *   })
 * }, [dependency])
 * ```
 *
 * ## With cleanup
 * ```ts
 * useSafeEffect((isMounted) => {
 *   const timer = setInterval(() => {
 *     if (isMounted()) setTick((t) => t + 1)
 *   }, 1000)
 *   return () => clearInterval(timer)
 * }, [])
 * ```
 */

import { useEffect, type DependencyList } from 'react'

export type SafeEffectCallback = (isMounted: () => boolean) => void | (() => void)

export function useSafeEffect(callback: SafeEffectCallback, deps: DependencyList): void {
  useEffect(() => {
    let mounted = true
    const isMounted = () => mounted

    const cleanup = callback(isMounted)

    return () => {
      mounted = false
      if (typeof cleanup === 'function') cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
