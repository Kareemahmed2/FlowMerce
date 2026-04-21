package com.example.flowmerceproject.InventoryMangement.service;

import com.example.flowmerceproject.InventoryMangement.entity.Inventory;
import com.example.flowmerceproject.InventoryMangement.repository.InventoryRepository;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String STOCK_KEY = "product:%d:stock";

    // build Redis key
    private String key(Long productId) {
        return String.format(STOCK_KEY, productId);
    }

    private Inventory getInventoryOrThrow(Long productId) {
        return inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Inventory not found for product: " + productId));
    }

    // Load DB stock value into Redis (call on startup or after DB changes)
    @Override
    public void cacheStock(Long productId, int quantity) {
        redisTemplate.opsForValue().set(key(productId), quantity);
        log.info("Stock cached in Redis: product={}, quantity={}", productId, quantity);
    }


    // Updates DB first, then syncs Redis
    @Override
    @Transactional
    public void adjustStock(Long productId, int quantity) {
        Inventory inventory = getInventoryOrThrow(productId);

        int newQuantity = inventory.getQuantity() + quantity;
        if (newQuantity < 0) {
            throw new BadRequestException(
                    "Stock cannot go below zero. Current: "
                            + inventory.getQuantity() + ", Adjustment: " + quantity);
        }

        //Update DB
        inventory.setQuantity(newQuantity);
        inventoryRepository.save(inventory);

        //Sync Redis cache so it stays consistent with DB
        int available = newQuantity - inventory.getReservedQuantity();
        redisTemplate.opsForValue().set(key(productId), available);

        log.info("Stock adjusted: product={}, newQuantity={}, available={}",
                productId, newQuantity, available);
    }

    // Uses Redis atomic decrement — fast, no DB hit (called during checkout)
    @Override
    public boolean reserveStock(Long productId, int quantity) {

        // Ensure Redis has the stock loaded before decrementing
        String redisKey = key(productId);
        if (Boolean.FALSE.equals(redisTemplate.hasKey(redisKey))) {
            // Cache miss — load from DB first
            Inventory inv = getInventoryOrThrow(productId);
            int available = inv.getQuantity() - inv.getReservedQuantity();
            redisTemplate.opsForValue().set(redisKey, available);
        }

        // Atomically decrement in Redis
        Long newStock = redisTemplate.opsForValue().decrement(redisKey, quantity);

        if (newStock == null || newStock < 0) {
            // Rollback the Redis decrement
            redisTemplate.opsForValue().increment(redisKey, quantity);
            log.warn("Stock reservation failed (insufficient): product={}, requested={}",
                    productId, quantity);
            return false;
        }

        // Update reservedQuantity in DB to reflect the reservation
        Inventory inventory = getInventoryOrThrow(productId);
        inventory.setReservedQuantity(inventory.getReservedQuantity() + quantity);
        inventoryRepository.save(inventory);

        log.info("Stock reserved: product={}, reserved={}, remainingInRedis={}",
                productId, quantity, newStock);
        return true;
    }

    @Override
    @Transactional
    public void releaseStock(Long productId, int quantity) {
        Inventory inventory = getInventoryOrThrow(productId);

        int newReserved = inventory.getReservedQuantity() - quantity;
        if (newReserved < 0) {
            throw new BadRequestException(
                    "Cannot release more stock than reserved. Reserved: "
                            + inventory.getReservedQuantity() + ", Release: " + quantity);
        }

        inventory.setReservedQuantity(newReserved);
        inventoryRepository.save(inventory);

        redisTemplate.opsForValue().increment(key(productId), quantity);

        log.info("Stock released: product={}, released={}, newReserved={}",
                productId, quantity, newReserved);
    }

    // Reads from Redis first (fast), falls back to DB if cache miss
    @Override
    public int getAvailableQuantity(Long productId) {
        String redisKey = key(productId);
        Object cached = redisTemplate.opsForValue().get(redisKey);

        if (cached != null) {
            log.debug("Cache hit for product={}", productId);
            return ((Number) cached).intValue();
        }

        // Cache miss — load from DB and cache the result
        log.debug("Cache miss for product={}, loading from DB", productId);
        Inventory inv = getInventoryOrThrow(productId);
        int available = inv.getQuantity() - inv.getReservedQuantity();
        redisTemplate.opsForValue().set(redisKey, available);
        return available;
    }

    @Override
    public boolean checkAvailability(Long productId, int requiredQty) {
        return getAvailableQuantity(productId) >= requiredQty;
    }

    // CONFIRM ORDER (called after payment success)
    // Permanently reduces DB stock and clears reservation
    @Override
    @Transactional
    public void confirmOrder(Long productId, int quantity) {
        Inventory inv = getInventoryOrThrow(productId);

        if (inv.getQuantity() < quantity) {
            throw new BadRequestException(
                    "Cannot confirm order: insufficient stock in DB. " +
                            "Available: " + inv.getQuantity() + ", Requested: " + quantity);
        }

        //Permanently reduce total stock in DB
        inv.setQuantity(inv.getQuantity() - quantity);

        //Also reduce reserved quantity (the reservation is now fulfilled)
        int newReserved = Math.max(0, inv.getReservedQuantity() - quantity);
        inv.setReservedQuantity(newReserved);

        inventoryRepository.save(inv);

        //Sync Redis with the new available quantity
        int available = inv.getQuantity() - inv.getReservedQuantity();
        redisTemplate.opsForValue().set(key(productId), available);

        log.info("Order confirmed: product={}, sold={}, remainingStock={}",
                productId, quantity, inv.getQuantity());
    }
}