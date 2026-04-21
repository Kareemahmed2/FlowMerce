package com.example.flowmerceproject.Inventory.controller;

import com.example.flowmerceproject.Inventory.dto.InventoryRequest;
import com.example.flowmerceproject.Inventory.dto.InventoryResponse;
import com.example.flowmerceproject.Inventory.service.InventoryService;
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

    // POST /api/inventory/adjust — merchant only
    @PostMapping("/adjust")
    @PreAuthorize("hasRole('MERCHANT')")
    public ResponseEntity<String> adjustStock(@Valid @RequestBody InventoryRequest request) {
        inventoryService.adjustStock(request.getProductId(), request.getQuantity());
        return ResponseEntity.ok("Stock adjusted successfully");
    }

    // POST /api/inventory/reserve — internal use (called by order service)
    @PostMapping("/reserve")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<String> reserveStock(@Valid @RequestBody InventoryRequest request) {
        boolean success = inventoryService.reserveStock(
                request.getProductId(), request.getQuantity());
        if (!success) {
            return ResponseEntity.badRequest().body(
                    "Not enough stock available for product: " + request.getProductId());
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

    // GET /api/inventory/{productId} — check available stock (public)
    @GetMapping("/{productId}")
    public ResponseEntity<InventoryResponse> getAvailable(@PathVariable Long productId) {
        int available = inventoryService.getAvailableQuantity(productId);
        return ResponseEntity.ok(
                InventoryResponse.builder()
                        .productId(productId)
                        .availableQuantity(available)
                        .build()
        );
    }

    // GET /api/inventory/{productId}/check?qty=5 — check if enough stock exists
    @GetMapping("/{productId}/check")
    public ResponseEntity<Boolean> checkAvailability(
            @PathVariable Long productId,
            @RequestParam int qty) {
        return ResponseEntity.ok(inventoryService.checkAvailability(productId, qty));
    }
}