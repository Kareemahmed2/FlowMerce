package com.example.flowmerceproject.OrderManagement.event;

import com.example.flowmerceproject.NotificationManagement.config.NotificationRabbitMQConfig;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrderEvent {
        private Integer orderId;
        private String customerEmail;
        private String merchantEmail;
        private String oldStatus;
        private String newStatus;
        private String storeName;
        private LocalDateTime occurredAt;
    }

    public void publishStatusChanged(Order order, String oldStatus,
                                     String customerEmail, String merchantEmail) {
        OrderEvent event = OrderEvent.builder()
                .orderId(order.getOrderId())
                .customerEmail(customerEmail)
                .merchantEmail(merchantEmail)
                .oldStatus(oldStatus)
                .newStatus(order.getStatus().name())
                .storeName(order.getStore().getStoreName())
                .occurredAt(LocalDateTime.now())
                .build();
        try {
            rabbitTemplate.convertAndSend(
                    NotificationRabbitMQConfig.ORDER_EXCHANGE,
                    NotificationRabbitMQConfig.KEY_ORDER_STATUS,
                    event);
            log.info("Published order.status.updated: orderId={}, status={}",
                    order.getOrderId(), order.getStatus());
        } catch (Exception e) {
            log.warn("RabbitMQ order event publish failed (non-critical): orderId={}, error={}",
                    order.getOrderId(), e.getMessage());
        }
    }
}
