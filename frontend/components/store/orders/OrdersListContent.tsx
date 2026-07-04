'use client'

/**
 * Inner client component for the orders list page.
 * Separated so the server page.tsx can wrap it in <Suspense>,
 * satisfying Next.js's requirement for useSearchParams().
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from '@/components/store/StoreProvider'
import { useStoreBase } from '@/components/store/StoreBaseProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { useCustomerOrders } from '@/hooks/useCustomerOrders'
import OrderCard from './OrderCard'
import OrderFilters from './OrderFilters'
import OrdersPagination from './OrdersPagination'
import EmptyOrdersState from './EmptyOrdersState'
import { textOnBg } from '@/components/store/store-types'

export default function OrdersListContent() {
  const router = useRouter()
  const store = useStore()
  const auth = useCustomerAuth()
  const {
    filters, status, response, error,
    hasOrders, hasActiveFilters,
    setStatusFilter, setSort, goToPage, resetFilters,
    cancelOrder, reorder,
  } = useCustomerOrders()

  const base = useStoreBase()
  const accent = store.colors.accent
  const bg = store.colors.background
  const text = store.colors.text
  const card = store.colors.card

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (!auth.isLoggedIn || !auth.customer) {
    return (
      <div style={{ background: bg, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: text }}>Sign in to view orders</h2>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px' }}>You need to be signed in to view your order history.</p>
          <Link href={`${base}/login`} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '13px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const isLoading = status === 'loading'

  return (
    <div style={{ background: bg, color: text, minHeight: '70vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 24px 64px' }}>

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#999' }}>
          <Link href={base || '/'} style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={`${base}/profile`} style={{ color: '#999', textDecoration: 'none' }}>Account</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: text, fontWeight: 500 }}>Orders</span>
        </nav>

        {/* ── Page heading ────────────────────────────────────────────────── */}
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 24px', letterSpacing: '-0.02em', color: text }}>
          My Orders
        </h1>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <OrderFilters
            filters={filters}
            onStatusChange={setStatusFilter}
            onSortChange={setSort}
            accent={accent}
            textColor={text}
          />
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div role="alert" style={{ padding: '14px 16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ── Result count ────────────────────────────────────────────────── */}
        {status === 'success' && hasOrders && response && (
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}
          >
            <strong style={{ color: text }}>{response.totalOrders}</strong>{' '}
            {response.totalOrders === 1 ? 'order' : 'orders'} found
          </p>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {isLoading && (
          <div aria-live="polite" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" style={{ background: card, borderRadius: 14, padding: '20px 22px', border: '1px solid #00000008' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ height: 16, width: 100, background: '#e5e7eb', borderRadius: 4 }} />
                  <div style={{ height: 24, width: 80, background: '#e5e7eb', borderRadius: 20 }} />
                </div>
                <div style={{ height: 14, width: '60%', background: '#e5e7eb', borderRadius: 4, marginBottom: 14 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ height: 34, width: 100, background: '#e5e7eb', borderRadius: 8 }} />
                  <div style={{ height: 34, width: 80, background: '#e5e7eb', borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Orders list ─────────────────────────────────────────────────── */}
        {!isLoading && status === 'success' && hasOrders && response && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {response.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  base={base}
                  accent={accent}
                  cardBg={card}
                  textColor={text}
                  onCancel={cancelOrder}
                  onReorder={reorder}
                />
              ))}
            </div>
            <div style={{ marginTop: 36 }}>
              <OrdersPagination
                pagination={response.pagination}
                onPageChange={goToPage}
                accent={accent}
                textColor={text}
              />
            </div>
          </>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!isLoading && status === 'success' && !hasOrders && (
          <EmptyOrdersState
            statusFilter={filters.status}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
            base={base}
            accent={accent}
            textColor={text}
          />
        )}
      </div>
    </div>
  )
}
