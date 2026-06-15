// Wishlist DTOs — shaped to match the backend WishlistController contracts.
// TODO(BACKEND-INTEGRATION): These types map directly to Spring Boot WishlistItemResponse / WishlistResponse.

export interface WishlistItemResponse {
  wishlistId: number
  productId: number
  productName: string
  productImage: string | null
  basePrice: number
  availableStock: number
  isActive: boolean
  addedAt: string // ISO 8601
}

export interface WishlistResponse {
  userId: number
  items: WishlistItemResponse[]
  totalItems: number
}

export interface AddToWishlistRequest {
  productId: number
}

/**
 * Metadata provided by the caller so the optimistic update can populate a
 * WishlistItemResponse without a round-trip. Not sent to the backend.
 */
export interface WishlistItemMeta {
  productName: string
  productImage: string | null
  basePrice: number
  availableStock: number
  isActive: boolean
}

export interface WishlistState {
  isHydrated: boolean
  items: WishlistItemResponse[]
  isLoading: boolean
  /**
   * Set of productIds currently being added or removed.
   * Use to prevent duplicate optimistic entries and show per-product pending state.
   */
  pendingIds: ReadonlySet<number>
  /**
   * Sync readiness markers — reserved for backend integration.
   * TODO(BACKEND-INTEGRATION): Set syncStatus to 'syncing' while POST/DELETE calls
   * are in-flight, 'error' on failure, 'idle' on success. Record lastSyncedAt
   * after each successful server round-trip.
   */
  syncStatus: 'idle' | 'syncing' | 'error'
  lastSyncedAt: string | null
  addItem: (productId: number, meta: WishlistItemMeta) => Promise<void>
  removeItem: (productId: number) => Promise<void>
  isInWishlist: (productId: number) => boolean
  moveToCart: (productId: number) => Promise<void>
}
