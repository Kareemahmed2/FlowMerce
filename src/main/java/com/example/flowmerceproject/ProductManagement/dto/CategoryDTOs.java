package com.example.flowmerceproject.ProductManagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;

public class CategoryDTOs {

    @Data
    public static class CategoryRequest {
        @NotBlank(message = "Category name is required")
        private String name;
        private String description;
    }

    @Data
    @Builder
    public static class CategoryResponse {
        private Integer categoryId;
        private Integer storeId;
        private String name;
        private String description;
    }
}
