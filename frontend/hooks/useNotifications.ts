'use client'

/**
 * useNotifications — manages notification state for the current user.
 *
 * Consumes notificationService which returns ApiResult<T> — no throws,
 * all error handling is explicit via result.ok checks.
 *
 * Responsibilities:
 *  - Fetches paginated notifications from notificationService
 *  - Tracks unread count (polled every 60s in background)
 *  - Exposes markRead / markAllRead with optimistic UI + rollback on failure
 *
 * Real-time refresh: when RealtimeProvider is mounted (customer logged in,
 * backend URL set), `notificationTick` increments on relevant SSE events and
 * triggers an immediate refresh — supplementing the 60s background poll.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationService } from '@/services/notification.service'
import { useSafeEffect } from '@/lib/react/use-safe-effect'
import { useRealtime } from '@/components/store/RealtimeProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import type { NotificationResponse, NotificationsState } from '@/types/notification.types'

const POLL_INTERVAL_MS = 60_000

export function useNotifications(): NotificationsState {
  const realtime = useRealtime()
  const auth = useCustomerAuth()
  const [notifications, setNotifications] = useState<NotificationResponse[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch a page ─────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (page = 0) => {
    setIsLoading(true)
    setError('')
    const result = await notificationService.getNotifications(page, 20, auth.getAuthHeader())
    setIsLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNotifications((prev) =>
      page === 0 ? result.data.content : [...prev, ...result.data.content]
    )
    setTotalPages(result.data.totalPages)
    setCurrentPage(result.data.currentPage)
  }, [auth.getAuthHeader])

  // ── Poll unread count ─────────────────────────────────────────────────────────

  const fetchUnreadCount = useCallback(async () => {
    const result = await notificationService.getUnreadCount(auth.getAuthHeader())
    if (result.ok) setUnreadCount(result.data)
  }, [auth.getAuthHeader])

  // ── Initial load + polling ────────────────────────────────────────────────────

  useSafeEffect((isMounted) => {
    const headers = auth.getAuthHeader()

    notificationService.getNotifications(0, 20, headers).then((result) => {
      if (!isMounted()) return
      if (result.ok) {
        setNotifications(result.data.content)
        setTotalPages(result.data.totalPages)
        setCurrentPage(0)
      } else {
        setError(result.error)
      }
    })

    notificationService.getUnreadCount(headers).then((result) => {
      if (!isMounted()) return
      if (result.ok) setUnreadCount(result.data)
    })

    pollRef.current = setInterval(() => {
      notificationService.getUnreadCount(auth.getAuthHeader()).then((result) => {
        if (isMounted() && result.ok) setUnreadCount(result.data)
      })
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [auth.isLoggedIn])

  // ── SSE-driven refresh ────────────────────────────────────────────────────────
  // When the realtime provider receives a notification-relevant event,
  // refresh the unread count + first page immediately.
  useEffect(() => {
    if (realtime.notificationTick === 0) return
    void fetchUnreadCount()
    void fetchPage(0)
  }, [realtime.notificationTick, fetchUnreadCount, fetchPage])

  // ── Actions ───────────────────────────────────────────────────────────────────

  const markRead = useCallback(async (notificationId: number) => {
    setNotifications((prev) =>
      prev.map((n) => n.notificationId === notificationId ? { ...n, isRead: true } : n)
    )
    setUnreadCount((c) => Math.max(0, c - 1))

    const result = await notificationService.markRead(notificationId, auth.getAuthHeader())
    if (!result.ok) {
      setNotifications((prev) =>
        prev.map((n) => n.notificationId === notificationId ? { ...n, isRead: false } : n)
      )
      setUnreadCount((c) => c + 1)
    }
  }, [auth.getAuthHeader])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)

    const result = await notificationService.markAllRead(auth.getAuthHeader())
    if (!result.ok) {
      fetchPage(0)
      fetchUnreadCount()
    }
  }, [fetchPage, fetchUnreadCount, auth.getAuthHeader])

  return {
    notifications,
    unreadCount,
    totalPages,
    currentPage,
    isLoading,
    error,
    fetchPage,
    markRead,
    markAllRead,
  }
}
