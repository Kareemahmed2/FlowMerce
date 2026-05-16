package com.example.flowmerceproject.StorefrontCustomization.controller;

import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.StorefrontTemplateResponse;
import com.example.flowmerceproject.StorefrontCustomization.service.StorefrontCustomizationService;
import com.example.flowmerceproject.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/public/storefront")
@RequiredArgsConstructor
public class PublicStorefrontController {

    private final StorefrontCustomizationService service;

    @GetMapping("/{storeUrl}")
    public ResponseEntity<ApiResponse<StorefrontTemplateResponse>> getPublicStorefront(
            @PathVariable String storeUrl) {
        return ResponseEntity.ok(ApiResponse.ok(service.getPublicStorefront(storeUrl)));
    }
}
