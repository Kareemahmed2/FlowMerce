'use client'

import type { OrderRow } from '@/components/merchant/orders/orders-data'
import { useEffect, useState } from 'react'
import { loadOrders, STORAGE_KEY_ORDERS } from './orders'
import type { PersistedStorePayload } from './store'
import { loadPersistedStore, STORAGE_KEY_STORE } from './store'

export function useFlowmerceStore(): PersistedStorePayload | null {
  const [store, setStore] = useState<PersistedStorePayload | null>(null)

  useEffect(() => {
    const load = () => setStore(loadPersistedStore())
    load()
    const onStore = () => load()
    window.addEventListener('flowmerce-store-updated', onStore)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY_STORE) load()
    })
    return () => {
      window.removeEventListener('flowmerce-store-updated', onStore)
    }
  }, [])

  return store
}

export function useFlowmerceOrders(): OrderRow[] {
  const [orders, setOrders] = useState<OrderRow[]>([])

  useEffect(() => {
    const load = () => setOrders(loadOrders())
    load()
    const onOrders = () => load()
    window.addEventListener('flowmerce-orders-updated', onOrders)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY_ORDERS) load()
    })
    return () => window.removeEventListener('flowmerce-orders-updated', onOrders)
  }, [])

  return orders
}
