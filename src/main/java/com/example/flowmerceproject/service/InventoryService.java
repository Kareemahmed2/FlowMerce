package com.example.flowmerceproject.service;

import com.example.flowmerceproject.Inventory.dto.InventoryResponse;

public interface InventoryService {

    void adjustStock(Long productId, int quantity);

    void reserveStock(Long productId, int quantity);

    void releaseStock(Long productId, int quantity);

    InventoryResponse getAvailableQuantity(Long productId);

    boolean checkAvailability(Long productId, int requiredQty);
}