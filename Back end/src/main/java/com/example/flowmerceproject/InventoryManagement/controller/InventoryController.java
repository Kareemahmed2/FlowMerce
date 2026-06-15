package com.example.flowmerceproject.InventoryManagement.controller;

import com.example.flowmerceproject.InventoryManagement.dto.*;
import com.example.flowmerceproject.InventoryManagement.entity.InventoryTransaction;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    // ── Spec-compliant endpoints ───────────────────────────────────────────────

    // PATCH /products/{productId}/stock
    @PatchMapping("/products/{productId}/stock")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> updateStock(
            @PathVariable Long productId,
            @Valid @RequestBody StockUpdateRequest request,
            Principal principal) {
        inventoryService.adjustStock(
                productId, request.getQuantity(), "NORMAL",
                null, principal.getName(), null, request.getNote());
        return ResponseEntity.ok(ApiResponse.ok("Stock updated successfully"));
    }

    // GET /stores/{storeId}/inventory — MERCHANT sees own store; ADMIN sees any store
    @GetMapping("/stores/{storeId}/inventory")
    @PreAuthorize("hasRole('MERCHANT') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<InventoryResponse>>> listInventory(
            @PathVariable Integer storeId, Principal principal) {
        return ResponseEntity.ok(ApiResponse.ok(inventoryService.getStoreInventory(storeId)));
    }

    // POST /stores/{storeId}/inventory/{productId}/restock
    @PostMapping("/stores/{storeId}/inventory/{productId}/restock")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> restock(
            @PathVariable Integer storeId,
            @PathVariable Long productId,
            @Valid @RequestBody RestockRequest request,
            Principal principal) {
        inventoryService.adjustStock(
                productId, request.getQuantity(), "NORMAL",
                storeId, principal.getName(), null, request.getNote());
        return ResponseEntity.ok(ApiResponse.ok("Restock recorded successfully"));
    }

    // GET /stores/{storeId}/inventory/{productId}/history
    @GetMapping("/stores/{storeId}/inventory/{productId}/history")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<List<InventoryTransaction>>> history(
            @PathVariable Integer storeId,
            @PathVariable Long productId) {
        return ResponseEntity.ok(ApiResponse.ok(
                inventoryService.getTransactionHistory(productId)));
    }

    // ── Legacy endpoints (kept for backward compat) ───────────────────────────

    @PostMapping("/inventory/adjust")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<ApiResponse<String>> adjustStock(
            @Valid @RequestBody InventoryRequest request,
            Principal principal) {
        String strategy = request.getStrategyType() != null ? request.getStrategyType() : "NORMAL";
        inventoryService.adjustStock(
                request.getProductId(), request.getQuantity(), strategy,
                null, principal.getName(), null, null);
        return ResponseEntity.ok(ApiResponse.ok("Stock adjusted using " + strategy + " strategy"));
    }

    @PostMapping("/inventory/reserve")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<ApiResponse<String>> reserveStock(
            @Valid @RequestBody InventoryRequest request) {
        boolean success = inventoryService.reserveStock(
                request.getProductId(), request.getQuantity());
        return ResponseEntity.ok(ApiResponse.ok(
                success ? "Stock reserved successfully"
                        : "Not enough stock for product: " + request.getProductId()));
    }

    @PostMapping("/inventory/release")
    @PreAuthorize("hasRole('BUYER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> releaseStock(
            @Valid @RequestBody InventoryRequest request) {
        inventoryService.releaseStock(request.getProductId(), request.getQuantity());
        return ResponseEntity.ok(ApiResponse.ok("Stock released successfully"));
    }

    @GetMapping("/inventory/{productId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<InventoryResponse>> getAvailable(
            @PathVariable Long productId) {
        return ResponseEntity.ok(ApiResponse.ok(inventoryService.getInventoryDetails(productId)));
    }

    @GetMapping("/inventory/{productId}/check")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Boolean>> checkAvailability(
            @PathVariable Long productId,
            @RequestParam int qty) {
        return ResponseEntity.ok(ApiResponse.ok(
                inventoryService.checkAvailability(productId, qty)));
    }
}
