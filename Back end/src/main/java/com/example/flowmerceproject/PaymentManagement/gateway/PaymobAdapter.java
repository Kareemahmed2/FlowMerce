package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Paymob adapter stub — Egypt's leading payment gateway.
 * Supports Meeza cards, mobile wallets, and cash collection points.
 *
 * Required env vars when ready:
 *   payment.paymob.api-key=...
 *   payment.paymob.integration-id-card=...
 *   payment.paymob.integration-id-wallet=...
 *   payment.paymob.hmac-secret=...
 */
@Component
public class PaymobAdapter implements PaymentGatewayAdapter {

    private static final Set<String> SUPPORTED = Set.of("PAYMOB", "paymob", "FAWRY", "fawry");

    @Value("${payment.paymob.api-key:NOT_CONFIGURED}")
    private String apiKey;

    @Override
    public String getProviderName() { return "PAYMOB"; }

    @Override
    public boolean supports(String paymentMethod) {
        return paymentMethod != null && SUPPORTED.contains(paymentMethod.toUpperCase());
    }

    @Override
    public GatewayResult process(Integer orderId, BigDecimal amount,
                                 String paymentMethod, String customerEmail) {
        if ("NOT_CONFIGURED".equals(apiKey)) {
            return GatewayResult.builder()
                    .success(false)
                    .status(PaymentStatus.FAILED)
                    .failureReason("Paymob is not yet configured. Please add PAYMOB_API_KEY to environment variables.")
                    .build();
        }
        // TODO: Paymob 3-step integration:
        // 1. POST /auth/tokens  → authToken
        // 2. POST /ecommerce/orders → paymobOrderId
        // 3. POST /acceptance/payment_keys → paymentKey
        // return redirect URL to Paymob hosted page
        return GatewayResult.builder()
                .success(false)
                .status(PaymentStatus.FAILED)
                .failureReason("Paymob integration pending — API keys not configured.")
                .build();
    }

    @Override
    public GatewayResult refund(String transactionReference, BigDecimal amount,
                                String customerEmail) {
        if ("NOT_CONFIGURED".equals(apiKey)) {
            return GatewayResult.builder()
                    .success(false).status(PaymentStatus.FAILED)
                    .failureReason("Paymob is not configured.").build();
        }
        // TODO: POST /acceptance/void_refund/refund
        return GatewayResult.builder()
                .success(false).status(PaymentStatus.FAILED)
                .failureReason("Paymob refund integration pending.").build();
    }
}
