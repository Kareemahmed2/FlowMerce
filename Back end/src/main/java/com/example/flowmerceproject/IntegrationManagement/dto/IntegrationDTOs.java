package com.example.flowmerceproject.IntegrationManagement.dto;

import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

public class IntegrationDTOs {

    @Data
    public static class SaveCredentialsRequest {
        @NotEmpty(message = "Credentials are required")
        private Map<@NotBlank String, @NotBlank String> credentials;
    }

    @Data
    public static class SetEnabledRequest {
        @NotNull(message = "enabled is required")
        private Boolean enabled;
    }

    /**
     * Never carries decrypted credential values — only enough to render the
     * dashboard's connected/disconnected state. Editing means resubmitting
     * every field; there is no "view existing secret" path.
     */
    @Data
    @Builder
    public static class IntegrationStatusResponse {
        private StoreIntegration.Provider provider;
        private boolean enabled;
        private boolean configured;
        private String maskedPreview;
        private LocalDateTime lastVerifiedAt;
        private StoreIntegration.VerificationStatus lastVerifiedStatus;
    }

    @Data
    @Builder
    public static class TestConnectionResponse {
        private boolean success;
        private String message;
    }
}
