package UserManagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;

public class MerchantDTOs {

    @Data
    public static class MerchantRequest {
        @NotBlank(message = "Business name is required")
        private String businessName;
    }

    @Data
    @Builder
    public static class MerchantResponse {
        private Integer merchantId;
        private Integer userId;
        private String businessName;
        private Boolean isVerified;
        private String email;
        private String fullName;
    }
}