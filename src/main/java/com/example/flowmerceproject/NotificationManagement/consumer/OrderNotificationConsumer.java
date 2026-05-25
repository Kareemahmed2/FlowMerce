package com.example.flowmerceproject.NotificationManagement.consumer;

import com.example.flowmerceproject.NotificationManagement.config.NotificationRabbitMQConfig;
import com.example.flowmerceproject.NotificationManagement.entity.Notification;
import com.example.flowmerceproject.NotificationManagement.service.NotificationService;
import com.example.flowmerceproject.OrderManagement.event.OrderEventPublisher.OrderEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderNotificationConsumer {

    private final NotificationService notificationService;

    @RabbitListener(queues = NotificationRabbitMQConfig.ORDER_QUEUE)
    public void handleOrderEvent(OrderEvent event) {
        log.info("Order event received: orderId={}, status={}", event.getOrderId(), event.getNewStatus());

        String store = event.getStoreName();
        Integer orderId = event.getOrderId();

        switch (event.getNewStatus()) {
            case "PROCESSING" -> notificationService.createForUser(
                    event.getCustomerEmail(),
                    Notification.NotificationType.ORDER_PROCESSING,
                    "Order Being Prepared",
                    "Your order #" + orderId + " from " + store + " is now being prepared.",
                    orderId, Notification.ReferenceType.ORDER);

            case "CONFIRMED" -> notificationService.createForUser(
                    event.getCustomerEmail(),
                    Notification.NotificationType.ORDER_PROCESSING,
                    "Order Confirmed",
                    "Your order #" + orderId + " from " + store + " has been confirmed.",
                    orderId, Notification.ReferenceType.ORDER);

            case "SHIPPED" -> notificationService.createForUser(
                    event.getCustomerEmail(),
                    Notification.NotificationType.ORDER_SHIPPED,
                    "Order Shipped!",
                    "Great news! Your order #" + orderId + " from " + store
                            + " is on its way.",
                    orderId, Notification.ReferenceType.ORDER);

            case "DELIVERED" -> notificationService.createForUser(
                    event.getCustomerEmail(),
                    Notification.NotificationType.ORDER_DELIVERED,
                    "Order Delivered",
                    "Your order #" + orderId + " from " + store
                            + " has been delivered. Enjoy!",
                    orderId, Notification.ReferenceType.ORDER);

            case "CANCELLED" -> {
                notificationService.createForUser(
                        event.getCustomerEmail(),
                        Notification.NotificationType.ORDER_CANCELLED,
                        "Order Cancelled",
                        "Your order #" + orderId + " from " + store + " has been cancelled.",
                        orderId, Notification.ReferenceType.ORDER);

                notificationService.createForUser(
                        event.getMerchantEmail(),
                        Notification.NotificationType.ORDER_CANCELLED,
                        "Order Cancelled by Customer",
                        "Order #" + orderId + " has been cancelled by the customer.",
                        orderId, Notification.ReferenceType.ORDER);
            }
            default -> log.debug("No notification template for order status: {}", event.getNewStatus());
        }
    }
}
