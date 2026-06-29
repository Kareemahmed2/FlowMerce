package com.example.flowmerceproject.PaymentManagement.gateway;

import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.PaymentManagement.entity.Payment.PaymentStatus;
import com.example.flowmerceproject.PaymentManagement.entity.WalletTransaction.ReferenceType;
import com.example.flowmerceproject.PaymentManagement.service.WalletService;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

/**
 * Simulation wallet adapter — deducts from the customer's virtual wallet and
 * credits the merchant's virtual wallet. Completes synchronously.
 * Used for demo/presentation purposes only.
 */
@Component
@RequiredArgsConstructor
public class WalletSimulationAdapter implements PaymentGatewayAdapter {

    private static final Set<String> SUPPORTED = Set.of(
            "FLOWMERCE_WALLET", "WALLET", "flowmerce_wallet", "wallet",
            "MEEZA", "meeza", "E_WALLET", "e_wallet"
    );

    private final WalletService walletService;
    private final OrderRepository orderRepository;

    @Override
    public String getProviderName() { return "FLOWMERCE_WALLET"; }

    @Override
    public boolean supports(String paymentMethod) {
        return paymentMethod != null && SUPPORTED.contains(paymentMethod.toUpperCase());
    }

    @Override
    public GatewayResult process(Integer orderId, BigDecimal amount,
                                 String paymentMethod, String customerEmail) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        // Pre-check balance to avoid polluting the outer transaction on failure
        BigDecimal available = walletService.getOrCreateCustomerWallet(order.getCustomer()).getBalance();
        if (available.compareTo(amount) < 0) {
            return GatewayResult.builder()
                    .success(false)
                    .status(PaymentStatus.FAILED)
                    .failureReason("Insufficient wallet balance. Available: " + available + " EGP, Required: " + amount + " EGP")
                    .gatewayResponse("{\"error\":\"insufficient_balance\"}")
                    .build();
        }

        // Debit customer then credit merchant
        walletService.debitCustomer(
                order.getCustomer(), amount,
                "Payment for order #" + orderId, orderId);

        walletService.creditMerchant(
                order.getStore().getMerchant(), amount,
                "Payment received for order #" + orderId, orderId);

        String ref = "WALLET-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        return GatewayResult.builder()
                .success(true)
                .status(PaymentStatus.COMPLETED)
                .transactionReference(ref)
                .gatewayResponse("{\"method\":\"WALLET\",\"ref\":\"" + ref + "\"}")
                .build();
    }

    @Override
    public GatewayResult refund(Integer orderId, String transactionReference, BigDecimal amount,
                                String customerEmail) {
        // Refund reverses the wallet transaction — handled by PaymentServiceImpl
        String ref = "WALLET-REFUND-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        return GatewayResult.builder()
                .success(true)
                .status(PaymentStatus.REFUNDED)
                .transactionReference(ref)
                .gatewayResponse("{\"method\":\"WALLET_REFUND\",\"ref\":\"" + ref + "\"}")
                .build();
    }
}
