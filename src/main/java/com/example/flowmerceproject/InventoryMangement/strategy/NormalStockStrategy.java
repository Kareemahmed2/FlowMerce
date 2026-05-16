package com.example.flowmerceproject.InventoryMangement.strategy;

import com.example.flowmerceproject.InventoryMangement.entity.Inventory;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import org.springframework.stereotype.Component;

@Component("NORMAL")
public class NormalStockStrategy implements InventoryStrategy {

    @Override
    public void updateStock(Inventory inventory, int quantity) {
        int newQty = inventory.getQuantity() + quantity;
        if (newQty < 0) {
            throw new BadRequestException(
                    "Insufficient stock. Available: " + inventory.getQuantity()
                            + ", Requested: " + Math.abs(quantity));
        }
        inventory.setQuantity(newQty);
    }

    @Override
    public boolean canFulfill(Inventory inventory, int quantity) {
        int available = inventory.getQuantity() - inventory.getReservedQuantity();
        return available >= quantity;
    }
}