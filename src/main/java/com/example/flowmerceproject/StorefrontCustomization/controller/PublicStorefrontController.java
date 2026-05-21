package com.example.flowmerceproject.StorefrontCustomization.controller;

import com.example.flowmerceproject.StoreMangement.dto.CatalogDTOs;
import com.example.flowmerceproject.StoreMangement.service.StoreService;
import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.StorefrontTemplateResponse;
import com.example.flowmerceproject.StorefrontCustomization.service.StorefrontCustomizationService;
import com.example.flowmerceproject.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/public/storefront")
@RequiredArgsConstructor
public class PublicStorefrontController {

    private final StorefrontCustomizationService storefrontService;
    private final StoreService storeService;

    @GetMapping("/{storeId}")
    public ResponseEntity<ApiResponse<StorefrontTemplateResponse>> getStorefront(
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(storefrontService.getPublicStorefront(storeId)));
    }

    @GetMapping("/{storeId}/categories")
    public ResponseEntity<ApiResponse<List<CatalogDTOs.CategoryResponse>>> getCategories(
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(storeService.getPublicCategories(storeId)));
    }

    @GetMapping("/{storeId}/products")
    public ResponseEntity<ApiResponse<List<CatalogDTOs.ProductResponse>>> getProducts(
            @PathVariable Integer storeId,
            @RequestParam(required = false) Integer categoryId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.getPublicProducts(storeId, categoryId)));
    }

    @GetMapping("/{storeId}/products/{productId}")
    public ResponseEntity<ApiResponse<CatalogDTOs.ProductResponse>> getProduct(
            @PathVariable Integer storeId,
            @PathVariable Long productId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.getPublicProduct(storeId, productId)));
    }
}
