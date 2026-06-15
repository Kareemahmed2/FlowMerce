package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Stripe adapter stub — ready to integrate once API keys are configured.
 * Plug in the Stripe Java SDK and replace the stub body.
 *
 * Required env vars (add to application.properties when ready):
 *   payment.stripe.secret-key=sk_live_...
 *   payment.stripe.webhook-secret=whsec_...
 */
@Component
public class StripeAdapter implements PaymentGatewayAdapter {

    private static final Set<String> SUPPORTED = Set.of("STRIPE", "stripe", "CREDIT_CARD", "credit_card");

    @Value("${payment.stripe.secret-key:NOT_CONFIGURED}")
    private String secretKey;

    @Override
    public String getProviderName() { return "STRIPE"; }

    @Override
    public boolean supports(String paymentMethod) {
        return paymentMethod != null && SUPPORTED.contains(paymentMethod.toUpperCase());
    }

    @Override
    public GatewayResult process(Integer orderId, BigDecimal amount,
                                 String paymentMethod, String customerEmail) {
        if ("NOT_CONFIGURED".equals(secretKey)) {
            return GatewayResult.builder()
                    .success(false)
                    .status(PaymentStatus.FAILED)
                    .failureReason("Stripe is not yet configured. Please add STRIPE_SECRET_KEY to environment variables.")
                    .build();
        }
        // TODO: Stripe integration
        // PaymentIntent intent = PaymentIntent.create(Map.of(
        //     "amount", amount.multiply(BigDecimal.valueOf(100)).longValue(),
        //     "currency", "egp",
        //     "metadata", Map.of("orderId", orderId)
        // ));
        // return GatewayResult.builder()
        //     .success(true)
        //     .status(PaymentStatus.PROCESSING)
        //     .transactionReference(intent.getId())
        //     .redirectUrl(intent.getNextAction().getRedirectToUrl().getUrl())
        //     .build();
        return GatewayResult.builder()
                .success(false)
                .status(PaymentStatus.FAILED)
                .failureReason("Stripe integration pending — SDK not yet initialised.")
                .build();
    }

    @Override
    public GatewayResult refund(String transactionReference, BigDecimal amount,
                                String customerEmail) {
        if ("NOT_CONFIGURED".equals(secretKey)) {
            return GatewayResult.builder()
                    .success(false)
                    .status(PaymentStatus.FAILED)
                    .failureReason("Stripe is not configured.")
                    .build();
        }
        // TODO: Refund.create(Map.of("payment_intent", transactionReference))
        return GatewayResult.builder()
                .success(false)
                .status(PaymentStatus.FAILED)
                .failureReason("Stripe refund integration pending.")
                .build();
    }
}
