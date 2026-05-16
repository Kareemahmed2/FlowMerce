package com.example.flowmerceproject.StorefrontCustomization.controller;

import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.StorefrontTemplateResponse;
import com.example.flowmerceproject.StorefrontCustomization.service.StorefrontCustomizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * PublicStorefrontController — unauthenticated endpoints for the customer-facing storefront.
 *
 * No JWT is required. These routes are added to the Spring Security permit-list in
 * {@code SecurityConfig}: {@code /api/public/storefront/**}.
 *
 * Multi-tenant routing:
 *   The Next.js middleware extracts the subdomain (e.g. "cairo-boutique" from
 *   cairo-boutique.flowmerce.io) and passes it as the storeUrl path segment.
 *   This controller resolves whichever merchant owns that slug.
 *
 * Matches spec §13.1: {@code GET /storefront/:slug}
 */
@RestController
@RequestMapping("/api/public/storefront")
@RequiredArgsConstructor
public class PublicStorefrontController {

    private final StorefrontCustomizationService service;

    /**
     * GET /api/public/storefront/{storeUrl}
     *
     * Returns the full published StorefrontTemplate — theme colours, page list,
     * store identity — for the given store URL slug.
     *
     * Implements cache-aside with Redis:
     *   • Cache hit  → returned directly without touching the database.
     *   • Cache miss → fetched from DB, stored in Redis (TTL = storefront.cache.ttl-seconds),
     *                  then returned.
     *
     * Returns 404 if no PUBLISHED storefront exists for the given storeUrl.
     *
     * Example:
     *   GET /api/public/storefront/cairo-boutique
     *   → 200 StorefrontTemplateResponse
     *
     *   GET /api/public/storefront/unknown-store
     *   → 404 { "success": false, "error": "No published storefront found for: unknown-store" }
     */
    @GetMapping("/{storeUrl}")
    public ResponseEntity<StorefrontTemplateResponse> getPublicStorefront(
            @PathVariable String storeUrl) {

        return ResponseEntity.ok(service.getPublicStorefront(storeUrl));
    }
}
