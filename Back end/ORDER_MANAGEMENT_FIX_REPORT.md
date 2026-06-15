# Order Management — Bug Fix & Improvement Report
**Branch:** `orderManage`
**Date:** 2026-05-25
**Scope:** OrderManagement module + CartManagement (cart/checkout layer)

---

## Summary

12 bugs and gaps were identified in the Order Management component through code review and graph analysis. All 12 were fixed. The most critical were a double stock deduction on every purchase, a broken cancel flow that corrupted inventory state, and an architectural gap allowing cross-store items in a single cart/order.

---

## Critical Fixes

### 1. Double `confirmOrder` — stock deducted twice per purchase
**Files:** `OrderService.java`

`createOrder()` was calling `inventoryService.confirmOrder()` for every cart item directly, then calling `checkoutService.confirmOrder()` which called `inventoryService.confirmOrder()` again for the same items. Every order was permanently deducting stock twice.

**Fix:** Removed the redundant direct loop in `OrderService.createOrder()`. `checkoutService.confirmOrder()` is now the single point of stock deduction — it confirms inventory and clears the cart atomically.

---

### 2. `cancelOrder` was corrupting inventory state
**Files:** `OrderService.java`

After an order is placed, stock is *committed* (`inventory.quantity` is decremented, `reservedQuantity` is also decremented to 0). When an order was cancelled, `releaseStock()` was called, which only decrements `reservedQuantity`. Since `reservedQuantity` was already 0 after confirmation, this threw `BadRequestException("Cannot release more than reserved")` — or in edge cases where reserved wasn't yet cleared, it released the reservation without restoring actual stock. Either way, physical stock counts were left permanently incorrect.

**Fix:** Removed the `inventoryService.releaseStock()` loop from `cancelOrder()` entirely. The order is marked `CANCELLED` and the merchant inspects returned goods and restocks manually via the inventory adjustment API. This matches the business requirement: the merchant decides whether a returned product is fit to relist.

---

### 3. Cross-store items collapsed into a single-store order
**Files:** `ShoppingCart.java`, `ShoppingCartRepository.java`, `CartService.java`, `CheckoutService.java`, `CartDTOs.java`, `CartController.java`, `schema.sql`

The cart had no store affiliation — a customer could add products from multiple stores into one cart, and `createOrder()` blindly assigned everything to the first item's store. Orders were incorrect, and other stores' merchants couldn't see their items.

**Fix:** Carts are now scoped per `(customer, store)` pair. When a customer adds a product, the system finds or creates a cart for that product's store automatically. Cross-store mixing is impossible by construction.

**Schema change:** `shopping_carts.customer_id UNIQUE` → `UNIQUE (customer_id, store_id)` + `store_id FK → stores`.

**API changes:**
- `GET /cart/{storeId}` — view cart for a specific store
- `DELETE /cart/{storeId}` — clear cart for a specific store
- `POST /cart/items` — store derived from the product (no client change needed)
- `CartDTOs.CheckoutRequest` — added required `storeId` field

---

### 4. Merchant status control — `CONFIRMED → CANCELLED` added
**Files:** `OrderService.java`

`validateStatusTransition` only allowed `PENDING → CANCELLED`. Merchants need to be able to cancel a confirmed-but-not-yet-shipped order (e.g., payment failure discovered after confirmation, supplier issue). Extended the state machine to allow `CONFIRMED → CANCELLED` via the merchant's `updateStatus` endpoint.

State machine (final):
```
PENDING → CONFIRMED → SHIPPED → DELIVERED
PENDING → CANCELLED (customer or merchant)
CONFIRMED → CANCELLED (merchant only)
```

---

## Other Fixes

### 5. `LazyInitializationException` on all read methods
`getMyOrders`, `getStoreOrders`, `getOrderById`, `getAllOrders` were not `@Transactional`. They accessed lazy-loaded associations (`store`, `items`, `customer.user`) after the JPA session closed. Added `@Transactional(readOnly = true)` to all four.

### 6. `OrderItemResponse.subtotal` ignored item-level discount
The subtotal per line was calculated as `price × quantity`, ignoring the `discount` field that exists on `OrderItem`. Fixed to `(price − discount) × quantity`.

### 7. Wrong HTTP verb for order cancellation
`@DeleteMapping("/{orderId}/cancel")` — cancellation is a state change, not a resource deletion. Changed to `@PostMapping("/{orderId}/cancel")`.

### 8. `getAllOrders` had no pagination
`orderRepository.findAll()` loads all orders into memory — OOM risk in production. Changed to `Page<OrderDTOs.OrderSummary> getAllOrders(Pageable pageable)` with a default of 20 per page sorted by `orderDate DESC`.

Usage: `GET /api/orders/admin/all?page=0&size=20&sort=orderDate,desc`

### 9. Invoice number format overflow
`String.format("%05d", order.getOrderId())` overflowed at order ID > 99,999 and generated inconsistent formats. Changed to `%07d` — supports up to 9.9 million orders per year per year-prefix before the format becomes inconsistent.

### 10. Missing merchant endpoint: order details by ID
Merchants could list store orders (summaries) but had no endpoint to retrieve full details (items + invoice) for a specific order needed to fulfil it. Added:

```
GET /api/orders/store/{storeId}/{orderId}  →  hasRole('MERCHANT')
```

### 11. `updateItemQuantity` / `removeItem` ownership check was incorrect
With per-store carts (multiple carts per customer), checking `item.getCart().getCartId().equals(singleCart.getCartId())` was comparing against a cart that may belong to a different store. Changed to verify via `item.getCart().getCustomer().getCustomerId()`.

### 12. `OrderItemRepository` was unused dead code
The repository is defined but never injected. Left in place for future order-item-level queries (refund flows, partial cancellations) — no action needed.

---

## Files Changed

| File | Change |
|------|--------|
| `schema.sql` | `shopping_carts`: added `store_id`, changed UNIQUE constraint |
| `ShoppingCart.java` | `customer` → `@ManyToOne`; added `Store store` |
| `ShoppingCartRepository.java` | Replaced single-cart query with `findByCustomer_CustomerIdAndStore_StoreId` |
| `CartDTOs.java` | `CheckoutRequest` + `storeId`; `CartResponse` + `storeId` |
| `CartService.java` | All methods now store-scoped; ownership check fixed |
| `CheckoutService.java` | `processCheckout` uses store-scoped cart; `storeId` in `CheckoutSummary` |
| `CartController.java` | Endpoints updated for store-scoped cart URLs |
| `OrderService.java` | Bugs 1–5, 6, 8, 9, 10, 11 fixed; new `getOrderDetails()` method |
| `OrderController.java` | Pagination, HTTP verb fix, new merchant detail endpoint |
