package com.example.flowmerceproject.StorefrontCustomization.controller;

import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.*;
import com.example.flowmerceproject.StorefrontCustomization.service.StorefrontCustomizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * StorefrontCustomizationController — merchant-facing storefront management.
 *
 * All routes are scoped under:
 *   /api/stores/{storeId}/storefront/...
 *
 * Route map:
 * ─────────────────────────────────────────────────────────────────────
 *  POST  /init        Create (idempotent) StorefrontTemplate + ThemeTemplate + HOME page
 *  GET   /            Fetch StorefrontTemplate for the dashboard
 *  POST  /publish     Make storefront publicly visible; bumps version counter
 *  POST  /unpublish   Pause storefront; removes it from Redis public cache
 *  GET   /colors      Fetch current ThemeTemplate (spec §3.3 colours)
 *  PUT   /colors      Partial-update theme colours with write-behind caching
 *                       (spec §3.1 PUT /stores/:id/colors)
 * ─────────────────────────────────────────────────────────────────────
 */
@RestController
@RequestMapping("/api/stores/{storeId}/storefront")
@RequiredArgsConstructor
public class StorefrontCustomizationController {

    private final StorefrontCustomizationService service;

    // ── Storefront lifecycle ──────────────────────────────────────────────────

    /**
     * POST /api/stores/{storeId}/storefront/init
     *
     * Creates a StorefrontTemplate with a default ThemeTemplate and an
     * auto-created HOME page. Idempotent — safe to call multiple times.
     * Optional body allows pre-seeding the theme colours on first creation.
     */
    @PostMapping("/init")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StorefrontTemplateResponse> initStorefront(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody(required = false) CreateStorefrontRequest request) {

        CreateStorefrontRequest req = request != null ? request : new CreateStorefrontRequest();
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(service.createStorefront(principal.getName(), storeId, req));
    }

    /**
     * GET /api/stores/{storeId}/storefront
     *
     * Returns the full StorefrontTemplate (theme + page list) for the merchant
     * dashboard builder. Reads directly from DB — not cached.
     */
    @GetMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StorefrontTemplateResponse> getStorefront(
            Principal principal,
            @PathVariable Integer storeId) {

        return ResponseEntity.ok(service.getStorefront(principal.getName(), storeId));
    }

    /**
     * POST /api/stores/{storeId}/storefront/publish
     *
     * Makes the storefront publicly visible at the store URL.
     * Increments the version counter and refreshes the Redis public cache.
     */
    @PostMapping("/publish")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StorefrontTemplateResponse> publishStorefront(
            Principal principal,
            @PathVariable Integer storeId) {

        return ResponseEntity.ok(service.publishStorefront(principal.getName(), storeId));
    }

    /**
     * POST /api/stores/{storeId}/storefront/unpublish
     *
     * Pauses the storefront (status → PAUSED). The public URL returns 404 while
     * paused. Removes the entry from the Redis public cache immediately.
     */
    @PostMapping("/unpublish")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StorefrontTemplateResponse> unpublishStorefront(
            Principal principal,
            @PathVariable Integer storeId) {

        return ResponseEntity.ok(service.unpublishStorefront(principal.getName(), storeId));
    }

    // ── Theme colours (spec §3.1 PUT /stores/:id/colors + §3.3) ─────────────

    /**
     * GET /api/stores/{storeId}/storefront/colors
     *
     * Returns the six theme colour tokens (background, header, footer,
     * accent, text, card) as defined in spec §3.3.
     */
    @GetMapping("/colors")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ThemeResponse> getTheme(
            Principal principal,
            @PathVariable Integer storeId) {

        StorefrontTemplateResponse sf = service.getStorefront(principal.getName(), storeId);
        return ResponseEntity.ok(sf.getTheme());
    }

    /**
     * PUT /api/stores/{storeId}/storefront/colors
     *
     * Partial update of the theme colour tokens. Matches spec §3.1
     * {@code PUT /stores/:id/colors} and §3.3 "Theme Colors Schema".
     *
     * Uses write-behind caching:
     *   • Cache is updated immediately → merchant receives 200 without
     *     waiting for the database write.
     *   • The database is updated asynchronously in the background.
     *
     * All fields are optional; omitted fields retain their current values.
     *
     * Example body:
     * {
     *   "background": "#F5F5F5",
     *   "accent":     "#FF6B35"
     * }
     */
    @PutMapping("/colors")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ThemeResponse> updateTheme(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody UpdateThemeRequest request) {

        return ResponseEntity.ok(service.updateTheme(principal.getName(), storeId, request));
    }
}
