package com.example.flowmerceproject.ShippingManagement.gateway;

import com.example.flowmerceproject.OrderManagement.entity.Order;

import java.util.Map;

/**
 * Strategy interface for carrier integrations. Each adapter calls the carrier's
 * API using the credentials passed in — already resolved/decrypted by the
 * caller (ShippingService), so adapters never touch the credential store directly.
 */
public interface ShippingCarrierAdapter {

    String getProviderName();

    boolean supports(String carrier);

    ShippingResult createShipment(Order order, Map<String, String> credentials);

    ShippingResult track(String trackingNumber, Map<String, String> credentials);
}
