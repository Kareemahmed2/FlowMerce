'use client'

/**
 * Initialises cross-tab event synchronisation for the storefront.
 * Renders nothing — purely a side-effect component.
 *
 * Mounted once inside the store layout so every storefront page benefits
 * from cross-tab sync without each page opting in individually.
 */

import { useEffect } from 'react'
import { initCrossTabSync } from '@/lib/sync/cross-tab-sync'

export default function CrossTabSyncInit() {
  useEffect(() => {
    return initCrossTabSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount once — cleanup on unmount

  return null
}
