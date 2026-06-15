package com.example.flowmerceproject.InventoryManagement.strategy;

import com.example.flowmerceproject.InventoryManagement.entity.Inventory;

public interface InventoryStrategy {
    void updateStock(Inventory inventory, int quantity);
    boolean canFulfill(Inventory inventory, int quantity);
}
