package com.example.flowmerceproject.StorefrontCustomization.controller;

import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs;
import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.*;
import com.example.flowmerceproject.StorefrontCustomization.service.StorefrontCustomizationService;
import com.example.flowmerceproject.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/stores/{storeId}/storefront")
@RequiredArgsConstructor
public class StorefrontCustomizationController {

    private final StorefrontCustomizationService service;
    private final ObjectMapper objectMapper;

    // ── LIFECYCLE ─────────────────────────────────────────────────────────────

    @PostMapping("/init")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StorefrontTemplateResponse>> initStorefront(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody(required = false) CreateStorefrontRequest request) {
        CreateStorefrontRequest req = request != null ? request : new CreateStorefrontRequest();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        service.createStorefront(principal.getName(), storeId, req),
                        "Storefront initialised"));
    }

    @GetMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StorefrontTemplateResponse>> getStorefront(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.getStorefront(principal.getName(), storeId)));
    }

    @PostMapping("/publish")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StorefrontTemplateResponse>> publishStorefront(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.publishStorefront(principal.getName(), storeId)));
    }

    @PostMapping("/unpublish")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StorefrontTemplateResponse>> unpublishStorefront(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.unpublishStorefront(principal.getName(), storeId)));
    }

    // ── DESIGN ────────────────────────────────────────────────────────────────

    @GetMapping("/design")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<DesignResponse>> getDesign(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.getDesign(principal.getName(), storeId)));
    }

    @PutMapping("/design")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<DesignResponse>> saveDesign(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.ok(ApiResponse.ok(
                service.saveDesign(principal.getName(), storeId, data)));
    }

    @GetMapping("/colors")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ThemeResponse>> getTheme(
            Principal principal, @PathVariable Integer storeId) {
        StorefrontTemplateResponse sf = service.getStorefront(principal.getName(), storeId);
        return ResponseEntity.ok(ApiResponse.ok(sf.getTheme()));
    }

    @PutMapping("/colors")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ThemeResponse>> updateTheme(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody UpdateThemeRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.updateTheme(principal.getName(), storeId, request)));
    }

    // ── PAGES ─────────────────────────────────────────────────────────────────

    @GetMapping("/pages")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<PageSummary>>> listPages(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.listPages(principal.getName(), storeId)));
    }

    @PostMapping("/pages")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<PageResponse>> createPage(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        service.createPage(principal.getName(), storeId, data),
                        "Page created"));
    }

    @GetMapping("/pages/{pageId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<PageResponse>> getPage(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.getPage(principal.getName(), storeId, pageId)));
    }

    @PutMapping("/pages/{pageId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<PageResponse>> updatePage(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.ok(ApiResponse.ok(
                service.updatePage(principal.getName(), storeId, pageId, data)));
    }

    @DeleteMapping("/pages/{pageId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> deletePage(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId) {
        service.deletePage(principal.getName(), storeId, pageId);
        return ResponseEntity.ok(ApiResponse.ok("Page deleted"));
    }

    // ── COMPONENTS ────────────────────────────────────────────────────────────

    @GetMapping("/pages/{pageId}/components")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<ComponentResponse>>> listComponents(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.listComponents(principal.getName(), storeId, pageId)));
    }

    @PostMapping("/pages/{pageId}/components")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ComponentResponse>> addComponent(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        service.addComponent(principal.getName(), storeId, pageId, data),
                        "Component added"));
    }

    @PutMapping("/pages/{pageId}/components/{componentId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<ComponentResponse>> updateComponent(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId,
            @PathVariable Long componentId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.ok(ApiResponse.ok(
                service.updateComponent(principal.getName(), storeId, pageId, componentId, data)));
    }

    @DeleteMapping("/pages/{pageId}/components/{componentId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> deleteComponent(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId,
            @PathVariable Long componentId) {
        service.deleteComponent(principal.getName(), storeId, pageId, componentId);
        return ResponseEntity.ok(ApiResponse.ok("Component deleted"));
    }

    @PutMapping("/pages/{pageId}/components/reorder")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<ComponentResponse>>> reorderComponents(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long pageId,
            @RequestBody List<Map<String, Object>> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.ok(ApiResponse.ok(
                service.reorderComponents(principal.getName(), storeId, pageId, data)));
    }

    // ── DECORATORS ────────────────────────────────────────────────────────────

    @GetMapping("/components/{componentId}/decorators")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<DecoratorResponse>>> listDecorators(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long componentId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.listDecorators(principal.getName(), storeId, componentId)));
    }

    @PostMapping("/components/{componentId}/decorators")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<DecoratorResponse>> addDecorator(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long componentId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.ok(ApiResponse.ok(
                service.addDecorator(principal.getName(), storeId, componentId, data)));
    }

    @PutMapping("/components/{componentId}/decorators/{decoratorId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<DecoratorResponse>> updateDecorator(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long componentId,
            @PathVariable Long decoratorId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.ok(ApiResponse.ok(
                service.updateDecorator(principal.getName(), storeId, componentId, decoratorId, data)));
    }

    @DeleteMapping("/components/{componentId}/decorators/{decoratorId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> deleteDecorator(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long componentId,
            @PathVariable Long decoratorId) {
        service.deleteDecorator(principal.getName(), storeId, componentId, decoratorId);
        return ResponseEntity.ok(ApiResponse.ok("Decorator deleted"));
    }

    // ── MEDIA ─────────────────────────────────────────────────────────────────

    @GetMapping("/media")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<StorefrontDTOs.MediaResponse>>> listMedia(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.listMedia(principal.getName(), storeId)));
    }

    @PostMapping("/media")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StorefrontDTOs.MediaResponse>> saveMedia(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestBody Map<String, Object> rawData) {
        JsonNode data = objectMapper.valueToTree(rawData);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                service.saveMedia(principal.getName(), storeId, data), "Media saved"));
    }

    @DeleteMapping("/media/{mediaId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> deleteMedia(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Long mediaId) {
        service.deleteMedia(principal.getName(), storeId, mediaId);
        return ResponseEntity.ok(ApiResponse.ok("Media deleted"));
    }
}
