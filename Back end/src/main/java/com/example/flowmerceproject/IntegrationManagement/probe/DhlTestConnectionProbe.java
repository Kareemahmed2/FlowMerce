package com.example.flowmerceproject.IntegrationManagement.probe;

import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.TestConnectionResponse;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Validates a merchant's DHL Express (MyDHL API) apiKey/apiSecret/accountNumber
 * with a rate request — confirms the credentials and account number are
 * accepted without creating a real shipment.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DhlTestConnectionProbe implements IntegrationTestConnectionProbe {

    private static final String RATES_URL = "https://express.api.dhl.com/mydhlapi/test/rates";

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public Provider getProvider() { return Provider.DHL; }

    @Override
    public TestConnectionResponse test(Map<String, String> credentials) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(credentials.get("apiKey"), credentials.get("apiSecret"));
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "customerDetails", Map.of(
                        "shipperDetails", Map.of("postalCode", "00000", "cityName", "Cairo", "countryCode", "EG"),
                        "receiverDetails", Map.of("postalCode", "00000", "cityName", "Cairo", "countryCode", "EG")
                ),
                "accounts", List.of(Map.of("typeCode", "shipper", "number", credentials.get("accountNumber"))),
                "plannedShippingDateAndTime", LocalDate.now().plusDays(1) + "T12:00:00GMT+02:00",
                "unitOfMeasurement", "metric",
                "isCustomsDeclarable", false,
                "packages", List.of(Map.of("weight", 1.0, "dimensions",
                        Map.of("length", 10, "width", 10, "height", 10)))
        );

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    RATES_URL, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                return TestConnectionResponse.builder()
                        .success(true).message("DHL credentials and account number verified successfully.").build();
            }
            return TestConnectionResponse.builder()
                    .success(false).message("DHL responded with " + response.getStatusCode()).build();
        } catch (HttpClientErrorException e) {
            return TestConnectionResponse.builder()
                    .success(false)
                    .message("DHL rejected the request (" + e.getStatusCode() + "). Check API key/secret/account number.")
                    .build();
        } catch (RestClientException e) {
            log.warn("DHL test-connection call failed: {}", e.getMessage());
            return TestConnectionResponse.builder()
                    .success(false).message("Could not reach DHL: " + e.getMessage()).build();
        }
    }
}
