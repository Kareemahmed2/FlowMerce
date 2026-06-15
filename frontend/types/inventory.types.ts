/**
 * Inventory types — aligned with the Spring Boot InventoryManagement module
 * AS IT ACTUALLY SERIALIZES today (CON-4 / INT-19/20/21).
 *
 * Backend sources:
 *   InventoryResponse.java         → { productId, storeId, availableQuantity,
 *                                       reservedQuantity, totalQuantity, stockStatus }
 *   InventoryTransaction.java      → returned as the JPA entity (txnId, type, …)
 *   InventoryStrategyFactory.java  → valid strategy keys: NORMAL | RESERVED | FLASH
 *
 * Note: the backend inventory response does NOT include product name/image, so
 * those are enriched on the client from the product catalog (see InventoryPage).
 */

// ── Strategy types ─────────────────────────────────────────────────────────────

/** Matches InventoryStrategyFactory keys exactly. */
export type InventoryStrategyType = 'NORMAL' | 'RESERVED' | 'FLASH'

/** Matches InventoryTransaction.Type. */
export type InventoryTransactionType =
  | 'RESTOCK'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'DAMAGE'

/** Values returned by InventoryServiceImpl.resolveStockStatus. */
export type StockStatus = 'NORMAL' | 'LOW' | 'OUT_OF_STOCK'

// ── Inventory entity ──────────────────────────────────────────────────────────

export interface InventoryResponse {
  productId: number
  storeId: number
  /** Units available for purchase (quantity − reserved). */
  availableQuantity: number
  /** Units reserved (in active carts/pending orders). */
  reservedQuantity: number
  /** On-hand quantity. */
  totalQuantity: number
  /** Backend-derived stock status. */
  stockStatus: StockStatus
  /** Threshold below which stockStatus becomes LOW (now returned by backend). */
  lowStockThreshold?: number
  /** ISO-8601 timestamp of the last stock change. */
  lastUpdated?: string | null
  // ── Enriched client-side from the product catalog (not sent by the backend) ──
  productName?: string
  productImage?: string | null
}

/** availableQuantity === 0 / OUT_OF_STOCK. */
export function isOutOfStock(i: InventoryResponse): boolean {
  return i.stockStatus === 'OUT_OF_STOCK' || i.availableQuantity <= 0
}

/** Backend flagged the row LOW. */
export function isLowStock(i: InventoryResponse): boolean {
  return i.stockStatus === 'LOW'
}

// ── Inventory transaction (immutable audit log — returned as the JPA entity) ───

export interface InventoryTransaction {
  txnId: number
  productId: number
  storeId: number
  type: InventoryTransactionType
  /** Signed delta applied by this transaction. */
  quantityChange: number
  qtyBefore: number
  /** On-hand balance after this transaction. */
  qtyAfter: number
  referenceId: string | null
  note: string | null
  createdBy: string | null
  /** ISO timestamp */
  createdAt: string
}

// ── Requests ──────────────────────────────────────────────────────────────────

/** POST /stores/{storeId}/inventory/{productId}/restock */
export interface RestockRequest {
  quantity: number
  note?: string
}

/** PATCH /products/{productId}/stock */
export interface StockUpdateRequest {
  quantity: number
  note?: string
}

/** POST /inventory/adjust */
export interface InventoryAdjustRequest {
  productId: number
  quantity: number
  strategyType?: InventoryStrategyType
}

// ── Summary stats ─────────────────────────────────────────────────────────────

export interface InventorySummary {
  totalProducts: number
  outOfStockCount: number
  lowStockCount: number
  totalAvailable: number
  totalReserved: number
}

export function computeInventorySummary(items: InventoryResponse[]): InventorySummary {
  return {
    totalProducts: items.length,
    outOfStockCount: items.filter(isOutOfStock).length,
    lowStockCount: items.filter((i) => isLowStock(i) && !isOutOfStock(i)).length,
    totalAvailable: items.reduce((s, i) => s + i.availableQuantity, 0),
    totalReserved: items.reduce((s, i) => s + i.reservedQuantity, 0),
  }
}
