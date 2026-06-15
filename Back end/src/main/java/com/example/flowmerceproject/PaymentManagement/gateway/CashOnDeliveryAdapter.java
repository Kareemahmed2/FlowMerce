package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

/**
 * COD adapter — payment is collected by the courier at delivery.
 * Starts PENDING and transitions to COMPLETED when the merchant marks order DELIVERED.
 */
@Component
public class CashOnDeliveryAdapter implements PaymentGatewayAdapter {

    private static final Set<String> SUPPORTED =
            Set.of("CASH_ON_DELIVERY", "COD", "cash_on_delivery", "cod");

    @Override
    public String getProviderName() { return "COD"; }

    @Override
    public boolean supports(String paymentMethod) {
        return paymentMethod != null && SUPPORTED.contains(paymentMethod.toUpperCase()
                .replace("_", "_"));
    }

    @Override
    public GatewayResult process(Integer orderId, BigDecimal amount,
                                 String paymentMethod, String customerEmail) {
        return GatewayResult.builder()
                .success(true)
                .status(PaymentStatus.PENDING)
                .transactionReference("COD-" + orderId + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .gatewayResponse("{\"method\":\"COD\",\"note\":\"Collect on delivery\"}")
                .build();
    }

    @Override
    public GatewayResult refund(String transactionReference, BigDecimal amount,
                                String customerEmail) {
        // COD refund is handled manually (cash returned to customer)
        return GatewayResult.builder()
                .success(true)
                .status(PaymentStatus.REFUNDED)
                .transactionReference("COD-REFUND-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .gatewayResponse("{\"method\":\"COD_REFUND\",\"note\":\"Manual cash refund\"}")
                .build();
    }
}
