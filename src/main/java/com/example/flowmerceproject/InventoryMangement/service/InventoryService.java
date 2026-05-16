package com.example.flowmerceproject.InventoryMangement.service;

import com.example.flowmerceproject.InventoryMangement.dto.InventoryResponse;

public interface InventoryService {

    // Load stock from DB into Redis cache on startup or on demand
    void cacheStock(Long productId, int quantity);

    // ADD or SUBTRACT stock using NORMAL strategy (signed quantity: + adds, - removes)
    void adjustStock(Long productId, int quantity);

    // ADD or SUBTRACT stock using the given strategy — updates DB then syncs Redis
    void adjustStock(Long productId, int quantity, String strategyType);

    boolean reserveStock(Long productId, int quantity);

    void releaseStock(Long productId, int quantity);

    // Get available quantity — reads from Redis, falls back to DB
    int getAvailableQuantity(Long productId);

    boolean checkAvailability(Long productId, int requiredQty);

    // Full inventory snapshot for a product (used by the controller response)
    InventoryResponse getInventoryDetails(Long productId);

    // Called when order is confirmed — permanently reduces DB stock
    void confirmOrder(Long productId, int quantity);
}