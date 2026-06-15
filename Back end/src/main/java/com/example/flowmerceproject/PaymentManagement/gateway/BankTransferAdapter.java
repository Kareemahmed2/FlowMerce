package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

/**
 * Bank transfer / InstaPay adapter — customer transfers manually.
 * Starts PENDING; merchant confirms once the transfer arrives.
 */
@Component
public class BankTransferAdapter implements PaymentGatewayAdapter {

    private static final Set<String> SUPPORTED = Set.of(
            "BANK_TRANSFER", "INSTAPAY", "bank_transfer", "instapay"
    );

    @Override
    public String getProviderName() { return "BANK_TRANSFER"; }

    @Override
    public boolean supports(String paymentMethod) {
        return paymentMethod != null && SUPPORTED.contains(paymentMethod.toUpperCase());
    }

    @Override
    public GatewayResult process(Integer orderId, BigDecimal amount,
                                 String paymentMethod, String customerEmail) {
        String ref = "BT-" + orderId + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return GatewayResult.builder()
                .success(true)
                .status(PaymentStatus.PENDING)
                .transactionReference(ref)
                .gatewayResponse("{\"method\":\"BANK_TRANSFER\",\"reference\":\"" + ref + "\","
                        + "\"instructions\":\"Transfer to account 0123456789 — CIB FlowMerce\"}")
                .build();
    }

    @Override
    public GatewayResult refund(String transactionReference, BigDecimal amount,
                                String customerEmail) {
        return GatewayResult.builder()
                .success(true)
                .status(PaymentStatus.REFUNDED)
                .transactionReference("BT-REFUND-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .gatewayResponse("{\"method\":\"BANK_TRANSFER_REFUND\",\"note\":\"Refund to customer bank account\"}")
                .build();
    }
}
