'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CreateReviewRequest, ReviewResponse, UpdateReviewRequest } from '@/types/review.types'

const schema = z.object({
  rating: z.number().min(1, 'Please select a rating').max(5),
  title: z.string().max(100, 'Title must be 100 characters or less').optional(),
  comment: z
    .string()
    .min(10, 'Comment must be at least 10 characters')
    .max(1000, 'Comment must be 1000 characters or less')
    .optional()
    .or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

type Props = {
  /** Provide an existing review to enter edit mode; omit for create mode. */
  existingReview?: ReviewResponse | null
  accent: string
  isSubmitting: boolean
  onSubmit: (data: CreateReviewRequest | UpdateReviewRequest) => Promise<void>
  onCancel: () => void
}

export default function ReviewForm({
  existingReview,
  accent,
  isSubmitting,
  onSubmit,
  onCancel,
}: Props) {
  const isEdit = !!existingReview

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rating: existingReview?.rating ?? 0,
      title: existingReview?.title ?? '',
      comment: existingReview?.comment ?? '',
    },
  })

  // Reset form when switching between create / edit modes
  useEffect(() => {
    reset({
      rating: existingReview?.rating ?? 0,
      title: existingReview?.title ?? '',
      comment: existingReview?.comment ?? '',
    })
  }, [existingReview, reset])

  const commentValue = watch('comment') ?? ''

  const handleFormSubmit = async (data: FormValues) => {
    await onSubmit({
      rating: data.rating,
      title: data.title?.trim() || undefined,
      comment: data.comment?.trim() || undefined,
    })
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      noValidate
      aria-label={isEdit ? 'Edit your review' : 'Write a review'}
      style={{
        background: '#fafafa',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '20px 20px 18px',
        marginBottom: 24,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#1a1a1a' }}>
        {isEdit ? 'Edit Review' : 'Write a Review'}
      </h3>

      {/* Star picker */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#555', display: 'block', marginBottom: 8 }}>
          Rating <span aria-hidden="true" style={{ color: '#dc2626' }}>*</span>
        </label>
        <Controller
          name="rating"
          control={control}
          render={({ field }) => (
            <StarPicker
              value={field.value}
              onChange={field.onChange}
              accent={accent}
            />
          )}
        />
        {errors.rating && (
          <p role="alert" style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
            {errors.rating.message}
          </p>
        )}
      </div>

      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="review-title"
          style={{ fontSize: 13, fontWeight: 500, color: '#555', display: 'block', marginBottom: 6 }}
        >
          Title <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="review-title"
          type="text"
          placeholder="Summarise your experience"
          {...register('title')}
          autoComplete="off"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'review-title-error' : undefined}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: errors.title ? '1px solid #dc2626' : '1px solid #e5e7eb',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {errors.title && (
          <p id="review-title-error" role="alert" style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
            {errors.title.message}
          </p>
        )}
      </div>

      {/* Comment */}
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="review-comment"
          style={{ fontSize: 13, fontWeight: 500, color: '#555', display: 'block', marginBottom: 6 }}
        >
          Comment <span style={{ color: '#aaa', fontWeight: 400 }}>(optional, min 10 chars)</span>
        </label>
        <textarea
          id="review-comment"
          placeholder="Share your thoughts about this product…"
          {...register('comment')}
          rows={4}
          aria-invalid={!!errors.comment}
          aria-describedby={errors.comment ? 'review-comment-error' : undefined}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: errors.comment ? '1px solid #dc2626' : '1px solid #e5e7eb',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            lineHeight: 1.6,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
          {errors.comment ? (
            <p id="review-comment-error" role="alert" style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>
              {errors.comment.message}
            </p>
          ) : (
            <span />
          )}
          <span style={{ fontSize: 11, color: '#aaa' }}>
            {commentValue.length}/1000
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: 'none', fontSize: 14, fontWeight: 500, color: '#555',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: isSubmitting ? '#aaa' : accent,
            fontSize: 14, fontWeight: 600,
            color: '#fff',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {isSubmitting ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ animation: 'spin 0.8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Submitting…
            </>
          ) : isEdit ? 'Update Review' : 'Submit Review'}
        </button>
      </div>
    </form>
  )
}

// ── Interactive star picker ────────────────────────────────────────────────────

type StarPickerProps = {
  value: number
  onChange: (v: number) => void
  accent: string
}

function StarPicker({ value, onChange, accent }: StarPickerProps) {
  const [hovered, setHovered] = useState(0)
  const displayed = hovered || value

  // In a radiogroup, only the selected item (or the first if none selected) should
  // be in the tab order. Remaining items are navigated via arrow keys only.
  const tabbablestar = value > 0 ? value : 1

  return (
    <>
      {/* focus-visible ring via CSS — inline styles can't express :focus-visible */}
      <style>{`
        .star-picker-btn:focus-visible {
          outline: 2px solid ${accent};
          outline-offset: 3px;
          border-radius: 4px;
        }
      `}</style>
      <div
        role="radiogroup"
        aria-label="Select rating"
        style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            tabIndex={star === tabbablestar ? 0 : -1}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            className="star-picker-btn"
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              lineHeight: 0,
              borderRadius: 4,
              outline: 'none', // replaced by .star-picker-btn:focus-visible
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && star < 5) { e.preventDefault(); onChange(star + 1) }
              if (e.key === 'ArrowLeft' && star > 1) { e.preventDefault(); onChange(star - 1) }
              if (e.key === 'Home') { e.preventDefault(); onChange(1) }
              if (e.key === 'End') { e.preventDefault(); onChange(5) }
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{ transition: 'transform 0.1s' }}
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={displayed >= star ? accent : '#e5e7eb'}
                stroke={displayed >= star ? accent : '#d1d5db'}
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
        {value > 0 && (
          <span
            aria-live="polite"
            style={{ fontSize: 13, color: '#666', marginLeft: 6 }}
          >
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][value]}
          </span>
        )}
      </div>
    </>
  )
}
