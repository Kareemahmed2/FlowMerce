package com.example.flowmerceproject.InventoryManagement.strategy;

import com.example.flowmerceproject.InventoryManagement.entity.Inventory;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import org.springframework.stereotype.Component;

@Component("FLASH")
public class FlashSaleStrategy implements InventoryStrategy {

    private static final int MAX_PER_CUSTOMER = 2;

    @Override
    public void updateStock(Inventory inventory, int quantity) {
        if (quantity > MAX_PER_CUSTOMER) {
            throw new BadRequestException(
                    "Flash sale limit: max " + MAX_PER_CUSTOMER
                            + " units per customer. Requested: " + quantity);
        }
        int newQty = inventory.getQuantity() - quantity;
        if (newQty < 0) {
            throw new BadRequestException(
                    "Flash sale stock exhausted! Remaining: " + inventory.getQuantity());
        }
        inventory.setQuantity(newQty);
    }

    @Override
    public boolean canFulfill(Inventory inventory, int quantity) {
        return quantity <= MAX_PER_CUSTOMER && inventory.getQuantity() >= quantity;
    }
}
