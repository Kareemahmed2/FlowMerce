package com.example.flowmerceproject.IntegrationManagement.probe;

import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.TestConnectionResponse;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;

import java.util.Map;

/**
 * Makes the cheapest real authenticated call to a provider to confirm a
 * merchant's stored credentials actually work, without side effects
 * (no real shipment/payment created).
 */
public interface IntegrationTestConnectionProbe {

    Provider getProvider();

    TestConnectionResponse test(Map<String, String> credentials);
}
