package com.example.flowmerceproject.StorefrontCustomization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

public class StorefrontDTOs {

    // ── STOREFRONT TEMPLATE ───────────────────────────────────────────────────

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class StorefrontTemplateResponse implements Serializable {
        private Long templateId;
        private Integer storeId;
        private String storeName;
        private String storeUrl;
        private String status;
        private Integer version;
        private LocalDateTime publishedAt;
        private ThemeResponse theme;
        private List<PageSummary> pages;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateStorefrontRequest {
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

    // ── THEME ─────────────────────────────────────────────────────────────────

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

    // ── PAGE ──────────────────────────────────────────────────────────────────

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

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PageResponse implements Serializable {
        private Long pageId;
        private String title;
        private String slug;
        private String pageType;
        private Boolean isPublished;
        private Boolean showInNav;
        private Integer navOrder;
        private String metaDescription;
        private List<ComponentResponse> components;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    // ── COMPONENT ─────────────────────────────────────────────────────────────

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ComponentSummary implements Serializable {
        private Long componentId;
        private String componentType;
        private String name;
        private Boolean isVisible;
        private Integer sortOrder;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ComponentResponse implements Serializable {
        private Long componentId;
        private String componentType;
        private String name;
        private String content;
        private Boolean isVisible;
        private Integer sortOrder;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    // ── DECORATOR (stub — no entity exists) ──────────────────────────────────

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DecoratorResponse implements Serializable {
        private String message;
    }

    // ── DESIGN (alias for theme) ──────────────────────────────────────────────

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DesignResponse implements Serializable {
        private Long themeId;
        private String background;
        private String header;
        private String footer;
        private String accent;
        private String text;
        private String card;
        private LocalDateTime updatedAt;
    }

    // ── MEDIA ─────────────────────────────────────────────────────────────────

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MediaRequest {
        @NotBlank(message = "url is required")
        private String url;
        private String name;
        private String mediaType;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MediaResponse implements Serializable {
        private Long mediaId;
        private Integer storeId;
        private String url;
        private String name;
        private String mediaType;
        private LocalDateTime uploadedAt;
    }
}
