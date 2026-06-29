package com.example.flowmerceproject.IntegrationManagement.probe;

import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.TestConnectionResponse;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/** Validates a merchant's Paymob apiKey via the cheapest real call: POST /auth/tokens. */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymobTestConnectionProbe implements IntegrationTestConnectionProbe {

    private static final String AUTH_URL = "https://accept.paymob.com/api/auth/tokens";

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public Provider getProvider() { return Provider.PAYMOB; }

    @Override
    @SuppressWarnings("unchecked")
    public TestConnectionResponse test(Map<String, String> credentials) {
        try {
            Map<String, Object> response = restTemplate.postForObject(
                    AUTH_URL, Map.of("api_key", credentials.get("apiKey")), Map.class);
            if (response != null && response.get("token") != null) {
                return TestConnectionResponse.builder()
                        .success(true).message("Paymob auth token retrieved successfully.").build();
            }
            return TestConnectionResponse.builder()
                    .success(false).message("Paymob responded without an auth token.").build();
        } catch (HttpClientErrorException e) {
            return TestConnectionResponse.builder()
                    .success(false)
                    .message("Paymob rejected the API key (" + e.getStatusCode() + ").")
                    .build();
        } catch (RestClientException e) {
            log.warn("Paymob test-connection call failed: {}", e.getMessage());
            return TestConnectionResponse.builder()
                    .success(false).message("Could not reach Paymob: " + e.getMessage()).build();
        }
    }
}
