package com.example.flowmerceproject.StoreManagement.dto;

import lombok.Builder;
import lombok.Data;

public class StoreSettingsDTOs {

    @Data
    public static class UpdateSettingsRequest {
        private String currency;
        private String timezone;
        private String language;
        private String taxSettings;
        private String shippingSettings;
    }

    @Data
    @Builder
    public static class SettingsResponse {
        private Integer settingsId;
        private Integer storeId;
        private String currency;
        private String timezone;
        private String language;
        private String taxSettings;
        private String shippingSettings;
    }
}