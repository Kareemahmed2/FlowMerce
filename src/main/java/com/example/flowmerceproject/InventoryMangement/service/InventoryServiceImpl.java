package com.example.flowmerceproject.InventoryMangement.service;

import com.example.flowmerceproject.InventoryMangement.dto.InventoryResponse;
import com.example.flowmerceproject.InventoryMangement.entity.Inventory;
import com.example.flowmerceproject.InventoryMangement.event.StockChangedEvent;
import com.example.flowmerceproject.InventoryMangement.repository.InventoryRepository;
import com.example.flowmerceproject.InventoryMangement.strategy.InventoryStrategyFactory;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final StringRedisTemplate redisTemplate;
    private final InventoryStrategyFactory strategyFactory;
    private final ApplicationEventPublisher eventPublisher;

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
        if (inv.getQuantity() == 0)                              return "OUT_OF_STOCK";
        if (inv.getQuantity() <= inv.getLowStockThreshold())     return "LOW";
        return "NORMAL";
    }


    @Override
    public void cacheStock(Long productId, int quantity) {
        redisTemplate.opsForValue().set(key(productId), String.valueOf(quantity));
        log.info("Cached stock: product={}, qty={}", productId, quantity);
    }

    @Override
    public void adjustStock(Long productId, int quantity) {
        adjustStock(productId, quantity, "NORMAL");
    }

    @Override
    @Transactional
    public void adjustStock(Long productId, int quantity, String strategyType) {
        try {
            Inventory inventory = getOrThrow(productId);

            InventoryStrategy strategy = strategyFactory.getStrategy(strategyType);
            strategy.updateStock(inventory, quantity);
            inventoryRepository.save(inventory);

            //Sync Redis cache
            int available = inventory.getQuantity() - inventory.getReservedQuantity();
            redisTemplate.opsForValue().set(key(productId), String.valueOf(available));

            //Observer listeners react automatically
            eventPublisher.publishEvent(new StockChangedEvent(
                    this, productId, inventory.getQuantity(),
                    inventory.getLowStockThreshold(), "ADJUSTED"));

            log.info("Stock adjusted [{}]: product={}, newQty={}",
                    strategyType, productId, inventory.getQuantity());

        } catch (OptimisticLockingFailureException e) {
            // Optimistic Locking caught a race condition
            throw new BadRequestException(
                    "Stock update conflict detected — concurrent update on product: "
                            + productId + ". Please retry.");
        }
    }

    //Redis atomic + DB sync
    // Called during checkout before payment
    @Override
    @Transactional
    public boolean reserveStock(Long productId, int quantity) {
        try {
            //Ensure Redis has data (cache miss check)
            String redisKey = key(productId);
            if (Boolean.FALSE.equals(redisTemplate.hasKey(redisKey))) {
                Inventory inv = getOrThrow(productId);
                redisTemplate.opsForValue().set(redisKey,
                        String.valueOf(inv.getQuantity() - inv.getReservedQuantity()));
            }

            //Atomic decrement in Redis
            Long newStock = redisTemplate.opsForValue().decrement(redisKey, quantity);
            if (newStock == null || newStock < 0) {
                // Rollback Redis
                redisTemplate.opsForValue().increment(redisKey, quantity);
                log.warn("Reservation failed — insufficient stock: product={}, qty={}",
                        productId, quantity);
                return false;
            }

            //Update reservedQuantity in DB
            Inventory inventory = getOrThrow(productId);
            strategyFactory.getStrategy("RESERVED").updateStock(inventory, quantity);
            inventoryRepository.save(inventory);

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

            inventory.setReservedQuantity(newReserved);
            inventoryRepository.save(inventory);

            // Restore in Redis
            redisTemplate.opsForValue().increment(key(productId), quantity);

            eventPublisher.publishEvent(new StockChangedEvent(
                    this, productId, inventory.getQuantity(),
                    inventory.getLowStockThreshold(), "RELEASED"));

            log.info("Stock released: product={}, released={}", productId, quantity);

        } catch (OptimisticLockingFailureException e) {
            throw new BadRequestException(
                    "Release conflict on product: " + productId + ". Please retry.");
        }
    }

    // Redis first → DB fallback
    @Override
    public int getAvailableQuantity(Long productId) {
        String cached = redisTemplate.opsForValue().get(key(productId));
        if (cached != null) {
            log.debug("Cache hit: product={}", productId);
            return Integer.parseInt(cached);
        }
        log.debug("Cache miss: product={} — loading from DB", productId);
        Inventory inv = getOrThrow(productId);
        int available = inv.getQuantity() - inv.getReservedQuantity();
        redisTemplate.opsForValue().set(key(productId), String.valueOf(available));
        return available;
    }

    @Override
    public boolean checkAvailability(Long productId, int requiredQty) {
        return getAvailableQuantity(productId) >= requiredQty;
    }

    //permanent DB stock reduction
    //Called after payment is successful
    @Override
    @Transactional
    public void confirmOrder(Long productId, int quantity) {
        try {
            Inventory inv = getOrThrow(productId);

            if (inv.getQuantity() < quantity) {
                throw new BadRequestException(
                        "Cannot confirm order — insufficient DB stock. " +
                                "Available: " + inv.getQuantity() + ", Needed: " + quantity);
            }

            // Permanently reduce total stock
            inv.setQuantity(inv.getQuantity() - quantity);

            // Clear the reservation for this order
            inv.setReservedQuantity(
                    Math.max(0, inv.getReservedQuantity() - quantity));

            inventoryRepository.save(inv);

            // Sync Redis with final available quantity
            int available = inv.getQuantity() - inv.getReservedQuantity();
            redisTemplate.opsForValue().set(key(productId), String.valueOf(available));

            // Publish — triggers analytics, low stock alerts, etc.
            eventPublisher.publishEvent(new StockChangedEvent(
                    this, productId, inv.getQuantity(),
                    inv.getLowStockThreshold(), "CONFIRMED"));

            log.info("Order confirmed: product={}, sold={}, remaining={}",
                    productId, quantity, inv.getQuantity());

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
                .availableQuantity(available)
                .reservedQuantity(inv.getReservedQuantity())
                .totalQuantity(inv.getQuantity())
                .stockStatus(resolveStockStatus(inv))
                .build();
    }
}