'use client'

import type { CustomerOrderStatus, OrderFilterState, OrderSortOption, OrderStatusFilter } from '@/types/order.types'
import { CUSTOMER_ORDER_STATUSES, ORDER_STATUS_CONFIG, ORDER_SORT_LABELS, ORDER_SORT_OPTIONS } from '@/types/order.types'

type Props = {
  filters: OrderFilterState
  onStatusChange: (status: OrderStatusFilter) => void
  onSortChange: (sort: OrderSortOption) => void
  accent: string
  textColor: string
}

/**
 * Order list filter bar — status tabs + sort dropdown.
 * No service calls; driven entirely by props.
 */
export default function OrderFilters({
  filters,
  onStatusChange,
  onSortChange,
  accent,
  textColor,
}: Props) {
  const statuses: OrderStatusFilter[] = ['all', ...CUSTOMER_ORDER_STATUSES]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {/* Status filter tabs */}
      <div
        role="tablist"
        aria-label="Filter orders by status"
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {statuses.map((s) => {
          const isActive = filters.status === s
          const label = s === 'all' ? 'All Orders' : ORDER_STATUS_CONFIG[s as CustomerOrderStatus].label

          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onStatusChange(s)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: isActive ? `1.5px solid ${accent}` : '1.5px solid #e5e7eb',
                background: isActive ? `${accent}15` : 'transparent',
                color: isActive ? accent : '#666',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Sort dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="order-sort" style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap' }}>
          Sort by
        </label>
        <select
          id="order-sort"
          value={filters.sort}
          onChange={(e) => onSortChange(e.target.value as OrderSortOption)}
          aria-label="Sort orders"
          style={{
            height: 36, padding: '0 32px 0 12px',
            borderRadius: 8, border: '1.5px solid #e5e7eb',
            fontSize: 13, fontWeight: 500, color: textColor,
            background: 'transparent', fontFamily: 'inherit',
            outline: 'none', cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
        >
          {ORDER_SORT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{ORDER_SORT_LABELS[opt]}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
