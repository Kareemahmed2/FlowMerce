package com.example.flowmerceproject.InventoryManagement.controller;

import com.example.flowmerceproject.InventoryManagement.dto.InventoryRequest;
import com.example.flowmerceproject.InventoryManagement.dto.InventoryResponse;
import com.example.flowmerceproject.InventoryManagement.entity.Inventory;
import com.example.flowmerceproject.InventoryManagement.repository.InventoryRepository;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
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
    private final InventoryRepository inventoryRepository;

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
        int available = inventoryService.getAvailableQuantity(productId);

        Inventory inv = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Inventory not found for product: " + productId));

        String status;
        if (inv.getQuantity() == 0)                              status = "OUT_OF_STOCK";
        else if (inv.getQuantity() <= inv.getLowStockThreshold()) status = "LOW";
        else                                                      status = "NORMAL";

        return ResponseEntity.ok(InventoryResponse.builder()
                .productId(productId)
                .availableQuantity(available)
                .reservedQuantity(inv.getReservedQuantity())
                .totalQuantity(inv.getQuantity())
                .stockStatus(status)
                .build());
    }

    // GET /api/inventory/{productId}/check?qty=5
    @GetMapping("/{productId}/check")
    public ResponseEntity<Boolean> checkAvailability(
            @PathVariable Long productId,
            @RequestParam int qty) {
        return ResponseEntity.ok(inventoryService.checkAvailability(productId, qty));
    }
}