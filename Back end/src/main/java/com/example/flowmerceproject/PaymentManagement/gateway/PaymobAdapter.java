package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration;
import com.example.flowmerceproject.IntegrationManagement.service.IntegrationCredentialResolver;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/**
 * Paymob "Accept" adapter — Egypt's leading payment gateway.
 *
 * Unlike the original stub, this never reads a global API key: every call
 * resolves the *owning store's own* credentials via IntegrationCredentialResolver
 * (saved by the merchant in Settings -> Integrations). FlowMerce never holds its
 * own Paymob account — it is a pass-through using each merchant's account.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymobAdapter implements PaymentGatewayAdapter {

    private static final Set<String> SUPPORTED = Set.of("PAYMOB", "paymob");
    private static final String BASE_URL = "https://accept.paymob.com/api";

    private final OrderRepository orderRepository;
    private final IntegrationCredentialResolver credentialResolver;

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public String getProviderName() { return "PAYMOB"; }

    @Override
    public boolean supports(String paymentMethod) {
        return paymentMethod != null && SUPPORTED.contains(paymentMethod.toUpperCase());
    }

    @Override
    public GatewayResult process(Integer orderId, BigDecimal amount,
                                 String paymentMethod, String customerEmail) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        Map<String, String> creds = credentialResolver
                .resolve(order.getStore().getStoreId(), StoreIntegration.Provider.PAYMOB)
                .orElse(null);
        if (creds == null) {
            return notConfigured();
        }

        try {
            String authToken = requestAuthToken(creds.get("apiKey"));
            String paymobOrderId = registerOrder(authToken, orderId, amount);
            String paymentKey = requestPaymentKey(authToken, paymobOrderId, amount,
                    creds.get("integrationIdCard"), order);
            String redirectUrl = BASE_URL + "/acceptance/iframes/" + creds.get("iframeId")
                    + "?payment_token=" + paymentKey;

            return GatewayResult.builder()
                    .success(true)
                    .status(PaymentStatus.PROCESSING)
                    .transactionReference(paymobOrderId)
                    .redirectUrl(redirectUrl)
                    .gatewayResponse("{\"paymobOrderId\":\"" + paymobOrderId + "\"}")
                    .build();
        } catch (RestClientException e) {
            log.warn("Paymob payment initiation failed for order {}: {}", orderId, e.getMessage());
            return GatewayResult.builder()
                    .success(false)
                    .status(PaymentStatus.FAILED)
                    .failureReason("Paymob rejected the payment request: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public GatewayResult refund(Integer orderId, String transactionReference, BigDecimal amount,
                                String customerEmail) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        Map<String, String> creds = credentialResolver
                .resolve(order.getStore().getStoreId(), StoreIntegration.Provider.PAYMOB)
                .orElse(null);
        if (creds == null) {
            return notConfigured();
        }

        try {
            String authToken = requestAuthToken(creds.get("apiKey"));
            Map<String, Object> body = Map.of(
                    "auth_token", authToken,
                    "transaction_id", transactionReference,
                    "amount_cents", toCents(amount)
            );
            restTemplate.postForObject(BASE_URL + "/acceptance/void_refund/refund", body, Map.class);

            return GatewayResult.builder()
                    .success(true)
                    .status(PaymentStatus.REFUNDED)
                    .transactionReference(transactionReference)
                    .build();
        } catch (RestClientException e) {
            log.warn("Paymob refund failed for order {}: {}", orderId, e.getMessage());
            return GatewayResult.builder()
                    .success(false)
                    .status(PaymentStatus.FAILED)
                    .failureReason("Paymob rejected the refund request: " + e.getMessage())
                    .build();
        }
    }

    // ── PAYMOB ACCEPT 3-STEP FLOW ────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String requestAuthToken(String apiKey) {
        Map<String, Object> response = restTemplate.postForObject(
                BASE_URL + "/auth/tokens", Map.of("api_key", apiKey), Map.class);
        if (response == null || response.get("token") == null) {
            throw new RestClientException("Paymob auth/tokens returned no token");
        }
        return response.get("token").toString();
    }

    @SuppressWarnings("unchecked")
    private String registerOrder(String authToken, Integer orderId, BigDecimal amount) {
        Map<String, Object> body = Map.of(
                "auth_token", authToken,
                "delivery_needed", false,
                "amount_cents", toCents(amount),
                "currency", "EGP",
                "merchant_order_id", orderId,
                "items", java.util.List.of()
        );
        Map<String, Object> response = restTemplate.postForObject(
                BASE_URL + "/ecommerce/orders", body, Map.class);
        if (response == null || response.get("id") == null) {
            throw new RestClientException("Paymob ecommerce/orders returned no order id");
        }
        return response.get("id").toString();
    }

    @SuppressWarnings("unchecked")
    private String requestPaymentKey(String authToken, String paymobOrderId, BigDecimal amount,
                                      String integrationId, Order order) {
        Map<String, Object> billingData = buildBillingData(order);
        Map<String, Object> body = Map.of(
                "auth_token", authToken,
                "amount_cents", toCents(amount),
                "expiration", 3600,
                "order_id", paymobOrderId,
                "billing_data", billingData,
                "currency", "EGP",
                "integration_id", integrationId
        );
        Map<String, Object> response = restTemplate.postForObject(
                BASE_URL + "/acceptance/payment_keys", body, Map.class);
        if (response == null || response.get("token") == null) {
            throw new RestClientException("Paymob payment_keys returned no payment token");
        }
        return response.get("token").toString();
    }

    private Map<String, Object> buildBillingData(Order order) {
        User user = order.getCustomer().getUser();
        String fullName = user.getFullName() != null ? user.getFullName() : "Customer";
        String[] nameParts = fullName.trim().split("\\s+", 2);

        Map<String, Object> billing = new java.util.HashMap<>();
        billing.put("first_name", nameParts[0]);
        billing.put("last_name", nameParts.length > 1 ? nameParts[1] : "NA");
        billing.put("email", user.getEmail());
        billing.put("phone_number", user.getPhone() != null ? user.getPhone() : "NA");
        billing.put("apartment", "NA");
        billing.put("floor", "NA");
        billing.put("building", "NA");
        billing.put("street", order.getShippingAddress() != null ? order.getShippingAddress() : "NA");
        billing.put("city", "NA");
        billing.put("state", "NA");
        billing.put("country", "EG");
        billing.put("postal_code", "NA");
        billing.put("shipping_method", "NA");
        return billing;
    }

    private GatewayResult notConfigured() {
        return GatewayResult.builder()
                .success(false)
                .status(PaymentStatus.FAILED)
                .failureReason("This store has not configured Paymob. The merchant must add their "
                        + "Paymob credentials in Settings → Integrations.")
                .build();
    }

    private long toCents(BigDecimal amount) {
        return amount.multiply(BigDecimal.valueOf(100)).longValue();
    }
}
