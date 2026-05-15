package com.example.flowmerceproject.InventoryManagement.service;

import org.springframework.transaction.annotation.Transactional;

public interface InventoryService {

    // Load stock from DB into Redis cache on startup or on demand
    void cacheStock(Long productId, int quantity);

    // ADD or SUBTRACT stock — updates both Redis AND DB
    void adjustStock(Long productId, int quantity);

    // Updates DB first, then syncs Redis
    @Transactional
    void adjustStock(Long productId, int quantity, String strategyType);

    boolean reserveStock(Long productId, int quantity);

    void releaseStock(Long productId, int quantity);

    // Get available quantity — reads from Redis, falls back to DB
    int getAvailableQuantity(Long productId);

    boolean checkAvailability(Long productId, int requiredQty);

    // Called when order is confirmed — permanently reduces DB stock
    void confirmOrder(Long productId, int quantity);
}