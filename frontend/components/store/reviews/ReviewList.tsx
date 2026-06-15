'use client'

import { useState } from 'react'
import { useCustomerAuth } from '@/components/store/CustomerAuthProvider'
import { reviewService } from '@/services/review.service'
import { useSafeEffect } from '@/lib/react/use-safe-effect'
import { computeSummary } from './RatingSummary'
import RatingSummary from './RatingSummary'
import ReviewCard from './ReviewCard'
import ReviewForm from './ReviewForm'
import type { ReviewResponse, CreateReviewRequest, UpdateReviewRequest } from '@/types/review.types'

type Props = {
  productId: number
  accent: string
}

type FormMode = 'hidden' | 'create' | 'edit'

/**
 * Pagination state shape — in place so adding a "Load more" button requires
 * only wiring up the existing fields, not a state refactor.
 *
 * TODO(BACKEND-INTEGRATION): Populate from the paginated response envelope:
 *   { content: ReviewResponse[], page, size, totalElements, last }
 * Use `cursor` for cursor-based pagination if the backend provides one.
 */
interface ReviewPageState {
  page: number
  hasMore: boolean
  cursor: string | null
}

export default function ReviewList({ productId, accent }: Props) {
  const auth = useCustomerAuth()

  // Derive stable identity from auth context — used for ownership checks throughout.
  // TODO(BACKEND-INTEGRATION): Replace with the verified userId from the JWT payload.
  const currentCustomerId = auth.customer?.id ?? null

  const [reviews, setReviews] = useState<ReviewResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formMode, setFormMode] = useState<FormMode>('hidden')
  const [editingReview, setEditingReview] = useState<ReviewResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState('')
  // Pagination readiness — not surfaced in UI yet; shape is stable for future use
  const [pageState] = useState<ReviewPageState>({ page: 1, hasMore: false, cursor: null })
  void pageState // intentionally unused until pagination UI is wired up

  useSafeEffect((isMounted) => {
    setLoading(true)
    setError('')
    reviewService.getReviews(productId).then((result) => {
      if (!isMounted()) return
      if (result.ok) {
        setReviews(result.data)
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
  }, [productId])

  const myReview = currentCustomerId
    ? reviews.find((r) => String(r.customerId) === String(currentCustomerId)) ?? null
    : null

  const canWriteReview = auth.isLoggedIn && !myReview && formMode === 'hidden'

  const handleCreate = async (data: CreateReviewRequest | UpdateReviewRequest) => {
    if (!auth.customer || !currentCustomerId) return
    setSubmitting(true)
    setSubmitError('')
    const displayName =
      `${auth.customer.firstName} ${auth.customer.lastName}`.trim() || auth.customer.email
    const result = await reviewService.createReview(
      productId,
      currentCustomerId,
      displayName,
      data as CreateReviewRequest,
      auth.getAuthHeader()
    )
    setSubmitting(false)
    if (result.ok) {
      setReviews((prev) => [result.data, ...prev])
      setFormMode('hidden')
    } else {
      setSubmitError(result.error)
    }
  }

  const handleUpdate = async (data: CreateReviewRequest | UpdateReviewRequest) => {
    if (!editingReview) return
    setSubmitting(true)
    setSubmitError('')
    const result = await reviewService.updateReview(
      productId,
      editingReview.reviewId,
      data as UpdateReviewRequest,
      auth.getAuthHeader()
    )
    setSubmitting(false)
    if (result.ok) {
      setReviews((prev) => prev.map((r) => (r.reviewId === result.data.reviewId ? result.data : r)))
      setFormMode('hidden')
      setEditingReview(null)
    } else {
      setSubmitError(result.error)
    }
  }

  const handleDelete = async (reviewId: number) => {
    setDeletingId(reviewId)
    const result = await reviewService.deleteReview(productId, reviewId, auth.getAuthHeader())
    setDeletingId(null)
    if (result.ok) {
      setReviews((prev) => prev.filter((r) => r.reviewId !== reviewId))
    } else {
      setError(result.error)
    }
  }

  const openEdit = (review: ReviewResponse) => {
    setEditingReview(review)
    setFormMode('edit')
    setSubmitError('')
  }

  const summary = computeSummary(reviews)

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading reviews">
        <ReviewSkeleton />
        <ReviewSkeleton />
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div role="alert" style={{ padding: '16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: 14 }}>
        {error}
      </div>
    )
  }

  return (
    <section aria-label="Customer reviews">
      {/* Rating summary */}
      {reviews.length > 0 && <RatingSummary summary={summary} accent={accent} />}

      {/* Write review CTA */}
      {canWriteReview && (
        <button
          type="button"
          onClick={() => { setFormMode('create'); setSubmitError('') }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            padding: '11px 20px',
            borderRadius: 10,
            border: `1px solid ${accent}`,
            background: 'transparent',
            color: accent,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Write a Review
        </button>
      )}

      {/* Sign-in nudge for guests */}
      {!auth.isLoggedIn && reviews.length > 0 && (
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          {/* TODO(BACKEND-INTEGRATION): Replace span with <Link href={`${base}/login`}> once
              ReviewList receives the `base` prop or reads slug from useParams. */}
          <span style={{ color: accent, fontWeight: 600, cursor: 'default' }}>
            Sign in
          </span>{' '}
          to leave a review.
        </p>
      )}

      {/* Submit error */}
      {submitError && (
        <div role="alert" style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {submitError}
        </div>
      )}

      {/* Create / Edit form */}
      {(formMode === 'create' || formMode === 'edit') && (
        <ReviewForm
          existingReview={formMode === 'edit' ? editingReview : null}
          accent={accent}
          isSubmitting={submitting}
          onSubmit={formMode === 'edit' ? handleUpdate : handleCreate}
          onCancel={() => { setFormMode('hidden'); setEditingReview(null); setSubmitError('') }}
        />
      )}

      {/* Review list */}
      {reviews.length === 0 && formMode === 'hidden' ? (
        <EmptyReviews accent={accent} isLoggedIn={auth.isLoggedIn} onWrite={() => { setFormMode('create'); setSubmitError('') }} />
      ) : (
        <div>
          {reviews.map((review) => (
            <ReviewCard
              key={review.reviewId}
              review={review}
              currentCustomerId={currentCustomerId}
              onEdit={openEdit}
              onDelete={handleDelete}
              isDeleting={deletingId === review.reviewId}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyReviews({
  accent,
  isLoggedIn,
  onWrite,
}: {
  accent: string
  isLoggedIn: boolean
  onWrite: () => void
}) {
  return (
    <div
      style={{
        padding: '32px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#555', margin: 0 }}>No reviews yet</p>
      <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Be the first to review this product.</p>
      {isLoggedIn && (
        <button
          type="button"
          onClick={onWrite}
          style={{
            marginTop: 4,
            padding: '10px 22px',
            borderRadius: 10,
            border: 'none',
            background: accent,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Write a Review
        </button>
      )}
    </div>
  )
}

function ReviewSkeleton() {
  return (
    <div aria-hidden="true" style={{ padding: '18px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: 120, height: 12, background: '#f3f4f6', borderRadius: 4 }} />
          <div style={{ width: 80, height: 10, background: '#f3f4f6', borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ width: 80, height: 12, background: '#f3f4f6', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ width: '90%', height: 12, background: '#f3f4f6', borderRadius: 4, marginBottom: 6 }} />
      <div style={{ width: '70%', height: 12, background: '#f3f4f6', borderRadius: 4 }} />
    </div>
  )
}
