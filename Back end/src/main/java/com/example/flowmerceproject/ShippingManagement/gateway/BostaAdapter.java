package com.example.flowmerceproject.ShippingManagement.gateway;

import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.ShippingManagement.entity.Shipment.ShipmentStatus;
import com.example.flowmerceproject.UserManagement.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Bosta (Egypt) courier adapter. Auth: Authorization header = the merchant's
 * own API key (no "Bearer" prefix). https://docs.bosta.co
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BostaAdapter implements ShippingCarrierAdapter {

    private static final Set<String> SUPPORTED = Set.of("BOSTA", "bosta");
    private static final String BASE_URL = "https://app.bosta.co/api/v2";

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public String getProviderName() { return "BOSTA"; }

    @Override
    public boolean supports(String carrier) {
        return carrier != null && SUPPORTED.contains(carrier.toUpperCase());
    }

    @Override
    @SuppressWarnings("unchecked")
    public ShippingResult createShipment(Order order, Map<String, String> credentials) {
        User user = order.getCustomer().getUser();
        HttpHeaders headers = headers(credentials.get("apiKey"));

        Map<String, Object> body = new HashMap<>();
        body.put("type", 10); // 10 = "send" (forward) delivery
        boolean isCod = order.getPaymentMethod() != null && order.getPaymentMethod().toUpperCase().contains("COD");
        body.put("cod", isCod ? order.getTotal() : java.math.BigDecimal.ZERO);
        body.put("dropOffAddress", Map.of(
                "city", "Cairo",
                "firstLine", order.getShippingAddress() != null ? order.getShippingAddress() : "NA"
        ));
        body.put("receiver", Map.of(
                "firstName", user.getFullName() != null ? user.getFullName() : "Customer",
                "phone", user.getPhone() != null ? user.getPhone() : "00000000000"
        ));
        body.put("specs", Map.of("packageType", "Parcel", "size", "SMALL"));
        body.put("businessReference", "ORDER-" + order.getOrderId());

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    BASE_URL + "/deliveries", HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            Map<String, Object> data = (Map<String, Object>) response.getBody();
            String trackingNumber = data != null && data.get("trackingNumber") != null
                    ? data.get("trackingNumber").toString() : null;

            return ShippingResult.builder()
                    .success(true)
                    .status(ShipmentStatus.CREATED)
                    .trackingNumber(trackingNumber)
                    .carrierResponse(String.valueOf(data))
                    .build();
        } catch (RestClientException e) {
            log.warn("Bosta shipment creation failed for order {}: {}", order.getOrderId(), e.getMessage());
            return ShippingResult.builder()
                    .success(false)
                    .status(ShipmentStatus.FAILED)
                    .failureReason("Bosta rejected the shipment request: " + e.getMessage())
                    .build();
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public ShippingResult track(String trackingNumber, Map<String, String> credentials) {
        HttpHeaders headers = headers(credentials.get("apiKey"));
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    BASE_URL + "/deliveries/business/" + trackingNumber, HttpMethod.GET,
                    new HttpEntity<>(headers), Map.class);
            Map<String, Object> data = (Map<String, Object>) response.getBody();
            return ShippingResult.builder()
                    .success(true)
                    .trackingNumber(trackingNumber)
                    .carrierResponse(String.valueOf(data))
                    .build();
        } catch (RestClientException e) {
            return ShippingResult.builder()
                    .success(false)
                    .failureReason("Could not retrieve Bosta tracking status: " + e.getMessage())
                    .build();
        }
    }

    private HttpHeaders headers(String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
