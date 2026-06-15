/**
 * Category types — mirror backend CategoryDTOs.java exactly.
 * Backend base path: /categories
 */

export interface CategoryResponse {
  categoryId: number
  storeId: number | null
  name: string
  description: string | null
}

export interface CategoryRequest {
  name: string
  description?: string
  /** Optional — admin-created global categories leave this null. */
  storeId?: number | null
}
