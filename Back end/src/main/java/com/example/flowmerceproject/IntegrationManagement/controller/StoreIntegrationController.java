package com.example.flowmerceproject.IntegrationManagement.controller;

import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.IntegrationStatusResponse;
import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.SaveCredentialsRequest;
import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.SetEnabledRequest;
import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.TestConnectionResponse;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;
import com.example.flowmerceproject.IntegrationManagement.service.StoreIntegrationService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/stores/{storeId}/integrations")
@RequiredArgsConstructor
public class StoreIntegrationController {

    private final StoreIntegrationService integrationService;

    @GetMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<IntegrationStatusResponse>>> list(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.listForStore(principal.getName(), storeId)));
    }

    @PutMapping("/{provider}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<IntegrationStatusResponse>> saveCredentials(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Provider provider,
            @Valid @RequestBody SaveCredentialsRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.saveCredentials(principal.getName(), storeId, provider, request),
                "Credentials saved"));
    }

    @PutMapping("/{provider}/enabled")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<IntegrationStatusResponse>> setEnabled(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Provider provider,
            @Valid @RequestBody SetEnabledRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.setEnabled(principal.getName(), storeId, provider, request.getEnabled())));
    }

    @PostMapping("/{provider}/test")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<TestConnectionResponse>> testConnection(
            Principal principal,
            @PathVariable Integer storeId,
            @PathVariable Provider provider) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.testConnection(principal.getName(), storeId, provider)));
    }
}
