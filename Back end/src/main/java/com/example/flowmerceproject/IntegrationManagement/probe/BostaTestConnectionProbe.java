package com.example.flowmerceproject.IntegrationManagement.probe;

import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.TestConnectionResponse;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/** Validates a merchant's Bosta apiKey with a harmless authenticated list call. */
@Slf4j
@Component
@RequiredArgsConstructor
public class BostaTestConnectionProbe implements IntegrationTestConnectionProbe {

    private static final String DELIVERIES_URL = "https://app.bosta.co/api/v2/deliveries?limit=1";

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public Provider getProvider() { return Provider.BOSTA; }

    @Override
    public TestConnectionResponse test(Map<String, String> credentials) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", credentials.get("apiKey"));
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    DELIVERIES_URL, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                return TestConnectionResponse.builder()
                        .success(true).message("Bosta API key verified successfully.").build();
            }
            return TestConnectionResponse.builder()
                    .success(false).message("Bosta responded with " + response.getStatusCode()).build();
        } catch (HttpClientErrorException e) {
            return TestConnectionResponse.builder()
                    .success(false)
                    .message("Bosta rejected the API key (" + e.getStatusCode() + ").")
                    .build();
        } catch (RestClientException e) {
            log.warn("Bosta test-connection call failed: {}", e.getMessage());
            return TestConnectionResponse.builder()
                    .success(false).message("Could not reach Bosta: " + e.getMessage()).build();
        }
    }
}
