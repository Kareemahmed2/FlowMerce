package com.example.flowmerceproject.Inventory.controller;

import com.example.flowmerceproject.Inventory.dto.InventoryRequest;
import com.example.flowmerceproject.Inventory.dto.InventoryResponse;
import com.example.flowmerceproject.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @PostMapping("/adjust")
    public String adjustStock(@RequestBody InventoryRequest request) {
        inventoryService.adjustStock(request.getProductId(), request.getQuantity());
        return "Stock adjusted successfully";
    }

    @PostMapping("/reserve")
    public String reserveStock(@RequestBody InventoryRequest request) {
        inventoryService.reserveStock(request.getProductId(), request.getQuantity());
        return "Stock reserved successfully";
    }

    @PostMapping("/release")
    public String releaseStock(@RequestBody InventoryRequest request) {
        inventoryService.releaseStock(request.getProductId(), request.getQuantity());
        return "Stock released successfully";
    }

    @GetMapping("/{productId}")
    public InventoryResponse getAvailable(@PathVariable Long productId) {
        return inventoryService.getAvailableQuantity(productId);
    }
}