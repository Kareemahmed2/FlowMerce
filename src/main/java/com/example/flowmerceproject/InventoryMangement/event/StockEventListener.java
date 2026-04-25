package com.example.flowmerceproject.InventoryMangement.event;

import com.example.flowmerceproject.InventoryMangement.repository.InventoryRepository;
import com.example.flowmerceproject.UserManagement.service.SseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StockEventListener {

    private final SseService sseService;
    private final InventoryRepository inventoryRepository;

    @Async
    @EventListener
    public void handleStockChanged(StockChangedEvent event) {

        log.info("Stock event received: product={}, qty={}, type={}",
                event.getProductId(), event.getNewQuantity(), event.getChangeType());

        // ── LOW STOCK ALERT ───────────────────────
        if (event.getNewQuantity() <= event.getThreshold()
                && event.getNewQuantity() > 0) {

            log.warn("LOW STOCK: product={}, remaining={}",
                    event.getProductId(), event.getNewQuantity());

            // TODO: inject ProductRepository and get merchant email
            // String merchantEmail = productRepository
            //         .findById(event.getProductId())
            //         .map(p -> p.getStore().getMerchant().getUser().getEmail())
            //         .orElse(null);
            // if (merchantEmail != null) {
            //     sseService.sendStockUpdate(event, merchantEmail);
            // }

            // For now — broadcast so merchant sees it on /stream/stock
            sseService.broadcast("STOCK_ALERT", new java.util.HashMap<>() {{
                put("productId",   event.getProductId());
                put("newQuantity", event.getNewQuantity());
                put("alertLevel",  "LOW_STOCK");
                put("message",     "Low stock: only " + event.getNewQuantity() + " units left");
            }});
        }

        // ── OUT OF STOCK ──────────────────────────
        if (event.getNewQuantity() == 0) {
            log.warn("OUT OF STOCK: product={}", event.getProductId());

            sseService.broadcast("STOCK_ALERT", new java.util.HashMap<>() {{
                put("productId",   event.getProductId());
                put("newQuantity", 0);
                put("alertLevel",  "OUT_OF_STOCK");
                put("message",     "Prod!uct #" + event.getProductId() + " is OUT OF STOCK!");
            }});
        }

        // ── ORDER CONFIRMED ───────────────────────
        if ("CONFIRMED".equals(event.getChangeType())) {
            log.info("Order confirmed for product={}", event.getProductId());
            // OrderService already sends SSE to buyer directly
        }
    }
}