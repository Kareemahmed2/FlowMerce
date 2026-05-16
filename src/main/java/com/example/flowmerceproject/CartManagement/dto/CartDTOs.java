package com.example.flowmerceproject.CartManagement.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class CartDTOs {

    // ─REQUESTS
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
        @NotNull(message = "Shipping address is required")
        private String shippingAddress;

        private String billingAddress;

        @NotNull(message = "Payment method is required")
        private String paymentMethod; // till now will be STRIPE
    }

    // ─RESPONSES

    @Data
    @Builder
    public static class CartItemResponse {
        private Integer cartItemId;
        private Integer productId;
        private String productName;
        private String productImage;  // first media URL
        private Integer quantity;
        private BigDecimal priceAtAdd;
        private BigDecimal subtotal;  // quantity * priceAtAdd
        private Integer availableStock; // from Inventory
        private LocalDateTime addedAt;
    }

    @Data
    @Builder
    public static class CartResponse {
        private Integer cartId;
        private Integer customerId;
        private List<CartItemResponse> items;
        private int totalItems;         // total number of items
        private BigDecimal subtotal;    // sum of all items
        private LocalDateTime createdAt;
        private LocalDateTime expiresAt;
    }
}