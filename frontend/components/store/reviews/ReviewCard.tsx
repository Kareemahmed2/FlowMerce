'use client'

import { useState } from 'react'
import StarRating from './StarRating'
import type { ReviewResponse } from '@/types/review.types'

type Props = {
  review: ReviewResponse
  /** Customer ID of the currently logged-in customer (null if guest) */
  currentCustomerId: string | null
  onEdit: (review: ReviewResponse) => void
  onDelete: (reviewId: number) => void
  isDeleting?: boolean
}

export default function ReviewCard({
  review,
  currentCustomerId,
  onEdit,
  onDelete,
  isDeleting = false,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  // INT-9: coerce both sides — backend sends customerId as a number, FE id may be a string.
  const isOwner = !!currentCustomerId && String(currentCustomerId) === String(review.customerId)

  const initials = review.customerName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const formatted = new Date(review.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <article
      style={{
        padding: '18px 0',
        borderBottom: '1px solid #f3f4f6',
      }}
      aria-label={`Review by ${review.customerName}`}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Avatar */}
          <div
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: '#555',
              flexShrink: 0,
            }}
          >
            {initials || '?'}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{review.customerName}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 1 }}>{formatted}</div>
          </div>
        </div>

        {/* Owner actions */}
        {isOwner && !confirmDelete && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => onEdit(review)}
              disabled={isDeleting}
              aria-label="Edit your review"
              style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, color: '#555', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 500,
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              aria-label="Delete your review"
              style={{
                background: 'none', border: '1px solid #fecaca', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, color: '#dc2626', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 500,
              }}
            >
              Delete
            </button>
          </div>
        )}

        {/* Confirm delete inline */}
        {isOwner && confirmDelete && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#555' }}>Remove review?</span>
            <button
              type="button"
              onClick={() => { onDelete(review.reviewId); setConfirmDelete(false) }}
              disabled={isDeleting}
              style={{
                background: '#dc2626', border: 'none', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, color: '#fff', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              {isDeleting ? '…' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, color: '#555', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              No
            </button>
          </div>
        )}
      </div>

      {/* Stars */}
      <StarRating rating={review.rating} size={14} />

      {/* Title */}
      {review.title && (
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '8px 0 4px' }}>
          {review.title}
        </p>
      )}

      {/* Comment */}
      {review.comment && (
        <p style={{ fontSize: 14, color: '#555', margin: '6px 0 0', lineHeight: 1.65 }}>
          {review.comment}
        </p>
      )}
    </article>
  )
}
