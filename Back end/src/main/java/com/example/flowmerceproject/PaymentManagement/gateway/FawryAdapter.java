package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

/**
 * Fawry adapter stub — Egyptian cash payment network.
 * Generates a reference code; customer pays at any Fawry outlet.
 *
 * Required env vars when ready:
 *   payment.fawry.merchant-code=...
 *   payment.fawry.security-key=...
 *   payment.fawry.base-url=https://www.atfawry.com/ECommerceWeb/Fawry/payments/charge
 */
@Component
public class FawryAdapter implements PaymentGatewayAdapter {

    private static final Set<String> SUPPORTED = Set.of("FAWRY_PAY", "fawry_pay", "FAWRYPAY", "fawrypay");

    @Value("${payment.fawry.merchant-code:NOT_CONFIGURED}")
    private String merchantCode;

    @Override
    public String getProviderName() { return "FAWRY"; }

    @Override
    public boolean supports(String paymentMethod) {
        return paymentMethod != null && SUPPORTED.contains(paymentMethod.toUpperCase());
    }

    @Override
    public GatewayResult process(Integer orderId, BigDecimal amount,
                                 String paymentMethod, String customerEmail) {
        if ("NOT_CONFIGURED".equals(merchantCode)) {
            return GatewayResult.builder()
                    .success(false)
                    .status(PaymentStatus.FAILED)
                    .failureReason("Fawry is not yet configured. Please add FAWRY_MERCHANT_CODE to environment variables.")
                    .build();
        }
        // TODO: Generate Fawry charge request with HMAC signature
        // Response includes a referenceNumber the customer uses at Fawry outlet
        String fawryRef = "FWR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        return GatewayResult.builder()
                .success(true)
                .status(PaymentStatus.PENDING)
                .transactionReference(fawryRef)
                .gatewayResponse("{\"fawryRefNumber\":\"" + fawryRef + "\",\"expiryDate\":\"+24h\"}")
                .build();
    }

    @Override
    public GatewayResult refund(Integer orderId, String transactionReference, BigDecimal amount,
                                String customerEmail) {
        if ("NOT_CONFIGURED".equals(merchantCode)) {
            return GatewayResult.builder()
                    .success(false).status(PaymentStatus.FAILED)
                    .failureReason("Fawry is not configured.").build();
        }
        // TODO: POST refund to Fawry API
        return GatewayResult.builder()
                .success(false).status(PaymentStatus.FAILED)
                .failureReason("Fawry refund integration pending.").build();
    }
}
