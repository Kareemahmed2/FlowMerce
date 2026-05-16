package com.example.flowmerceproject.InventoryMangement.controller;

import com.example.flowmerceproject.InventoryMangement.dto.InventoryRequest;
import com.example.flowmerceproject.InventoryMangement.dto.InventoryResponse;
import com.example.flowmerceproject.InventoryMangement.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    // POST /api/inventory/adjust — merchant adjusts stock
    // strategyType in body: NORMAL, FLASH
    @PostMapping("/adjust")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<String> adjustStock(@Valid @RequestBody InventoryRequest request) {
        inventoryService.adjustStock(
                request.getProductId(),
                request.getQuantity(),
                request.getStrategyType() != null ? request.getStrategyType() : "NORMAL"
        );
        return ResponseEntity.ok("Stock adjusted successfully using "
                + request.getStrategyType() + " strategy");
    }

    // POST /api/inventory/reserve — called during checkout
    @PostMapping("/reserve")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<String> reserveStock(@Valid @RequestBody InventoryRequest request) {
        boolean success = inventoryService.reserveStock(
                request.getProductId(), request.getQuantity());
        if (!success) {
            return ResponseEntity.badRequest()
                    .body("Not enough stock for product: " + request.getProductId());
        }
        return ResponseEntity.ok("Stock reserved successfully");
    }

    // POST /api/inventory/release — called on order cancellation
    @PostMapping("/release")
    @PreAuthorize("hasRole('BUYER') or hasRole('ADMIN')")
    public ResponseEntity<String> releaseStock(@Valid @RequestBody InventoryRequest request) {
        inventoryService.releaseStock(request.getProductId(), request.getQuantity());
        return ResponseEntity.ok("Stock released successfully");
    }

    // GET /api/inventory/{productId} — get available stock (public)
    @GetMapping("/{productId}")
    public ResponseEntity<InventoryResponse> getAvailable(@PathVariable Long productId) {
        return ResponseEntity.ok(inventoryService.getInventoryDetails(productId));
    }

    // GET /api/inventory/{productId}/check?qty=5
    @GetMapping("/{productId}/check")
    public ResponseEntity<Boolean> checkAvailability(
            @PathVariable Long productId,
            @RequestParam int qty) {
        return ResponseEntity.ok(inventoryService.checkAvailability(productId, qty));
    }
}