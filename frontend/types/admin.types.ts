/**
 * Admin types — aligned with Spring Boot UserManagement / Admin module.
 * Keep in sync with: AdminController.java, MerchantController.java
 *
 * TODO(BACKEND-INTEGRATION): Validate field names against actual responses.
 */

import type { UserRole } from '@/types/auth.types'
// StoreStatus canonical definition lives in store.types.ts — re-exported here
// so existing imports from admin.types stay backward-compatible.
export type { StoreStatus } from '@/types/store.types'
import type { StoreStatus } from '@/types/store.types'

// ── User (admin view) ──────────────────────────────────────────────────────────

export interface AdminUserResponse {
  userId: number
  email: string
  fullName: string
  phone: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
}

// ── Merchant (admin view) ─────────────────────────────────────────────────────

export interface AdminMerchantResponse {
  /** INT-5/6: backend MerchantResponse key; the verify/delete endpoints expect {merchantId}. */
  merchantId: number
  userId: number
  email: string
  fullName: string
  businessName: string | null
  phone: string | null
  isActive: boolean
  isVerified: boolean
  storeCount: number
  createdAt: string
}

// ── Store (admin view) ─────────────────────────────────────────────────────────
// StoreStatus is now imported from store.types.ts above

export interface AdminStoreResponse {
  storeId: number
  storeName: string
  /** CON-6: backend StoreResponse uses `storeUrl` (may be null on older records). */
  storeUrl: string | null
  status: StoreStatus
  merchantId: number
  /** CON-6: enriched — merchant's display name. */
  merchantName: string | null
  /** CON-6: enriched — merchant's email. */
  merchantEmail: string | null
  createdAt: string
}

// ── Order (admin view) ────────────────────────────────────────────────────────

export type AdminOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

export interface AdminOrderSummary {
  orderId: number
  customerId: number
  customerEmail: string
  storeId: number
  storeName: string
  status: AdminOrderStatus
  total: number
  paymentMethod: string
  itemCount: number
  orderDate: string
}

export interface AdminOrderPage {
  content: AdminOrderSummary[]
  totalElements: number
  totalPages: number
  currentPage: number
  pageSize: number
}

// ── Store status display config ────────────────────────────────────────────────

export const STORE_STATUS_CONFIG: Record<StoreStatus, { label: string; bg: string; color: string }> = {
  DRAFT:       { label: 'Draft',       bg: '#f3f4f6', color: '#6b7280' },
  PUBLISHED:   { label: 'Published',   bg: '#f0fdf4', color: '#15803d' },
  PAUSED:      { label: 'Paused',      bg: '#fff7ed', color: '#c2410c' },
  DEACTIVATED: { label: 'Deactivated', bg: '#fef2f2', color: '#dc2626' },
}

export const ADMIN_ORDER_STATUS_CONFIG: Record<AdminOrderStatus, { label: string; color: string; bg: string }> = {
  PENDING:    { label: 'Pending',    color: '#c2410c', bg: '#fff7ed' },
  CONFIRMED:  { label: 'Confirmed',  color: '#1d4ed8', bg: '#eff6ff' },
  PROCESSING: { label: 'Processing', color: '#0891b2', bg: '#ecfeff' },
  SHIPPED:    { label: 'Shipped',    color: '#7c3aed', bg: '#f5f3ff' },
  DELIVERED:  { label: 'Delivered',  color: '#15803d', bg: '#f0fdf4' },
  CANCELLED:  { label: 'Cancelled',  color: '#dc2626', bg: '#fef2f2' },
  REFUNDED:   { label: 'Refunded',   color: '#86198f', bg: '#fdf4ff' },
}
