package com.example.flowmerceproject.StoreMangement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

public class StoreDTOs {

    // REQUEST
    @Data
    public static class CreateStoreRequest {
        @NotBlank(message = "Store name is required")
        @Size(max = 150)
        private String storeName;

        @NotBlank(message = "Store URL is required")
        @Size(max = 255)
        private String storeUrl;

        private String description;
        private String logo;
    }

    @Data
    public static class UpdateStoreRequest {
        @NotBlank(message = "Store name is required")
        private String storeName;
        private String description;
        private String logo;
    }

    // RESPONSE
    @Data
    @Builder
    public static class StoreResponse {
        private Integer storeId;
        private Integer merchantId;
        private String storeName;
        private String storeUrl;
        private String description;
        private String logo;
        private String status;
        private LocalDateTime createdAt;
    }
}