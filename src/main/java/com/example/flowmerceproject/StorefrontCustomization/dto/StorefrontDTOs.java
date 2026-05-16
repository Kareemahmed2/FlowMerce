package com.example.flowmerceproject.StorefrontCustomization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * All DTOs for the Storefront Customization module.
 *
 * Naming conventions:
 *   *Request  → inbound payload validated by Spring before reaching the service
 *   *Response → outbound shape returned to the frontend / stored in Redis
 *   *Summary  → lightweight projection used in list fields
 */
public class StorefrontDTOs {

    // ══════════════════════════════════════════════════════════════════════════
    // STOREFRONT TEMPLATE
    // ══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class StorefrontTemplateResponse implements Serializable {
        private Long templateId;
        private Integer storeId;
        private String storeName;
        private String storeUrl;
        private String status;          // DRAFT | PUBLISHED | PAUSED
        private Integer version;
        private LocalDateTime publishedAt;
        private ThemeResponse theme;
        private List<PageSummary> pages;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    /**
     * Request body for POST /api/stores/{storeId}/storefront/init.
     * All theme colour fields are optional — spec §3.3 defaults are applied when null.
     */
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateStorefrontRequest {

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "background must be a 6-digit hex (e.g. #FFFFFF)")
        private String background;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "header must be a 6-digit hex")
        private String header;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "footer must be a 6-digit hex")
        private String footer;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "accent must be a 6-digit hex")
        private String accent;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "text must be a 6-digit hex")
        private String text;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "card must be a 6-digit hex")
        private String card;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // THEME TEMPLATE  (spec §3.3)
    // ══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ThemeResponse implements Serializable {
        private Long themeId;
        private String background;
        private String header;
        private String footer;
        private String accent;
        private String text;
        private String card;
        private LocalDateTime updatedAt;
    }

    /**
     * Request body for PUT /api/stores/{storeId}/storefront/colors.
     * Partial update — only provided fields are changed (null = no change).
     * Matches spec §3.1 "PUT /stores/:id/colors" and §3.3 schema.
     */
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateThemeRequest {

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "background must be a 6-digit hex")
        private String background;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "header must be a 6-digit hex")
        private String header;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "footer must be a 6-digit hex")
        private String footer;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "accent must be a 6-digit hex")
        private String accent;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "text must be a 6-digit hex")
        private String text;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "card must be a 6-digit hex")
        private String card;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE
    // ══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PageSummary implements Serializable {
        private Long pageId;
        private String title;
        private String slug;
        private String pageType;
        private Boolean isPublished;
        private Boolean showInNav;
        private Integer navOrder;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BASE COMPONENT
    // ══════════════════════════════════════════════════════════════════════════

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ComponentSummary implements Serializable {
        private Long componentId;
        private String componentType;
        private String name;
        private Boolean isVisible;
        private Integer sortOrder;
    }
}
