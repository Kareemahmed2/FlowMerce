package com.example.flowmerceproject.StoreManagement.controller;

import com.example.flowmerceproject.StoreManagement.dto.StoreDTOs;
import com.example.flowmerceproject.StoreManagement.dto.StoreSettingsDTOs;
import com.example.flowmerceproject.StoreManagement.service.StoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreService storeService;

    // POST /api/stores — merchant creates a store
    @PostMapping
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StoreDTOs.StoreResponse> createStore(
            Principal principal,
            @Valid @RequestBody StoreDTOs.CreateStoreRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(storeService.createStore(principal.getName(), request));
    }

    // GET /api/stores/me — get all my stores
    @GetMapping("/me")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<List<StoreDTOs.StoreResponse>> getMyStores(Principal principal) {
        return ResponseEntity.ok(storeService.getMyStores(principal.getName()));
    }

    // GET /api/stores/{storeId}
    @GetMapping("/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StoreDTOs.StoreResponse> getStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(storeService.getStoreById(principal.getName(), storeId));
    }

    // PUT /api/stores/{storeId}
    @PutMapping("/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StoreDTOs.StoreResponse> updateStore(
            Principal principal,
            @PathVariable Integer storeId,
            @Valid @RequestBody StoreDTOs.UpdateStoreRequest request) {
        return ResponseEntity.ok(storeService.updateStore(principal.getName(), storeId, request));
    }

    // PUT /api/stores/{storeId}/publish
    @PutMapping("/{storeId}/publish")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StoreDTOs.StoreResponse> publishStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(storeService.publishStore(principal.getName(), storeId));
    }

    // PUT /api/stores/{storeId}/deactivate
    @PutMapping("/{storeId}/deactivate")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StoreDTOs.StoreResponse> deactivateStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(storeService.deactivateStore(principal.getName(), storeId));
    }

    // DELETE /api/stores/{storeId}
    @DeleteMapping("/{storeId}")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<String> deleteStore(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(storeService.deleteStore(principal.getName(), storeId));
    }

    // GET /api/stores/{storeId}/settings
    @GetMapping("/{storeId}/settings")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StoreSettingsDTOs.SettingsResponse> getSettings(
            Principal principal, @PathVariable Integer storeId) {
        return ResponseEntity.ok(storeService.getSettings(principal.getName(), storeId));
    }

    // PUT /api/stores/{storeId}/settings
    @PutMapping("/{storeId}/settings")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<StoreSettingsDTOs.SettingsResponse> updateSettings(
            Principal principal,
            @PathVariable Integer storeId,
            @RequestBody StoreSettingsDTOs.UpdateSettingsRequest request) {
        return ResponseEntity.ok(
                storeService.updateSettings(principal.getName(), storeId, request));
    }

 //ADMIN
    // GET /api/admin/stores
    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<StoreDTOs.StoreResponse>> getAllStores() {
        return ResponseEntity.ok(storeService.getAllStores());
    }
}