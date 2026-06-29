package com.example.flowmerceproject.PaymentManagement.gateway;

import java.math.BigDecimal;

/**
 * Strategy interface for payment gateway integrations.
 * Each adapter handles a specific payment method or provider.
 */
public interface PaymentGatewayAdapter {

    /** Human-readable name of this gateway (e.g. "STRIPE", "COD", "WALLET"). */
    String getProviderName();

    /** Returns true if this adapter handles the given paymentMethod string. */
    boolean supports(String paymentMethod);

    /**
     * Processes a new payment.
     *
     * @param orderId      the order being paid for
     * @param amount       total to charge
     * @param paymentMethod the method string from the request
     * @param customerEmail the buyer's email (for wallet / identity lookups)
     */
    GatewayResult process(Integer orderId, BigDecimal amount,
                          String paymentMethod, String customerEmail);

    /**
     * Issues a full or partial refund for a previously completed payment.
     *
     * @param orderId               the order being refunded (needed by adapters that resolve
     *                              per-store credentials, e.g. PaymobAdapter)
     * @param transactionReference  the gateway's transaction ID
     * @param amount                amount to refund
     * @param customerEmail         the buyer's email
     */
    GatewayResult refund(Integer orderId, String transactionReference, BigDecimal amount, String customerEmail);
}
