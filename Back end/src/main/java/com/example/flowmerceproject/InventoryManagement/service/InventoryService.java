package com.example.flowmerceproject.InventoryManagement.service;

import com.example.flowmerceproject.InventoryManagement.dto.InventoryResponse;
import com.example.flowmerceproject.InventoryManagement.entity.InventoryTransaction;

import java.util.List;

public interface InventoryService {

    void cacheStock(Long productId, int quantity);

    void adjustStock(Long productId, int quantity);

    void adjustStock(Long productId, int quantity, String strategyType);

    void adjustStock(Long productId, int quantity, String strategyType,
                     Integer storeId, String createdBy, String referenceId, String note);

    boolean reserveStock(Long productId, int quantity);

    void releaseStock(Long productId, int quantity);

    int getAvailableQuantity(Long productId);

    boolean checkAvailability(Long productId, int requiredQty);

    InventoryResponse getInventoryDetails(Long productId);

    List<InventoryResponse> getStoreInventory(Integer storeId);

    void confirmOrder(Long productId, int quantity);

    List<InventoryTransaction> getTransactionHistory(Long productId);
}
