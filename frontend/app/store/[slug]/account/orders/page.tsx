/**
 * Customer orders list page — /store/[slug]/account/orders
 *
 * Server Component (no 'use client') so it can render a <Suspense> boundary.
 * OrdersListContent calls useCustomerOrders() which internally uses
 * useSearchParams() — requires this Suspense wrapper per Next.js App Router rules.
 *
 * URL params consumed: status, sort, page, size
 * All optional; defaults applied inside useCustomerOrders.
 *
 * Direct-linkable: /store/[slug]/account/orders?status=shipped&sort=date_asc
 */

import { Suspense } from 'react'
import OrdersListContent from '@/components/store/orders/OrdersListContent'
import OrdersSkeleton from '@/components/store/orders/OrdersSkeleton'

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersListContent />
    </Suspense>
  )
}
