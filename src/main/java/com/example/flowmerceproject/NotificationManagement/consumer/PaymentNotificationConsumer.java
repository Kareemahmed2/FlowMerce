package com.example.flowmerceproject.NotificationManagement.consumer;

import com.example.flowmerceproject.NotificationManagement.entity.Notification;
import com.example.flowmerceproject.NotificationManagement.service.NotificationService;
import com.example.flowmerceproject.PaymentManagement.config.PaymentRabbitMQConfig;
import com.example.flowmerceproject.PaymentManagement.event.PaymentEventPublisher.PaymentEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentNotificationConsumer {

    private final NotificationService notificationService;

    @RabbitListener(queues = PaymentRabbitMQConfig.QUEUE_NOTIFY)
    public void handlePaymentEvent(PaymentEvent event) {
        log.info("Payment event received: status={}, paymentId={}, orderId={}",
                event.getStatus(), event.getPaymentId(), event.getOrderId());

        switch (event.getStatus()) {
            case "COMPLETED" -> {
                notificationService.createForUser(
                        event.getCustomerEmail(),
                        Notification.NotificationType.PAYMENT_SUCCEEDED,
                        "Payment Confirmed",
                        "Your payment of " + event.getAmount() + " " + event.getCurrency()
                                + " for order #" + event.getOrderId() + " was successful.",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);

                notificationService.createForUser(
                        event.getMerchantEmail(),
                        Notification.NotificationType.PAYMENT_SUCCEEDED,
                        "Payment Received",
                        "Payment of " + event.getAmount() + " " + event.getCurrency()
                                + " received for order #" + event.getOrderId() + ".",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
            }
            case "FAILED" -> notificationService.createForUser(
                    event.getCustomerEmail(),
                    Notification.NotificationType.PAYMENT_FAILED,
                    "Payment Failed",
                    "Your payment for order #" + event.getOrderId() + " failed."
                            + (event.getFailureReason() != null
                            ? " Reason: " + event.getFailureReason() : ""),
                    event.getPaymentId(), Notification.ReferenceType.PAYMENT);

            case "REFUNDED", "PARTIALLY_REFUNDED" -> {
                notificationService.createForUser(
                        event.getCustomerEmail(),
                        Notification.NotificationType.PAYMENT_REFUNDED,
                        "Refund Processed",
                        "A refund of " + event.getAmount() + " " + event.getCurrency()
                                + " has been processed for order #" + event.getOrderId() + ".",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);

                notificationService.createForUser(
                        event.getMerchantEmail(),
                        Notification.NotificationType.PAYMENT_REFUNDED,
                        "Refund Issued",
                        "You issued a refund of " + event.getAmount() + " " + event.getCurrency()
                                + " for order #" + event.getOrderId() + ".",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
            }
            case "PENDING", "PROCESSING" -> notificationService.createForUser(
                    event.getCustomerEmail(),
                    Notification.NotificationType.PAYMENT_INITIATED,
                    "Payment Pending",
                    "Your payment for order #" + event.getOrderId()
                            + " is awaiting confirmation.",
                    event.getPaymentId(), Notification.ReferenceType.PAYMENT);

            default -> log.debug("No notification template for payment status: {}", event.getStatus());
        }
    }
}
