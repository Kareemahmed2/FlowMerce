'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { CatalogCategory, CatalogProduct } from '@/components/merchant/onboarding/types'
import { normalizeStorefrontColors } from '@/components/merchant/onboarding/types'
import { storefrontService } from '@/services/storefront.service'
import { cartService } from '@/services/cart.service'
import { useStoreData } from '@/hooks/useStore'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { useSafeEffect } from '@/lib/react/use-safe-effect'
import type { CartItem, CartState, StoreData } from './store-types'

/* ───────── Context ───────── */
const StoreCtx = createContext<StoreData | null>(null)
const CartCtx = createContext<CartState | null>(null)

export const useStore = () => {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}

export const useCart = () => {
  const ctx = useContext(CartCtx)
  if (!ctx) throw new Error('useCart must be inside StoreProvider')
  return ctx
}

/* ───────── Provider ───────── */
export default function StoreProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const auth = useCustomerAuth()
  const { storeId, storefront, isLoading: storeLoading, error: storeError, refresh } = useStoreData(slug)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const [storeData, setStoreData] = useState<StoreData | null>(null)

  // ── Assemble store data once storeId + storefront resolve ──────────────────
  useSafeEffect((isMounted) => {
    if (!storeId || !storefront) return

    Promise.all([
      storefrontService.getPublicCategories(storeId),
      storefrontService.getPublicProducts(storeId),
    ]).then(([catsResult, prodsResult]) => {
      if (!isMounted()) return

      const cats = catsResult.ok ? catsResult.data : []
      const prods = prodsResult.ok ? prodsResult.data : []

      const mapProduct = (p: unknown): CatalogProduct => {
        const prod = p as { productId?: number; id?: number; inventory?: number; stock?: number; images?: string[]; name: string; price: unknown; description?: string | null }
        return {
          id: prod.productId ?? prod.id ?? 0,
          name: prod.name,
          price: String(prod.price),
          description: prod.description ?? '',
          images: prod.images ?? [],
          stock: prod.inventory ?? prod.stock,
        }
      }

      let categories: CatalogCategory[] = cats.map((cat) => {
        const catId = (cat as { categoryId?: number; id?: number }).categoryId ?? (cat as { id?: number }).id ?? 0
        return {
          id: catId,
          name: cat.name,
          products: prods
            .filter((p) => (p as { categoryId?: number | null }).categoryId === catId)
            .map(mapProduct),
        }
      })

      // Products with null/missing categoryId — collect them
      const uncategorizedProds = prods.filter(
        (p) => !(p as { categoryId?: number | null }).categoryId
      )

      // If no categories at all, show all products in one group
      if (categories.length === 0 && prods.length > 0) {
        categories = [{ id: 0, name: 'All Products', products: prods.map(mapProduct) }]
      } else if (uncategorizedProds.length > 0) {
        // Add uncategorized products to an "Other" group
        categories = [...categories, { id: 0, name: 'Other', products: uncategorizedProds.map(mapProduct) }]
      }

      setStoreData({
        storeId,
        brandName: storefront.brandName,
        logoPreview: storefront.logoUrl ?? null,
        categories,
        colors: normalizeStorefrontColors(storefront.colors),
        payment: Array.isArray(storefront.paymentMethods) ? storefront.paymentMethods : [],
        storeUrl: storefront.storeUrl,
        pages: storefront.pages,  // FEAT-RENDER: published component tree
      })
    })
  }, [storeId, storefront])

  // Re-fetch (bypassing cache) when merchant dashboard saves the store
  useSafeEffect(() => {
    const handler = () => {
      setStoreData(null)
      refreshRef.current(true) // force = true → skip sessionStorage cache
    }
    window.addEventListener('flowmerce-store-updated', handler)
    return () => window.removeEventListener('flowmerce-store-updated', handler)
  }, [])

  /* ── cart ── */
  const [items, setItems] = useState<CartItem[]>([])
  const itemsRef = useRef<CartItem[]>(items)
  itemsRef.current = items
  const authRef = useRef(auth)
  authRef.current = auth
  const storeDataRef = useRef(storeData)
  storeDataRef.current = storeData
  // INT-31: track productIds whose addItem POST is still in-flight so
  // removeItem/updateQuantity can await the cartItemId before acting.
  const pendingAddRef = useRef<Map<number, Promise<void>>>(new Map())

  // Hydrate cart from backend on login
  useSafeEffect((isMounted) => {
    const currentStoreId = storeData?.storeId
    if (!auth.isLoggedIn || !auth.isHydrated || !currentStoreId) return

    cartService.getCart(currentStoreId, auth.getAuthHeader()).then((result) => {
      if (!isMounted() || !result.ok || result.data.items.length === 0) return

      const categories = storeData?.categories ?? []
      const mergedItems: CartItem[] = result.data.items.map((bi) => {
        for (const cat of categories) {
          const p = cat.products.find((pr) => pr.id === bi.productId)
          if (p) return { product: p, categoryName: cat.name, quantity: bi.quantity, cartItemId: bi.cartItemId, priceAtAdd: bi.priceAtAdd }
        }
        return {
          product: {
            id: bi.productId,
            name: bi.productName,
            price: String(bi.priceAtAdd),
            description: '',
            images: bi.productImage ? [bi.productImage] : [],
          },
          categoryName: '',
          quantity: bi.quantity,
          cartItemId: bi.cartItemId,
          priceAtAdd: bi.priceAtAdd,
        }
      })
      setItems(mergedItems)
    })
  }, [auth.isLoggedIn, auth.isHydrated, storeData?.storeId])

  const addItem = useCallback((product: CatalogProduct, categoryName: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { product, categoryName, quantity: 1 }]
    })

    // Backend sync — track the promise so removeItem/updateQuantity can await it.
    const { isLoggedIn, getAuthHeader } = authRef.current
    const sid = storeDataRef.current?.storeId
    if (isLoggedIn && sid) {
      const addPromise = cartService.addItem(
        {
          productId: product.id,
          storeId: sid,
          quantity: 1,
          productName: product.name,
          productImage: product.images[0] ?? null,
          priceAtAdd: parseFloat(product.price || '0'),
        },
        getAuthHeader()
      ).then((result) => {
        if (!result.ok) return
        const backendItem = result.data.items.find((bi) => bi.productId === product.id)
        if (!backendItem) return
        // INT-29: lock priceAtAdd from the backend so the cart total uses
        // the price at the moment the item was added.
        setItems((prev) =>
          prev.map((item) =>
            item.product.id === product.id
              ? { ...item, cartItemId: backendItem.cartItemId, priceAtAdd: backendItem.priceAtAdd }
              : item
          )
        )
      }).finally(() => {
        pendingAddRef.current.delete(product.id)
      })
      pendingAddRef.current.set(product.id, addPromise)
    }
  }, [])

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))

    const { isLoggedIn, getAuthHeader } = authRef.current
    // INT-31: if the addItem POST is still in-flight, wait for cartItemId before DELETE.
    const pending = pendingAddRef.current.get(productId)
    const doRemove = () => {
      const item = itemsRef.current.find((i) => i.product.id === productId)
      if (isLoggedIn && item?.cartItemId) {
        cartService.removeItem(item.cartItemId, getAuthHeader())
      }
    }
    if (pending) { pending.then(doRemove) } else { doRemove() }
  }, [])

  const updateQuantity = useCallback((productId: number, qty: number) => {
    if (qty < 1) return removeItem(productId)
    const item = itemsRef.current.find((i) => i.product.id === productId)
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    )

    const { isLoggedIn, getAuthHeader } = authRef.current
    // INT-31: await pending addItem before updating.
    const pending = pendingAddRef.current.get(productId)
    const doUpdate = () => {
      const latestItem = itemsRef.current.find((i) => i.product.id === productId)
      if (isLoggedIn && latestItem?.cartItemId) {
        cartService.updateItem(latestItem.cartItemId, { quantity: qty }, getAuthHeader())
      }
    }
    if (pending) { pending.then(doUpdate) } else { doUpdate() }
  }, [removeItem])

  const clearCart = useCallback(() => {
    setItems([])

    const { isLoggedIn, getAuthHeader } = authRef.current
    const sid = storeDataRef.current?.storeId
    if (isLoggedIn && sid) {
      cartService.clearCart(sid, getAuthHeader())
    }
  }, [])

  const cart: CartState = useMemo(() => {
    const itemCount = items.reduce((s, i) => s + i.quantity, 0)
    const subtotal = items.reduce((s, i) => s + parseFloat(i.product.price || '0') * i.quantity, 0)
    return { items, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal }
  }, [items, addItem, removeItem, updateQuantity, clearCart])

  /* ── error state (slug not found or backend unreachable) ── */
  if (!storeLoading && storeError && !storeData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Store unavailable</h2>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
            {storeError || "The store you're looking for doesn't exist or is unavailable."}
          </p>
          <a href="/" style={{ display: 'inline-block', background: '#111', color: '#fff', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Go home
          </a>
        </div>
      </div>
    )
  }

  /* ── loading ── */
  if (!storeData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#666', fontSize: 14 }}>Loading store…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <StoreCtx.Provider value={storeData}>
      <CartCtx.Provider value={cart}>
        {children}
      </CartCtx.Provider>
    </StoreCtx.Provider>
  )
}
