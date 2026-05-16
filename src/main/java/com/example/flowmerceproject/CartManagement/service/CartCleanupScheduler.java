package com.example.flowmerceproject.CartManagement.service;

import com.example.flowmerceproject.CartManagement.entity.ShoppingCart;
import com.example.flowmerceproject.CartManagement.repository.ShoppingCartRepository;
import com.example.flowmerceproject.InventoryManagement.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class CartCleanupScheduler {

    private final ShoppingCartRepository cartRepository;
    private final InventoryService inventoryService;


     //Runs every day at 2:00 AM
     //Finds expired carts → releases their reserved stock → deletes them
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupExpiredCarts() {
        LocalDateTime now = LocalDateTime.now();
        List<ShoppingCart> expiredCarts = cartRepository.findByExpiresAtBefore(now);

        if (expiredCarts.isEmpty()) {
            log.info("Cart cleanup: no expired carts found.");
            return;
        }

        for (ShoppingCart cart : expiredCarts) {
            // Release reserved stock for each item back to inventory
            cart.getItems().forEach(item -> {
                try {
                    inventoryService.releaseStock(
                            item.getProduct().getProductId().longValue(),
                            item.getQuantity()
                    );
                } catch (Exception e) {
                    log.warn("Could not release stock for product={} during cleanup",
                            item.getProduct().getProductId());
                }
            });

            cartRepository.delete(cart);
            log.info("Expired cart deleted: cartId={}, customerId={}",
                    cart.getCartId(), cart.getCustomer().getCustomerId());
        }

        log.info("Cart cleanup complete: {} expired carts removed.", expiredCarts.size());
    }
}