package com.example.flowmerceproject.StoreMangement.dto;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

public class StoreDTOs {

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

    @Data
    public static class BrandUpdateRequest {
        @NotBlank
        private String brandName;
        private String logoUrl;
    }

    @Data
    public static class PaymentMethodsRequest {
        @NotNull
        private List<String> methods;
    }

    @Data
    public static class OnboardingStepRequest {
        @NotNull
        @Min(0) @Max(5)
        private Integer step;
    }

    @Data
    @Builder
    public static class StoreResponse {
        private Integer storeId;
        private Integer merchantId;
        private String storeName;
        private String storeUrl;
        private String description;
        private String logo;
        private Store.StoreStatus status;
        private Integer currentStep;
        private String paymentMethods;
        private LocalDateTime createdAt;
    }
}
