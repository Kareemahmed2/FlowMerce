'use client'

import { createContext, useContext } from 'react'

/**
 * The path prefix internal storefront links should use.
 * '' when the browser is on the store's own subdomain (jijlk.flowmerce.tech —
 * links should be root-relative, e.g. "/cart", not "/store/jijlk/cart").
 * "/store/{slug}" when accessed via the shared domain's path route
 * (flowmerce.tech/store/jijlk, or local dev with no subdomain routing).
 */
const StoreBaseCtx = createContext<string | null>(null)

export function StoreBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <StoreBaseCtx.Provider value={base}>{children}</StoreBaseCtx.Provider>
}

export function useStoreBase(): string {
  const ctx = useContext(StoreBaseCtx)
  if (ctx === null) throw new Error('useStoreBase must be used inside StoreBaseProvider')
  return ctx
}