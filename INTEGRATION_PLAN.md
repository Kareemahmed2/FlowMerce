# Integration Plan — Cart & Product Management branches

Generated: 2026-05-21

---

## Main state facts (recorded before touching any branch code)

| Fact | Value |
|------|-------|
| Context path | `server.servlet.context-path=/api/v1` |
| `ApiResponse<T>` | exists at `com.example.flowmerceproject.common.ApiResponse` |
| Role storage | `@Enumerated(EnumType.STRING) role` on `User` — no role_id FK |
| Ownership pattern | `email → userRepository.findByEmail() → merchantRepository.findByUser_UserId()` |
| `Store.storeId` type | `Integer` |
| `Inventory.productId` type | `Long` |
| Exception classes | `BadRequestException`, `ConflictException`, `ForbiddenException`, `ResourceNotFoundException`, `UnauthorizedException` |
| `@EnableScheduling` | Already present on main Application class |
| Thin stub entities in `StoreMangement/` | `Category` (has store_id, no description), `Product` (Long productId, `price` column) |

---

## Branch 1: origin/product-mangement

### What is new (safe to copy after adaptation)
- `ProductManagement/entity/ProductMedia.java` — no conflicts, new table
- `ProductManagement/entity/Review.java` — references `Customer` correctly
- `ProductManagement/dto/CategoryDTOs.java` — clean DTO, no conflicts
- `ProductManagement/dto/ProductDTOs.java` — clean DTO, no conflicts
- `ProductManagement/dto/ReviewDTOs.java` — clean DTO, no conflicts
- `ProductManagement/repository/ProductMediaRepository.java` — no conflicts
- `ProductManagement/repository/ReviewRepository.java` — no conflicts
- `ProductManagement/service/CategoryService.java` — correct exception classes, no ownership chain needed (admin-managed)
- `ProductManagement/service/ReviewService.java` — uses Customer correctly, correct exceptions

### What needs adaptation before copying

| File | What to change | Why |
|------|---------------|-----|
| `ProductManagement/entity/Category.java` | Add optional `@ManyToOne Store store` field with `@JoinColumn(name="store_id")` | Main's schema has `store_id` on categories; public catalog filters by store |
| `ProductManagement/entity/Product.java` | Fix import: `StoreManagement.entity.Store` → `StoreMangement.entity.Store` | Package name in main has typo — `StoreMangement` not `StoreManagement` |
| `ProductManagement/repository/CategoryRepository.java` | Add `findByStore_StoreId(Integer storeId)` and `findByStore_StoreIdOrStoreIsNull` | Needed by public catalog endpoint in `StoreService` |
| `ProductManagement/repository/ProductRepository.java` | Add `findByStore_StoreIdAndCategory_CategoryId(Integer, Integer)` and `findByProductIdAndStore_StoreId(Integer, Integer)` | Needed by `StoreService.getPublicProduct()` |
| `ProductManagement/service/ProductService.java` | Fix two imports: `StoreManagement` → `StoreMangement` (entity + repository) | Same package typo |
| `ProductManagement/controller/CategoryController.java` | Remove `/api/` from `@RequestMapping`; wrap all responses in `ApiResponse<T>` | Context path is already `/api/v1`; all main endpoints use wrapper |
| `ProductManagement/controller/ProductController.java` | Remove `/api/` from `@RequestMapping`; wrap all responses in `ApiResponse<T>` | Same reasons |
| `ProductManagement/controller/ReviewController.java` | Remove `/api/` from `@RequestMapping`; wrap all responses in `ApiResponse<T>` | Same reasons |

### What conflicts with main and how to resolve

| Conflict | Resolution |
|----------|-----------|
| `StoreMangement/entity/Category.java` (thin stub, no description) vs `ProductManagement/entity/Category.java` (richer, no store_id) | **Delete** the thin stub; use `ProductManagement/entity/Category.java` with `store_id` FK added |
| `StoreMangement/entity/Product.java` (Long productId, `price` column) vs `ProductManagement/entity/Product.java` (Integer productId, `basePrice`) | **Delete** the thin stub; use `ProductManagement/entity/Product.java`; `Inventory.productId` stays `Long` — ProductService already casts with `.longValue()` |
| `StoreMangement/repository/CategoryRepository.java` vs `ProductManagement/repository/CategoryRepository.java` | **Delete** the stub; merge needed store methods into `ProductManagement/repository/CategoryRepository.java` |
| `StoreMangement/repository/ProductRepository.java` vs `ProductManagement/repository/ProductRepository.java` | **Delete** the stub; merge needed public-catalog methods into `ProductManagement/repository/ProductRepository.java` |
| `products` schema: main uses `price DECIMAL` / `inventory INT` / `rating FLOAT`; branch uses `base_price DECIMAL` / no stock column / `rating FLOAT DEFAULT 0.0` | Replace main's products table definition with branch's (richer). Remove `inventory INT` column — stock lives in `inventory` table |
| `categories` schema: main has `store_id INT FK`; branch has none | Keep `store_id` as nullable FK in the new categories definition |

### New schema tables (safe to add)
- `product_media` — new; FK → products(product_id) ON DELETE CASCADE
- `reviews` — new; FK → products, customers ON DELETE CASCADE

### Schema tables that conflict
- `products` → Replace definition (base_price, no stock column, add is_active/timestamps)
- `categories` → Replace definition (add optional store_id, add description column)

---

## Branch 2: origin/cart-management

### What is new (safe to copy after adaptation)
- `CartManagement/entity/ShoppingCart.java` — references `Customer` correctly
- `CartManagement/entity/CartItem.java` — references `ProductManagement.entity.Product` (consistent with branch 1)
- `CartManagement/entity/Wishlist.java` — references `ProductManagement.entity.Product` and `User`
- `CartManagement/dto/CartDTOs.java` — clean
- `CartManagement/dto/WishlistDTOs.java` — clean
- `CartManagement/repository/ShoppingCartRepository.java` — clean
- `CartManagement/repository/CartItemRepository.java` — clean
- `CartManagement/repository/WishlistRepository.java` — clean
- `CartManagement/service/CartService.java` — uses correct Customer pattern, correct exceptions
- `CartManagement/service/CheckoutService.java` — uses correct Customer pattern
- `CartManagement/service/WishlistService.java` — correct exceptions
- `CartManagement/service/CartCleanupScheduler.java` — `@EnableScheduling` already in main ✓

### What needs adaptation before copying

| File | What to change | Why |
|------|---------------|-----|
| `CartManagement/controller/CartController.java` | Remove `/api/` from `@RequestMapping`; wrap all responses in `ApiResponse<T>` | Context path double-prefix; wrapper required |
| `CartManagement/controller/WishlistController.java` | Remove `/api/` from `@RequestMapping`; wrap all responses in `ApiResponse<T>` | Same reasons |

### What conflicts with main and how to resolve

| Conflict | Resolution |
|----------|-----------|
| `CheckoutService.processCheckout` returns inner `CheckoutSummary` (raw object, not `ApiResponse`) | Wrap in `ApiResponse<CheckoutSummary>` in `CartController` |
| Branch schema uses stale `inventory` table definition (missing `store_id`, `updated_at`) | Ignore branch's inventory table — use main's current definition |
| Branch schema uses stale `store_settings` with `currency DEFAULT 'USD'` and missing columns | Ignore branch's store/settings tables — use main's current definitions |

### New schema tables (safe to add)
- `shopping_carts` — new
- `cart_items` — new; FK → shopping_carts, products
- `wishlists` — new; unique(user_id, product_id)

### Schema tables that conflict
- `inventory` in branch schema → ignore; use main's version (has store_id, updated_at)

---

## Integration order

1. **Update `schema.sql`** — Replace `products`/`categories` table definitions, add `product_media`, `reviews`, `shopping_carts`, `cart_items`, `wishlists`
2. **Delete thin stub entities/repos in `StoreMangement/`** — `Category.java`, `Product.java`, `CategoryRepository.java`, `ProductRepository.java`
3. **Create `ProductManagement/entity/Category.java`** — add `store_id` FK; add description
4. **Create `ProductManagement/entity/Product.java`** — fix `StoreMangement` import
5. **Create `ProductManagement/entity/ProductMedia.java`** — copy directly
6. **Create `ProductManagement/entity/Review.java`** — copy directly
7. **Create `ProductManagement/dto/*`** — copy directly (3 files)
8. **Create `ProductManagement/repository/*`** — adapt with merged methods (4 files)
9. **Create `ProductManagement/service/CategoryService.java`** — copy directly
10. **Create `ProductManagement/service/ProductService.java`** — fix imports
11. **Create `ProductManagement/service/ReviewService.java`** — copy directly
12. **Create `ProductManagement/controller/CategoryController.java`** — fix path + wrap responses
13. **Create `ProductManagement/controller/ProductController.java`** — fix path + wrap responses
14. **Create `ProductManagement/controller/ReviewController.java`** — fix path + wrap responses
15. **Create all `CartManagement/` files** — fix controller paths + wrap responses
16. **Update `StoreService.java`** — change catalog methods to use ProductManagement repos
17. **Update `StoreMangement/dto/CatalogDTOs.java`** — align response types
18. **Update `PublicStorefrontController.java`** — use ProductManagement DTOs
19. **Update `SecurityConfig.java`** — add public product/review endpoints to permitAll
20. **Update `application.properties`** — add `app.shipping.flat-rate` and `app.tax.rate`
21. **Compile and fix any remaining errors**

## Files in main that need to be updated to accommodate the new code

| File | What to add/change |
|------|--------------------|
| `StoreMangement/service/StoreService.java` | Change catalog method imports to `ProductManagement` package |
| `StoreMangement/dto/CatalogDTOs.java` | Update `ProductResponse` fields to match ProductManagement DTO |
| `StorefrontCustomization/controller/PublicStorefrontController.java` | Update imports for catalog types |
| `UserManagement/config/SecurityConfig.java` | Add `/stores/*/products/public`, `/stores/*/products/*`, `/products/*/reviews` to permitAll |
| `src/main/resources/application.properties` | Add checkout config keys |
| `src/main/resources/schema.sql` | Replace/add tables as described above |
