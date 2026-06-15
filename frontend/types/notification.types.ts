/**
 * Notification types — aligned with Spring Boot NotificationManagement module.
 * Sources: Notification.java (NotificationType, ReferenceType),
 *          NotificationDTOs.java (NotificationResponse),
 *          NotificationController.java (read-all returns ApiResponse<String>)
 *
 * CON-10 (fixed): backend enum values are:
 *   PAYMENT_INITIATED | PAYMENT_SUCCEEDED | PAYMENT_FAILED | PAYMENT_REFUNDED
 *   ORDER_PROCESSING  | ORDER_SHIPPED     | ORDER_DELIVERED | ORDER_CANCELLED
 */

// ── Notification type enum — matches Notification.NotificationType exactly ────

export type NotificationType =
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'

/** CON-10: backend Notification.ReferenceType. */
export type NotificationReferenceType = 'ORDER' | 'PAYMENT'

// ── Notification entity — matches NotificationDTOs.NotificationResponse ───────

export interface NotificationResponse {
  notificationId: number
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  referenceId: number | null
  referenceType: NotificationReferenceType | null
  /** ISO timestamp (CON-1 Jackson config ensures ISO-8601, not an array). */
  createdAt: string
}

// ── Paginated response ────────────────────────────────────────────────────────

export interface NotificationPage {
  content: NotificationResponse[]
  totalElements: number
  totalPages: number
  /** Mapped from Spring Page's `number` field */
  currentPage: number
  /** Mapped from Spring Page's `size` field */
  pageSize: number
}

// ── Display config per type ────────────────────────────────────────────────────

export interface NotificationDisplayConfig {
  icon: string
  accentColor: string
}

export const NOTIFICATION_DISPLAY: Record<NotificationType, NotificationDisplayConfig> = {
  PAYMENT_INITIATED: { icon: '💳', accentColor: '#2563eb' },
  PAYMENT_SUCCEEDED: { icon: '✅', accentColor: '#16a34a' },
  PAYMENT_FAILED:    { icon: '❌', accentColor: '#dc2626' },
  PAYMENT_REFUNDED:  { icon: '↩️', accentColor: '#7c3aed' },
  ORDER_PROCESSING:  { icon: '⚙️', accentColor: '#0891b2' },
  ORDER_SHIPPED:     { icon: '🚚', accentColor: '#0284c7' },
  ORDER_DELIVERED:   { icon: '📦', accentColor: '#15803d' },
  ORDER_CANCELLED:   { icon: '🚫', accentColor: '#dc2626' },
}

/** Fallback config for unknown/future notification types. */
export const NOTIFICATION_DISPLAY_FALLBACK: NotificationDisplayConfig = {
  icon: 'ℹ️',
  accentColor: '#6b7280',
}

export function getNotificationDisplay(type: string): NotificationDisplayConfig {
  return NOTIFICATION_DISPLAY[type as NotificationType] ?? NOTIFICATION_DISPLAY_FALLBACK
}

// ── State shape for useNotifications hook ─────────────────────────────────────

export interface NotificationsState {
  notifications: NotificationResponse[]
  unreadCount: number
  totalPages: number
  currentPage: number
  isLoading: boolean
  error: string
  fetchPage: (page?: number) => Promise<void>
  markRead: (notificationId: number) => Promise<void>
  markAllRead: () => Promise<void>
}
