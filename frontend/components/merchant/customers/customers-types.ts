/** Customer list row — same shape you can map from Spring Boot later. */

export type CustomerSegment = 'loyal' | 'regular' | 'new' | 'at_risk'

export type CustomerStatus = 'vip' | 'active' | 'inactive'

export type CustomerRow = {
  id: string
  name: string
  email: string
  phone: string
  city: string
  orders: number
  totalSpent: number
  /** Display YYYY-MM-DD or em dash */
  lastOrder: string
  status: CustomerStatus
  segment: CustomerSegment
  /** First order date (YYYY-MM-DD) */
  joinDate: string
}

export const SEGMENT_CONFIG: Record<
  CustomerSegment,
  { label: string; bg: string; color: string; desc: string }
> = {
  loyal: { label: 'Loyal', bg: '#EAF3DE', color: '#3B6D11', desc: '7+ orders' },
  regular: { label: 'Regular', bg: '#E6F1FB', color: '#185FA5', desc: '3–6 orders' },
  new: { label: 'New', bg: '#EEEDFE', color: '#534AB7', desc: '1–2 orders' },
  at_risk: { label: 'At Risk', bg: '#FAEEDA', color: '#854F0B', desc: 'Stale activity' },
}

export const STATUS_CONFIG: Record<CustomerStatus, { label: string; bg: string; color: string }> = {
  vip: { label: 'VIP', bg: '#FBF0D8', color: '#854F0B' },
  active: { label: 'Active', bg: '#EAF3DE', color: '#3B6D11' },
  inactive: { label: 'Inactive', bg: '#F4F2EE', color: '#888' },
}

export type CustomerSortKey =
  | 'name'
  | 'city'
  | 'orders'
  | 'totalSpent'
  | 'lastOrder'
  | 'segment'
  | 'status'
