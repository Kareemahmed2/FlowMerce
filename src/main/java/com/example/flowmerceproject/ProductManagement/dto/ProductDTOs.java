package com.example.flowmerceproject.ProductManagement.dto;

import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class ProductDTOs {

    @Data
    public static class CreateProductRequest {
        @NotBlank(message = "Product name is required")
        private String name;

        private String description;

        @NotNull(message = "Price is required")
        @DecimalMin(value = "0.01", message = "Price must be greater than 0")
        private BigDecimal basePrice;

        private Integer categoryId;

        @Min(value = 0, message = "Quantity cannot be negative")
        private Integer initialQuantity = 0;

        @Min(value = 1, message = "Low stock threshold must be at least 1")
        private Integer lowStockThreshold = 10;
    }

    @Data
    public static class UpdateProductRequest {
        private String name;
        private String description;
        @DecimalMin(value = "0.01")
        private BigDecimal basePrice;
        private Integer categoryId;
    }

    @Data
    @Builder
    public static class ProductResponse {
        private Integer productId;
        private Integer storeId;
        private String storeName;
        private Integer categoryId;
        private String categoryName;
        private String name;
        private String description;
        private BigDecimal basePrice;

        private Integer availableQuantity;
        private Boolean isActive;
        private Double rating;
        private List<MediaResponse> media;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    @Builder
    public static class MediaResponse {
        private Integer mediaId;
        private String mediaUrl;
        private String mediaType;
        private String altText;
    }

    @Data
    public static class AddMediaRequest {
        @NotBlank(message = "Media URL is required")
        private String mediaUrl;
        private String mediaType = "IMAGE";
        private String altText;
    }
}