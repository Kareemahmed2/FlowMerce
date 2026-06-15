'use client'

/**
 * Customer notifications page.
 * Route: /store/[slug]/account/notifications
 *
 * Features:
 *  - Paginated notification list with unread indicator
 *  - Mark individual / all as read
 *  - Type-based icons and color coding
 *  - "Load more" pagination
 *  - Auth guard
 *
 * TODO(BACKEND-INTEGRATION): No page changes needed after integration.
 * Replace polling in useNotifications with SSE stream events.
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useStore } from '@/components/store/StoreProvider'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { textOnBg } from '@/components/store/store-types'
import { useNotifications } from '@/hooks/useNotifications'
import { NOTIFICATION_DISPLAY } from '@/types/notification.types'
import type { NotificationResponse } from '@/types/notification.types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NotificationCard({
  notification,
  accent,
  onMarkRead,
}: {
  notification: NotificationResponse
  accent: string
  onMarkRead: (id: number) => void
}) {
  const cfg = NOTIFICATION_DISPLAY[notification.type] ?? { icon: 'ℹ️', accentColor: '#6b7280' }

  return (
    <div
      style={{
        display: 'flex', gap: 14, padding: '16px 20px',
        background: notification.isRead ? 'transparent' : `${accent}06`,
        borderBottom: '1px solid #f3f4f6',
        cursor: notification.isRead ? 'default' : 'pointer',
        transition: 'background 0.15s',
      }}
      onClick={() => { if (!notification.isRead) onMarkRead(notification.notificationId) }}
      className="notif-row"
    >
      {/* Unread dot */}
      <div style={{ paddingTop: 2, flexShrink: 0, position: 'relative' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: `${cfg.accentColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {cfg.icon}
        </div>
        {!notification.isRead && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%', background: accent,
            border: '2px solid #fff',
          }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <p style={{
            fontSize: 14, fontWeight: notification.isRead ? 400 : 600,
            margin: '0 0 4px', lineHeight: 1.4,
          }}>
            {notification.title}
          </p>
          <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0, marginTop: 2 }}>
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 }}>
          {notification.message}
        </p>
        {!notification.isRead && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.notificationId) }}
            style={{
              marginTop: 8, background: 'none', border: 'none',
              color: accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
            }}
          >
            Mark as read
          </button>
        )}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const { slug } = useParams<{ slug: string }>()
  const store = useStore()
  const auth = useCustomerAuth()
  const {
    notifications,
    unreadCount,
    totalPages,
    currentPage,
    isLoading,
    error,
    fetchPage,
    markRead,
    markAllRead,
  } = useNotifications()

  const base = `/store/${slug}`
  const accent = store.colors.accent

  // Auth guard
  if (!auth.isLoggedIn) {
    return (
      <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Please sign in</h2>
          <p style={{ color: '#999', fontSize: 14, margin: '0 0 20px' }}>You need to be logged in to view notifications.</p>
          <Link href={`${base}/login`} style={{ display: 'inline-block', background: accent, color: textOnBg(accent), padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: store.colors.background, color: store.colors.text, minHeight: '100vh' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px 64px' }}>

        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 13, color: '#999' }}>
          <Link href={base} style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span>/</span>
          <Link href={`${base}/profile`} style={{ color: '#999', textDecoration: 'none' }}>Account</Link>
          <span>/</span>
          <span style={{ color: store.colors.text, fontWeight: 500 }}>Notifications</span>
        </nav>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Notifications</h1>
            {unreadCount > 0 && (
              <span style={{
                background: accent, color: textOnBg(accent),
                fontSize: 12, fontWeight: 700, borderRadius: 20,
                padding: '2px 10px', lineHeight: '20px',
              }}>
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
                color: '#555', fontSize: 13, fontWeight: 500, padding: '8px 14px',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Notification list */}
        <div style={{ background: store.colors.card, borderRadius: 16, border: '1px solid #00000008', overflow: 'hidden' }}>
          {isLoading && notifications.length === 0 ? (
            <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>Loading notifications…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
              <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>All caught up!</p>
              <p style={{ color: '#999', fontSize: 14, margin: 0 }}>No notifications yet. We&apos;ll let you know when something happens.</p>
            </div>
          ) : (
            <>
              {notifications.map((n) => (
                <NotificationCard
                  key={n.notificationId}
                  notification={n}
                  accent={accent}
                  onMarkRead={markRead}
                />
              ))}

              {/* Load more */}
              {currentPage + 1 < totalPages && (
                <div style={{ padding: '16px 20px', textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
                  <button
                    onClick={() => fetchPage(currentPage + 1)}
                    disabled={isLoading}
                    style={{
                      background: 'none', border: `1px solid ${accent}`, borderRadius: 8,
                      color: accent, fontSize: 13, fontWeight: 600,
                      padding: '10px 24px', cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .notif-row:hover { background: #f9fafb !important; }
      `}</style>
    </div>
  )
}
