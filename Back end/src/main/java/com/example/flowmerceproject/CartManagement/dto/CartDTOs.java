package com.example.flowmerceproject.CartManagement.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class CartDTOs {

    @Data
    public static class AddToCartRequest {
        @NotNull(message = "Product ID is required")
        private Integer productId;

        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;
    }

    @Data
    public static class UpdateQuantityRequest {
        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;
    }

    @Data
    public static class CheckoutRequest {
        @NotNull(message = "Store ID is required")
        private Integer storeId;

        @NotNull(message = "Shipping address is required")
        private String shippingAddress;

        private String billingAddress;

        @NotNull(message = "Payment method is required")
        private String paymentMethod;

        private String idempotencyKey;

        /**
         * INT-11: optional client-supplied items for cart reconciliation.
         * When the server-side cart is empty (e.g. guest-added items before login),
         * CheckoutService will sync these items into the cart before processing.
         * If the server cart already has items, this field is ignored.
         */
        private List<CartItemRequest> items;

        @Data
        public static class CartItemRequest {
            private Integer productId;
            private Integer quantity;
        }
    }

    @Data
    @Builder
    public static class CartItemResponse {
        private Integer cartItemId;
        private Integer productId;
        private String productName;
        private String productImage;
        private Integer quantity;
        private BigDecimal priceAtAdd;
        private BigDecimal subtotal;
        private Integer availableStock;
        private LocalDateTime addedAt;
    }

    @Data
    @Builder
    public static class CartResponse {
        private Integer cartId;
        private Integer customerId;
        private Integer storeId;
        private List<CartItemResponse> items;
        private int totalItems;
        private BigDecimal subtotal;
        private LocalDateTime createdAt;
        private LocalDateTime expiresAt;
    }
}
