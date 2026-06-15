package com.example.flowmerceproject.InventoryManagement.strategy;

import com.example.flowmerceproject.InventoryManagement.entity.Inventory;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import org.springframework.stereotype.Component;

@Component("RESERVED")
public class ReservedStockStrategy implements InventoryStrategy {

    @Override
    public void updateStock(Inventory inventory, int quantity) {
        int newReserved = inventory.getReservedQuantity() + quantity;
        if (newReserved < 0) {
            throw new BadRequestException(
                    "Cannot release more than reserved. Reserved: "
                            + inventory.getReservedQuantity());
        }
        if (newReserved > inventory.getQuantity()) {
            throw new BadRequestException(
                    "Cannot reserve more than total stock. Total: "
                            + inventory.getQuantity() + ", Trying to reserve: " + newReserved);
        }
        inventory.setReservedQuantity(newReserved);
    }

    @Override
    public boolean canFulfill(Inventory inventory, int quantity) {
        int available = inventory.getQuantity() - inventory.getReservedQuantity();
        return available >= quantity;
    }
}
