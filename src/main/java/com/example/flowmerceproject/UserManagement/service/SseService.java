package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.InventoryMangement.event.StockChangedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

@Slf4j
@Service
public class SseService {

    // Private connections — one per user (email → emitter)
    // Used for: order updates, account activity, low stock alerts per merchant
    private final Map<String, SseEmitter> userEmitters = new ConcurrentHashMap<>();

    // Broadcast connections — all connected clients
    // Used for: system alerts, flash sale notifications
    private final List<SseEmitter> broadcastEmitters = new CopyOnWriteArrayList<>();

    // SUBSCRIBE — private connection per user
    public SseEmitter subscribeUser(String userEmail) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        userEmitters.put(userEmail, emitter);

        emitter.onCompletion(() -> {
            userEmitters.remove(userEmail);
            log.info("SSE private closed: user={}", userEmail);
        });
        emitter.onTimeout(() -> {
            userEmitters.remove(userEmail);
            log.info("SSE private timeout: user={}", userEmail);
        });
        emitter.onError(e -> {
            userEmitters.remove(userEmail);
            log.warn("SSE private error: user={}", userEmail);
        });

        // Send welcome event to confirm connection
        sendToUser(userEmail, "CONNECTED", Map.of("message", "Connected successfully"));

        log.info("SSE private connected: user={}", userEmail);
        return emitter;
    }

    // SUBSCRIBE — broadcast (no auth needed)
    public SseEmitter subscribeBroadcast() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        broadcastEmitters.add(emitter);

        emitter.onCompletion(() -> broadcastEmitters.remove(emitter));
        emitter.onTimeout(() -> broadcastEmitters.remove(emitter));
        emitter.onError(e -> broadcastEmitters.remove(emitter));

        log.info("SSE broadcast connected. Total: {}", broadcastEmitters.size());
        return emitter;
    }

    // SEND TO SPECIFIC USER
    public void sendToUser(String userEmail, String eventType, Object data) {
        SseEmitter emitter = userEmitters.get(userEmail);
        if (emitter == null) {
            log.debug("No SSE connection for user={}", userEmail);
            return;
        }
        try {
            emitter.send(SseEmitter.event()
                    .name(eventType)
                    .data(data));
        } catch (IOException e) {
            userEmitters.remove(userEmail);
            log.warn("SSE send failed for user={}, removing", userEmail);
        }
    }

    // SEND STOCK UPDATE — called by StockEventListener
    public void sendStockUpdate(StockChangedEvent event, String merchantEmail) {
        String alertLevel = event.getNewQuantity() == 0 ? "OUT_OF_STOCK" : "LOW_STOCK";

        Map<String, Object> payload = Map.of(
                "productId",    event.getProductId(),
                "newQuantity",  event.getNewQuantity(),
                "threshold",    event.getThreshold(),
                "changeType",   event.getChangeType(),
                "alertLevel",   alertLevel,
                "message",      alertLevel.equals("OUT_OF_STOCK")
                        ? "Product #" + event.getProductId() + " is OUT OF STOCK!"
                        : "Low stock alert: only " + event.getNewQuantity() + " units left"
        );

        // Send private alert to the merchant who owns this product
        sendToUser(merchantEmail, "STOCK_ALERT", payload);

        log.info("Stock SSE sent to merchant={}, product={}, level={}",
                merchantEmail, event.getProductId(), alertLevel);
    }

    // SEND ORDER UPDATE — called by OrderService
    public void sendOrderUpdate(String userEmail, Integer orderId, String status) {
        sendToUser(userEmail, "ORDER_UPDATE", Map.of(
                "orderId", orderId,
                "status",  status,
                "message", "Your order #" + orderId + " is now: " + status
        ));
    }

    // SEND ACCOUNT ACTIVITY — called by AuthService
    public void sendAccountActivity(String userEmail, String message) {
        sendToUser(userEmail, "ACCOUNT_ACTIVITY", Map.of("message", message));
    }

    // BROADCAST TO ALL — system alerts
    public void broadcast(String eventType, Object data) {
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        broadcastEmitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name(eventType).data(data));
            } catch (IOException e) {
                deadEmitters.add(emitter);
            }
        });

        broadcastEmitters.removeAll(deadEmitters);
        log.info("Broadcast sent: event={}, recipients={}", eventType, broadcastEmitters.size());
    }
}