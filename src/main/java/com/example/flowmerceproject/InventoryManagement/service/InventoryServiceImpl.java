package com.example.flowmerceproject.InventoryManagement.service;

import com.example.flowmerceproject.InventoryManagement.dto.InventoryResponse;
import com.example.flowmerceproject.InventoryManagement.entity.Inventory;
import com.example.flowmerceproject.InventoryManagement.entity.InventoryTransaction;
import com.example.flowmerceproject.InventoryManagement.entity.InventoryTransaction.Type;
import com.example.flowmerceproject.InventoryManagement.event.StockChangedEvent;
import com.example.flowmerceproject.InventoryManagement.repository.InventoryRepository;
import com.example.flowmerceproject.InventoryManagement.repository.InventoryTransactionRepository;
import com.example.flowmerceproject.InventoryManagement.strategy.InventoryStrategy;
import com.example.flowmerceproject.InventoryManagement.strategy.InventoryStrategyFactory;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final StringRedisTemplate redisTemplate;
    private final InventoryStrategyFactory strategyFactory;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${inventory.low-stock-threshold:5}")
    private int lowStockThreshold;

    private static final String STOCK_KEY = "product:%d:stock";

    private String key(Long productId) {
        return String.format(STOCK_KEY, productId);
    }

    private Inventory getOrThrow(Long productId) {
        return inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Inventory not found for product: " + productId));
    }

    private String resolveStockStatus(Inventory inv) {
        if (inv.getQuantity() == 0)                                return "OUT_OF_STOCK";
        if (inv.getQuantity() <= inv.getLowStockThreshold())       return "LOW";
        return "NORMAL";
    }

    private void saveTransaction(Inventory inv, int qtyBefore, int quantityChange,
                                  Type type, String createdBy, String referenceId, String note) {
        transactionRepository.save(InventoryTransaction.builder()
                .productId(inv.getProductId())
                .storeId(inv.getStoreId())
                .type(type)
                .quantityChange(quantityChange)
                .qtyBefore(qtyBefore)
                .qtyAfter(inv.getQuantity())
                .createdBy(createdBy)
                .referenceId(referenceId)
                .note(note)
                .build());
    }

    @Override
    public void cacheStock(Long productId, int quantity) {
        redisTemplate.opsForValue().set(key(productId), String.valueOf(quantity));
    }

    @Override
    public void adjustStock(Long productId, int quantity) {
        adjustStock(productId, quantity, "NORMAL");
    }

    @Override
    @Transactional
    public void adjustStock(Long productId, int quantity, String strategyType) {
        adjustStock(productId, quantity, strategyType, null, "system", null, null);
    }

    @Override
    @Transactional
    public void adjustStock(Long productId, int quantity, String strategyType,
                             Integer storeId, String createdBy, String referenceId, String note) {
        try {
            Inventory inventory = getOrThrow(productId);
            int qtyBefore = inventory.getQuantity();

            InventoryStrategy strategy = strategyFactory.getStrategy(strategyType);
            strategy.updateStock(inventory, quantity);
            inventoryRepository.save(inventory);

            Type txnType = quantity > 0 ? Type.RESTOCK : Type.ADJUSTMENT;
            saveTransaction(inventory, qtyBefore, quantity, txnType, createdBy, referenceId, note);

            int available = inventory.getQuantity() - inventory.getReservedQuantity();
            redisTemplate.opsForValue().set(key(productId), String.valueOf(available));

            eventPublisher.publishEvent(new StockChangedEvent(
                    this, productId, inventory.getQuantity(),
                    inventory.getLowStockThreshold(), "ADJUSTED"));

        } catch (OptimisticLockingFailureException e) {
            throw new BadRequestException(
                    "Stock update conflict detected — concurrent update on product: "
                            + productId + ". Please retry.");
        }
    }

    @Override
    @Transactional
    public boolean reserveStock(Long productId, int quantity) {
        try {
            String redisKey = key(productId);
            if (Boolean.FALSE.equals(redisTemplate.hasKey(redisKey))) {
                Inventory inv = getOrThrow(productId);
                redisTemplate.opsForValue().set(redisKey,
                        String.valueOf(inv.getQuantity() - inv.getReservedQuantity()));
            }

            Long newStock = redisTemplate.opsForValue().decrement(redisKey, quantity);
            if (newStock == null || newStock < 0) {
                redisTemplate.opsForValue().increment(redisKey, quantity);
                return false;
            }

            Inventory inventory = getOrThrow(productId);
            int qtyBefore = inventory.getQuantity();
            strategyFactory.getStrategy("RESERVED").updateStock(inventory, quantity);
            inventoryRepository.save(inventory);

            saveTransaction(inventory, qtyBefore, quantity, Type.SALE,
                    "system", null, "Reserved via checkout");

            eventPublisher.publishEvent(new StockChangedEvent(
                    this, productId, inventory.getQuantity(),
                    inventory.getLowStockThreshold(), "RESERVED"));
            return true;

        } catch (OptimisticLockingFailureException e) {
            throw new BadRequestException(
                    "Reservation conflict on product: " + productId + ". Please retry.");
        }
    }

    @Override
    @Transactional
    public void releaseStock(Long productId, int quantity) {
        try {
            Inventory inventory = getOrThrow(productId);
            int newReserved = inventory.getReservedQuantity() - quantity;
            if (newReserved < 0) {
                throw new BadRequestException(
                        "Cannot release more than reserved. Reserved: "
                                + inventory.getReservedQuantity());
            }
            int qtyBefore = inventory.getQuantity();
            inventory.setReservedQuantity(newReserved);
            inventoryRepository.save(inventory);

            saveTransaction(inventory, qtyBefore, quantity, Type.RETURN,
                    "system", null, "Released reservation");

            redisTemplate.opsForValue().increment(key(productId), quantity);

            eventPublisher.publishEvent(new StockChangedEvent(
                    this, productId, inventory.getQuantity(),
                    inventory.getLowStockThreshold(), "RELEASED"));

        } catch (OptimisticLockingFailureException e) {
            throw new BadRequestException(
                    "Release conflict on product: " + productId + ". Please retry.");
        }
    }

    @Override
    public int getAvailableQuantity(Long productId) {
        String cached = redisTemplate.opsForValue().get(key(productId));
        if (cached != null) return Integer.parseInt(cached);
        Inventory inv = getOrThrow(productId);
        int available = inv.getQuantity() - inv.getReservedQuantity();
        redisTemplate.opsForValue().set(key(productId), String.valueOf(available));
        return available;
    }

    @Override
    public boolean checkAvailability(Long productId, int requiredQty) {
        return getAvailableQuantity(productId) >= requiredQty;
    }

    @Override
    @Transactional
    public void confirmOrder(Long productId, int quantity) {
        try {
            Inventory inv = getOrThrow(productId);
            if (inv.getQuantity() < quantity) {
                throw new BadRequestException(
                        "Cannot confirm order — insufficient DB stock. "
                                + "Available: " + inv.getQuantity() + ", Needed: " + quantity);
            }
            int qtyBefore = inv.getQuantity();
            inv.setQuantity(inv.getQuantity() - quantity);
            inv.setReservedQuantity(Math.max(0, inv.getReservedQuantity() - quantity));
            inventoryRepository.save(inv);

            saveTransaction(inv, qtyBefore, -quantity, Type.SALE,
                    "system", null, "Order confirmed");

            int available = inv.getQuantity() - inv.getReservedQuantity();
            redisTemplate.opsForValue().set(key(productId), String.valueOf(available));

            eventPublisher.publishEvent(new StockChangedEvent(
                    this, productId, inv.getQuantity(),
                    inv.getLowStockThreshold(), "CONFIRMED"));

        } catch (OptimisticLockingFailureException e) {
            throw new BadRequestException(
                    "Order confirmation conflict on product: " + productId + ". Please retry.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryResponse getInventoryDetails(Long productId) {
        Inventory inv = getOrThrow(productId);
        int available = inv.getQuantity() - inv.getReservedQuantity();
        return InventoryResponse.builder()
                .productId(productId)
                .storeId(inv.getStoreId())
                .availableQuantity(available)
                .reservedQuantity(inv.getReservedQuantity())
                .totalQuantity(inv.getQuantity())
                .stockStatus(resolveStockStatus(inv))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryResponse> getStoreInventory(Integer storeId) {
        return inventoryRepository.findByStoreId(storeId).stream()
                .map(inv -> InventoryResponse.builder()
                        .productId(inv.getProductId())
                        .storeId(inv.getStoreId())
                        .availableQuantity(inv.getQuantity() - inv.getReservedQuantity())
                        .reservedQuantity(inv.getReservedQuantity())
                        .totalQuantity(inv.getQuantity())
                        .stockStatus(resolveStockStatus(inv))
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryTransaction> getTransactionHistory(Long productId) {
        return transactionRepository.findByProductIdOrderByCreatedAtDesc(productId);
    }
}
