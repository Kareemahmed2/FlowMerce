package com.example.flowmerceproject.PaymentManagement.event;

import com.example.flowmerceproject.PaymentManagement.config.PaymentRabbitMQConfig;
import com.example.flowmerceproject.PaymentManagement.entity.Payment;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    @Data @Builder
    public static class PaymentEvent {
        private Integer paymentId;
        private Integer orderId;
        private String customerEmail;
        private String merchantEmail;
        private BigDecimal amount;
        private String currency;
        private String paymentMethod;
        private String status;
        private String gateway;
        private String transactionReference;
        private String failureReason;
        private LocalDateTime occurredAt;
    }

    public void publishInitiated(Payment payment, String customerEmail, String merchantEmail) {
        publish(PaymentRabbitMQConfig.KEY_INITIATED, payment, customerEmail, merchantEmail);
        log.info("Published payment.initiated: paymentId={}", payment.getPaymentId());
    }

    public void publishSucceeded(Payment payment, String customerEmail, String merchantEmail) {
        publish(PaymentRabbitMQConfig.KEY_SUCCEEDED, payment, customerEmail, merchantEmail);
        log.info("Published payment.succeeded: paymentId={}", payment.getPaymentId());
    }

    public void publishFailed(Payment payment, String customerEmail, String merchantEmail) {
        publish(PaymentRabbitMQConfig.KEY_FAILED, payment, customerEmail, merchantEmail);
        log.info("Published payment.failed: paymentId={}", payment.getPaymentId());
    }

    public void publishRefunded(Payment payment, String customerEmail, String merchantEmail) {
        publish(PaymentRabbitMQConfig.KEY_REFUNDED, payment, customerEmail, merchantEmail);
        log.info("Published payment.refunded: paymentId={}", payment.getPaymentId());
    }

    private void publish(String routingKey, Payment payment,
                         String customerEmail, String merchantEmail) {
        PaymentEvent event = PaymentEvent.builder()
                .paymentId(payment.getPaymentId())
                .orderId(payment.getOrder().getOrderId())
                .customerEmail(customerEmail)
                .merchantEmail(merchantEmail)
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .paymentMethod(payment.getPaymentMethod())
                .status(payment.getPaymentStatus().name())
                .gateway(payment.getGateway())
                .transactionReference(payment.getTransactionReference())
                .failureReason(payment.getFailureReason())
                .occurredAt(LocalDateTime.now())
                .build();
        try {
            rabbitTemplate.convertAndSend(
                    PaymentRabbitMQConfig.EXCHANGE, routingKey, event);
        } catch (Exception e) {
            log.warn("RabbitMQ publish failed (non-critical): routingKey={}, error={}",
                    routingKey, e.getMessage());
        }
    }
}
