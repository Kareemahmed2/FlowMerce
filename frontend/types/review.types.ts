// Review DTOs — shaped to match the backend ProductReviewController contracts.
// TODO(BACKEND-INTEGRATION): These types map directly to Spring Boot ReviewResponse.

export interface ReviewResponse {
  reviewId: number
  productId: number
  customerId: string
  customerName: string
  rating: number // 1–5 integer
  title: string | null
  comment: string | null
  createdAt: string // ISO 8601
}

export interface CreateReviewRequest {
  rating: number   // 1–5, required
  title?: string   // max 100 chars
  comment?: string // max 1000 chars
}

export interface UpdateReviewRequest {
  rating?: number
  title?: string
  comment?: string
}

export interface RatingSummary {
  average: number
  totalCount: number
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number }
}
