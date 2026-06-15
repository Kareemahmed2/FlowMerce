package com.example.flowmerceproject.StoreMangement.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

public class CatalogDTOs {

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CategoryResponse {
        private Integer categoryId;
        private Integer storeId;
        private String name;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ProductResponse {
        private Long productId;
        private Integer storeId;
        private Integer categoryId;
        private String categoryName;
        private String name;
        private String description;
        private BigDecimal price;
        /** Available stock (quantity − reserved). Populated from Inventory entity. */
        private Integer inventory;
        private Float rating;
        /** CON-7 / INT-3: first image URL per product — drives storefront product cards. */
        private List<String> images;
    }
}
