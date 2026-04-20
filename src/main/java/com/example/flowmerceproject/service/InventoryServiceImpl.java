package com.example.flowmerceproject.service;

import com.example.flowmerceproject.Inventory.dto.InventoryResponse;
import com.example.flowmerceproject.Inventory.entity.Inventory;
import com.example.flowmerceproject.Inventory.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;

    private Inventory getInventoryOrThrow(Long productId) {
        return inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new RuntimeException("Inventory not found for product: " + productId));
    }

    @Override
    public void adjustStock(Long productId, int quantity) {
        Inventory inventory = getInventoryOrThrow(productId);

        inventory.setQuantity(inventory.getQuantity() + quantity);
        inventoryRepository.save(inventory);
    }

    @Override
    public void reserveStock(Long productId, int quantity) {
        Inventory inventory = getInventoryOrThrow(productId);

        int available = inventory.getQuantity() - inventory.getReservedQuantity();

        if (available < quantity) {
            throw new RuntimeException("Not enough stock available");
        }

        inventory.setReservedQuantity(inventory.getReservedQuantity() + quantity);
        inventoryRepository.save(inventory);
    }

    @Override
    public void releaseStock(Long productId, int quantity) {
        Inventory inventory = getInventoryOrThrow(productId);

        inventory.setReservedQuantity(inventory.getReservedQuantity() - quantity);
        inventoryRepository.save(inventory);
    }

    @Override
    public InventoryResponse getAvailableQuantity(Long productId) {
        Inventory inventory = getInventoryOrThrow(productId);

        int available = inventory.getQuantity() - inventory.getReservedQuantity();

        return InventoryResponse.builder()
                .productId(productId)
                .availableQuantity(available)
                .build();
    }

    @Override
    public boolean checkAvailability(Long productId, int requiredQty) {
        Inventory inventory = getInventoryOrThrow(productId);

        int available = inventory.getQuantity() - inventory.getReservedQuantity();

        return available >= requiredQty;
    }
}