'use client'

import type { OrderTimelineEvent } from '@/types/order.types'

type Props = {
  events: OrderTimelineEvent[]
  accent: string
}

/**
 * Vertical timeline component.
 * Reusable for customer orders, admin views, vendor fulfillment, etc.
 * No service calls — purely driven by props.
 */
export default function OrderTimeline({ events, accent }: Props) {
  return (
    <ol
      aria-label="Order timeline"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
    >
      {events.map((event, i) => {
        const isLast = i === events.length - 1
        return (
          <li
            key={event.id}
            style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 24 }}
          >
            {/* Line + dot column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 24 }}>
              <TimelineDot event={event} accent={accent} />
              {!isLast && (
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    width: 2,
                    marginTop: 4,
                    background: event.eventStatus === 'completed' ? accent : '#e5e7eb',
                    minHeight: 20,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingTop: 2, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: event.eventStatus === 'pending' ? '#aaa' : '#1a1a1a',
                  }}
                >
                  {event.label}
                </span>
                {event.timestamp && (
                  <time
                    dateTime={event.timestamp}
                    style={{ fontSize: 12, color: '#aaa' }}
                  >
                    {new Date(event.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                )}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: '#888',
                  margin: '2px 0 0',
                  lineHeight: 1.5,
                }}
              >
                {event.description}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ── Dot ────────────────────────────────────────────────────────────────────────

function TimelineDot({ event, accent }: { event: OrderTimelineEvent; accent: string }) {
  if (event.eventStatus === 'completed') {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 24, height: 24, borderRadius: '50%',
          background: accent, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    )
  }

  if (event.eventStatus === 'current') {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 24, height: 24, borderRadius: '50%',
          background: '#fff', border: `3px solid ${accent}`, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
      </div>
    )
  }

  // pending
  return (
    <div
      aria-hidden="true"
      style={{
        width: 24, height: 24, borderRadius: '50%',
        background: '#f3f4f6', border: '2px solid #e5e7eb', flexShrink: 0,
      }}
    />
  )
}
