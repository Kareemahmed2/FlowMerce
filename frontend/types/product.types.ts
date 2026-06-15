/**
 * Product types — mirror backend ProductDTOs.java exactly.
 * Keep in sync with Spring Boot ProductManagement module.
 *
 * Backend base path: /stores/{storeId}/products
 */

// ── Media ─────────────────────────────────────────────────────────────────────

export interface ProductMediaResponse {
  mediaId: number
  mediaUrl: string
  /** "IMAGE" by default; backend allows other values via the AddMediaRequest. */
  mediaType: string
  altText: string | null
}

export interface AddMediaRequest {
  mediaUrl: string
  /** Default "IMAGE" on backend if not provided. */
  mediaType?: string
  altText?: string
}

// ── Product ───────────────────────────────────────────────────────────────────

/** Backend returns BigDecimal as string in JSON. */
export type Money = string | number

export interface ProductResponse {
  productId: number
  storeId: number
  storeName: string
  categoryId: number | null
  categoryName: string | null
  name: string
  description: string | null
  basePrice: Money
  availableQuantity: number
  isActive: boolean
  rating: number | null
  media: ProductMediaResponse[]
  createdAt: string
  updatedAt: string
}

export interface CreateProductRequest {
  name: string
  description?: string
  basePrice: number
  categoryId?: number | null
  /** Defaults to 0 on backend if omitted. */
  initialQuantity?: number
  /** Defaults to 10 on backend if omitted. */
  lowStockThreshold?: number
}

export interface UpdateProductRequest {
  name?: string
  description?: string
  basePrice?: number
  categoryId?: number | null
}
