package com.example.flowmerceproject.NotificationManagement.consumer;

import com.example.flowmerceproject.NotificationManagement.email.PaymentConfirmedEmailTemplate;
import com.example.flowmerceproject.NotificationManagement.entity.Notification;
import com.example.flowmerceproject.NotificationManagement.service.NotificationService;
import com.example.flowmerceproject.OrderManagement.entity.Invoice;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.repository.InvoiceRepository;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.config.PaymentRabbitMQConfig;
import com.example.flowmerceproject.PaymentManagement.event.PaymentEventPublisher.PaymentEvent;
import com.example.flowmerceproject.UserManagement.service.EmailService;
import com.example.flowmerceproject.UserManagement.service.SseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentNotificationConsumer {

    private final NotificationService notificationService;
    // INT-22: push real-time SSE after persisting the notification.
    private final SseService sseService;
    private final EmailService emailService;
    private final InvoiceRepository invoiceRepository;
    private final OrderRepository orderRepository;

    @RabbitListener(queues = PaymentRabbitMQConfig.QUEUE_NOTIFY)
    public void handlePaymentEvent(PaymentEvent event) {
        log.info("Payment event received: status={}, paymentId={}, orderId={}",
                event.getStatus(), event.getPaymentId(), event.getOrderId());

        // INT-22: persist first, then push SSE for real-time UI update.
        switch (event.getStatus()) {
            case "COMPLETED" -> {
                notificationService.createForUser(
                        event.getCustomerEmail(), Notification.NotificationType.PAYMENT_SUCCEEDED,
                        "Payment Confirmed",
                        "Your payment of " + event.getAmount() + " " + event.getCurrency()
                                + " for order #" + event.getOrderId() + " was successful.",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
                sseService.sendAccountActivity(event.getCustomerEmail(),
                        "Payment confirmed for order #" + event.getOrderId() + ".");
                sendPaymentConfirmedEmail(event);

                notificationService.createForUser(
                        event.getMerchantEmail(), Notification.NotificationType.PAYMENT_SUCCEEDED,
                        "Payment Received",
                        "Payment of " + event.getAmount() + " " + event.getCurrency()
                                + " received for order #" + event.getOrderId() + ".",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
                sseService.sendAccountActivity(event.getMerchantEmail(),
                        "Payment received for order #" + event.getOrderId() + ".");
            }
            case "FAILED" -> {
                notificationService.createForUser(
                        event.getCustomerEmail(), Notification.NotificationType.PAYMENT_FAILED,
                        "Payment Failed",
                        "Your payment for order #" + event.getOrderId() + " failed."
                                + (event.getFailureReason() != null
                                ? " Reason: " + event.getFailureReason() : ""),
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
                sseService.sendAccountActivity(event.getCustomerEmail(),
                        "Payment failed for order #" + event.getOrderId() + ".");
            }
            case "REFUNDED", "PARTIALLY_REFUNDED" -> {
                notificationService.createForUser(
                        event.getCustomerEmail(), Notification.NotificationType.PAYMENT_REFUNDED,
                        "Refund Processed",
                        "A refund of " + event.getAmount() + " " + event.getCurrency()
                                + " has been processed for order #" + event.getOrderId() + ".",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
                sseService.sendAccountActivity(event.getCustomerEmail(),
                        "Refund processed for order #" + event.getOrderId() + ".");

                notificationService.createForUser(
                        event.getMerchantEmail(), Notification.NotificationType.PAYMENT_REFUNDED,
                        "Refund Issued",
                        "You issued a refund of " + event.getAmount() + " " + event.getCurrency()
                                + " for order #" + event.getOrderId() + ".",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
                sseService.sendAccountActivity(event.getMerchantEmail(),
                        "Refund issued for order #" + event.getOrderId() + ".");
            }
            case "PENDING", "PROCESSING" -> {
                notificationService.createForUser(
                        event.getCustomerEmail(), Notification.NotificationType.PAYMENT_INITIATED,
                        "Payment Pending",
                        "Your payment for order #" + event.getOrderId()
                                + " is awaiting confirmation.",
                        event.getPaymentId(), Notification.ReferenceType.PAYMENT);
                sseService.sendAccountActivity(event.getCustomerEmail(),
                        "Payment pending for order #" + event.getOrderId() + ".");
            }
            default -> log.debug("No notification template for payment status: {}", event.getStatus());
        }
    }

    private void sendPaymentConfirmedEmail(PaymentEvent event) {
        try {
            Invoice invoice = invoiceRepository.findByOrder_OrderId(event.getOrderId()).orElse(null);
            Order order = orderRepository.findByIdWithItems(event.getOrderId()).orElse(null);

            if (order == null) {
                log.warn("Order {} not found for payment confirmed email — skipping", event.getOrderId());
                return;
            }

            String invoiceNumber = invoice != null ? invoice.getInvoiceNumber() : "N/A";
            var issuedAt = invoice != null ? invoice.getIssuedAt() : null;

            emailService.sendTransactionalEmail(event.getCustomerEmail(), new PaymentConfirmedEmailTemplate(
                    event.getOrderId(),
                    invoiceNumber,
                    issuedAt,
                    event.getAmount(),
                    event.getCurrency(),
                    event.getPaymentMethod(),
                    order.getItems(),
                    order.getSubtotal(),
                    order.getShippingCost(),
                    order.getTax(),
                    order.getTotal()));
        } catch (Exception e) {
            log.error("Failed to send payment confirmed email for order {}: {}", event.getOrderId(), e.getMessage());
        }
    }
}
