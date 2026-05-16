package com.example.flowmerceproject.InventoryMangement.strategy;

import com.example.flowmerceproject.InventoryMangement.entity.Inventory;

public interface InventoryStrategy {
    void updateStock(Inventory inventory, int quantity);
    boolean canFulfill(Inventory inventory, int quantity);
}