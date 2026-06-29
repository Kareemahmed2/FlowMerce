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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * DHL Express (MyDHL API) adapter. Auth: HTTP Basic — username=apiKey,
 * password=apiSecret. https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DhlAdapter implements ShippingCarrierAdapter {

    private static final Set<String> SUPPORTED = Set.of("DHL", "dhl");
    private static final String BASE_URL = "https://express.api.dhl.com/mydhlapi";

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public String getProviderName() { return "DHL"; }

    @Override
    public boolean supports(String carrier) {
        return carrier != null && SUPPORTED.contains(carrier.toUpperCase());
    }

    @Override
    @SuppressWarnings("unchecked")
    public ShippingResult createShipment(Order order, Map<String, String> credentials) {
        User user = order.getCustomer().getUser();
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(credentials.get("apiKey"), credentials.get("apiSecret"));
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> address = Map.of("postalCode", "00000", "cityName", "Cairo", "countryCode", "EG");
        Map<String, Object> body = Map.of(
                "plannedShippingDateAndTime", LocalDate.now().plusDays(1) + "T12:00:00GMT+02:00",
                "productCode", "P",
                "accounts", List.of(Map.of("typeCode", "shipper", "number", credentials.get("accountNumber"))),
                "customerDetails", Map.of(
                        "shipperDetails", Map.of("postalAddress", address,
                                "contactInformation", Map.of("phone", "00000000000", "companyName", "Merchant",
                                        "fullName", "Merchant")),
                        "receiverDetails", Map.of("postalAddress", address,
                                "contactInformation", Map.of(
                                        "phone", user.getPhone() != null ? user.getPhone() : "00000000000",
                                        "companyName", user.getFullName() != null ? user.getFullName() : "Customer",
                                        "fullName", user.getFullName() != null ? user.getFullName() : "Customer"))
                ),
                "content", Map.of(
                        "isCustomsDeclarable", false,
                        "description", "Order #" + order.getOrderId(),
                        "incoterm", "DAP",
                        "unitOfMeasurement", "metric",
                        "packages", List.of(Map.of("weight", 1.0, "dimensions",
                                Map.of("length", 10, "width", 10, "height", 10)))
                )
        );

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    BASE_URL + "/shipments", HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            Map<String, Object> data = (Map<String, Object>) response.getBody();
            String trackingNumber = data != null && data.get("shipmentTrackingNumber") != null
                    ? data.get("shipmentTrackingNumber").toString() : null;

            return ShippingResult.builder()
                    .success(true)
                    .status(ShipmentStatus.CREATED)
                    .trackingNumber(trackingNumber)
                    .carrierResponse(String.valueOf(data))
                    .build();
        } catch (RestClientException e) {
            log.warn("DHL shipment creation failed for order {}: {}", order.getOrderId(), e.getMessage());
            return ShippingResult.builder()
                    .success(false)
                    .status(ShipmentStatus.FAILED)
                    .failureReason("DHL rejected the shipment request: " + e.getMessage())
                    .build();
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public ShippingResult track(String trackingNumber, Map<String, String> credentials) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(credentials.get("apiKey"), credentials.get("apiSecret"));
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    BASE_URL + "/shipments/" + trackingNumber + "/tracking", HttpMethod.GET,
                    new HttpEntity<>(headers), Map.class);
            return ShippingResult.builder()
                    .success(true)
                    .trackingNumber(trackingNumber)
                    .carrierResponse(String.valueOf(response.getBody()))
                    .build();
        } catch (RestClientException e) {
            return ShippingResult.builder()
                    .success(false)
                    .failureReason("Could not retrieve DHL tracking status: " + e.getMessage())
                    .build();
        }
    }
}
