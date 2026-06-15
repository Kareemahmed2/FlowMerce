/**
 * Notification service — all methods return ApiResult<T>, never throw.
 *
 * Backend endpoints:
 *   GET    /notifications?page=0&size=20      → getNotifications()
 *   GET    /notifications/unread-count        → getUnreadCount()
 *   PUT    /notifications/{id}/read           → markRead()
 *   PUT    /notifications/read-all            → markAllRead()
 */

import { httpClient } from '@/lib/api/http-client'
import type { ApiResult } from '@/types/api.types'
import type { NotificationPage, NotificationResponse } from '@/types/notification.types'

export const notificationService = {
  async getNotifications(page = 0, size = 20, authHeaders?: Record<string, string>): Promise<ApiResult<NotificationPage>> {
    type SpringPage = { content: NotificationResponse[]; totalElements: number; totalPages: number; number: number; size: number }
    const raw = await httpClient.get<SpringPage>(`/notifications?page=${page}&size=${size}`, authHeaders)
    if (!raw.ok) return raw
    return {
      ok: true,
      data: {
        content: raw.data.content,
        totalElements: raw.data.totalElements,
        totalPages: raw.data.totalPages,
        currentPage: raw.data.number,
        pageSize: raw.data.size,
      },
    }
  },

  async getUnreadCount(authHeaders?: Record<string, string>): Promise<ApiResult<number>> {
    return httpClient.get<number>('/notifications/unread-count', authHeaders)
  },

  async markRead(notificationId: number, authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.put<void>(`/notifications/${notificationId}/read`, undefined, authHeaders)
  },

  async markAllRead(authHeaders?: Record<string, string>): Promise<ApiResult<void>> {
    return httpClient.put<void>('/notifications/read-all', undefined, authHeaders)
  },
}
