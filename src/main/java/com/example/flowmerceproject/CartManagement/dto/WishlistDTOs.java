package com.example.flowmerceproject.CartManagement.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class WishlistDTOs {

    @Data
    public static class AddToWishlistRequest {
        @NotNull(message = "Product ID is required")
        private Integer productId;
    }

    @Data
    @Builder
    public static class WishlistItemResponse {
        private Integer wishlistId;
        private Integer productId;
        private String productName;
        private String productImage;
        private BigDecimal basePrice;
        private Integer availableStock;
        private Boolean isActive;
        private LocalDateTime addedAt;
    }

    @Data
    @Builder
    public static class WishlistResponse {
        private Integer userId;
        private List<WishlistItemResponse> items;
        private int totalItems;
    }
}