package com.example.flowmerceproject.InventoryMangement.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StockEventListener {

    @Async
    @EventListener
    public void handleStockChanged(StockChangedEvent event) {

        log.info("Stock event: product={}, qty={}, type={}",
                event.getProductId(), event.getNewQuantity(), event.getChangeType());

        // LOW STOCK ALERT
        if (event.getNewQuantity() <= event.getThreshold()
                && event.getNewQuantity() > 0) {
            log.warn("LOW STOCK ALERT: product={}, remaining={}",
                    event.getProductId(), event.getNewQuantity());
            // TODO: notificationService.sendLowStockAlert(...)
        }

        // OUT OF STOCK
        if (event.getNewQuantity() == 0) {
            log.warn("OUT OF STOCK: product={}", event.getProductId());
            // TODO: productService.deactivateProduct(...)
        }

        // ORDER CONFIRMED
        if ("CONFIRMED".equals(event.getChangeType())) {
            log.info("Order confirmed: product={}", event.getProductId());
            // TODO: analyticsService.trackSale(...)
        }
    }
}