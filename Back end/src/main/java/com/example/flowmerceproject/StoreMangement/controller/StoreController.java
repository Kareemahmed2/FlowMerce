package com.example.flowmerceproject.StoreMangement.controller;

import com.example.flowmerceproject.StoreMangement.dto.StoreDTOs;
import com.example.flowmerceproject.StoreMangement.dto.StoreDTOs.*;
import com.example.flowmerceproject.StoreMangement.dto.StoreSettingsDTOs;
import com.example.flowmerceproject.StoreMangement.service.StoreService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreService storeService;

    @PostMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> createStore(
            Principal principal,
            @Valid @RequestBody CreateStoreRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(storeService.createStore(principal.getName(), request),
                        "Store created successfully"));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<StoreResponse>>> getMyStores(Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(storeService.getMyStores(principal.getName())));
    }

    @GetMapping("/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> getStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.getStoreById(principal.getName(), storeId)));
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<ApiResponse<StoreResponse>> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.ok(storeService.getBySlug(slug)));
    }

    /** Public — checkout UI calls this to know which methods to present to the customer. */
    @GetMapping("/{storeId}/payment-methods")
    public ResponseEntity<ApiResponse<List<String>>> getPaymentMethods(
            @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.getEnabledPaymentMethods(storeId)));
    }

    @PutMapping("/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> updateStore(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody UpdateStoreRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.updateStore(principal.getName(), storeId, request)));
    }

    @PutMapping("/{storeId}/brand")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> updateBrand(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody BrandUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.updateBrand(principal.getName(), storeId, request)));
    }

    @PutMapping("/{storeId}/payment-methods")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> updatePaymentMethods(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody PaymentMethodsRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.updatePaymentMethods(principal.getName(), storeId, request)));
    }

    @PutMapping("/{storeId}/onboarding-step")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> updateOnboardingStep(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody OnboardingStepRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.updateOnboardingStep(principal.getName(), storeId, request)));
    }

    @PostMapping("/{storeId}/publish")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> publishStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.publishStore(principal.getName(), storeId)));
    }

    @PostMapping("/{storeId}/unpublish")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreResponse>> unpublishStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.unpublishStore(principal.getName(), storeId)));
    }

    @DeleteMapping("/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> deleteStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.deleteStore(principal.getName(), storeId)));
    }

    @GetMapping("/{storeId}/settings")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreSettingsDTOs.SettingsResponse>> getSettings(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.getSettings(principal.getName(), storeId)));
    }

    @PutMapping("/{storeId}/settings")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<StoreSettingsDTOs.SettingsResponse>> updateSettings(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestBody StoreSettingsDTOs.UpdateSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                storeService.updateSettings(principal.getName(), storeId, request)));
    }

}
