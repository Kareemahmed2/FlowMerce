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

import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Aramex Shipping Services adapter — SOAP-over-HTTP (CreateShipments operation),
 * Aramex's only officially documented integration contract. The ClientInfo auth
 * block (account number/PIN/entity/country + username/password) travels on every call.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AramexAdapter implements ShippingCarrierAdapter {

    private static final Set<String> SUPPORTED = Set.of("ARAMEX", "aramex");
    private static final String SHIPPING_URL = "https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc";
    private static final String TRACKING_URL = "https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc";

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public String getProviderName() { return "ARAMEX"; }

    @Override
    public boolean supports(String carrier) {
        return carrier != null && SUPPORTED.contains(carrier.toUpperCase());
    }

    @Override
    public ShippingResult createShipment(Order order, Map<String, String> credentials) {
        User user = order.getCustomer().getUser();
        String envelope = buildCreateShipmentEnvelope(credentials, order, user);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_XML);
        headers.set("SOAPAction", "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments");

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    SHIPPING_URL, HttpMethod.POST, new HttpEntity<>(envelope, headers), String.class);
            String soapBody = response.getBody() != null ? response.getBody() : "";

            if (soapBody.contains("<HasErrors>true</HasErrors>")) {
                return ShippingResult.builder()
                        .success(false)
                        .status(ShipmentStatus.FAILED)
                        .failureReason("Aramex rejected the shipment request.")
                        .carrierResponse(soapBody)
                        .build();
            }
            String trackingNumber = extractTag(soapBody, "ID");
            return ShippingResult.builder()
                    .success(true)
                    .status(ShipmentStatus.CREATED)
                    .trackingNumber(trackingNumber)
                    .carrierResponse(soapBody)
                    .build();
        } catch (RestClientException e) {
            log.warn("Aramex shipment creation failed for order {}: {}", order.getOrderId(), e.getMessage());
            return ShippingResult.builder()
                    .success(false)
                    .status(ShipmentStatus.FAILED)
                    .failureReason("Could not reach Aramex: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public ShippingResult track(String trackingNumber, Map<String, String> credentials) {
        String envelope = buildTrackShipmentEnvelope(credentials, trackingNumber);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_XML);
        headers.set("SOAPAction", "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/TrackShipments");

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    TRACKING_URL, HttpMethod.POST, new HttpEntity<>(envelope, headers), String.class);
            return ShippingResult.builder()
                    .success(true)
                    .trackingNumber(trackingNumber)
                    .carrierResponse(response.getBody())
                    .build();
        } catch (RestClientException e) {
            return ShippingResult.builder()
                    .success(false)
                    .failureReason("Could not retrieve Aramex tracking status: " + e.getMessage())
                    .build();
        }
    }

    private String clientInfo(Map<String, String> c) {
        return "<v1:ClientInfo>"
                + "<v1:AccountCountryCode>" + c.get("accountCountryCode") + "</v1:AccountCountryCode>"
                + "<v1:AccountEntity>" + c.get("accountEntity") + "</v1:AccountEntity>"
                + "<v1:AccountNumber>" + c.get("accountNumber") + "</v1:AccountNumber>"
                + "<v1:AccountPin>" + c.get("accountPin") + "</v1:AccountPin>"
                + "<v1:UserName>" + c.get("username") + "</v1:UserName>"
                + "<v1:Password>" + c.get("password") + "</v1:Password>"
                + "<v1:Version>v1.0</v1:Version>"
                + "</v1:ClientInfo>";
    }

    private String buildCreateShipmentEnvelope(Map<String, String> c, Order order, User user) {
        String receiverName = user.getFullName() != null ? user.getFullName() : "Customer";
        String receiverPhone = user.getPhone() != null ? user.getPhone() : "00000000000";
        String address = order.getShippingAddress() != null ? order.getShippingAddress() : "NA";
        boolean isCod = order.getPaymentMethod() != null && order.getPaymentMethod().toUpperCase().contains("COD");

        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                + "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" "
                + "xmlns:v1=\"http://ws.aramex.net/ShippingAPI/v1/\">"
                + "<soap:Body>"
                + "<v1:CreateShipments>"
                + clientInfo(c)
                + "<v1:Shipments>"
                + "<v1:Shipment>"
                + "<v1:Shipper>"
                + "<v1:PartyAddress><v1:Line1>Merchant warehouse</v1:Line1><v1:City>Cairo</v1:City><v1:CountryCode>EG</v1:CountryCode></v1:PartyAddress>"
                + "<v1:Contact><v1:PersonName>Merchant</v1:PersonName><v1:PhoneNumber1>00000000000</v1:PhoneNumber1></v1:Contact>"
                + "</v1:Shipper>"
                + "<v1:Consignee>"
                + "<v1:PartyAddress><v1:Line1>" + escape(address) + "</v1:Line1><v1:City>Cairo</v1:City><v1:CountryCode>EG</v1:CountryCode></v1:PartyAddress>"
                + "<v1:Contact><v1:PersonName>" + escape(receiverName) + "</v1:PersonName><v1:PhoneNumber1>" + receiverPhone + "</v1:PhoneNumber1></v1:Contact>"
                + "</v1:Consignee>"
                + "<v1:Details>"
                + "<v1:ProductGroup>DOM</v1:ProductGroup>"
                + "<v1:ProductType>OND</v1:ProductType>"
                + "<v1:PaymentType>" + (isCod ? "C" : "P") + "</v1:PaymentType>"
                + "<v1:ActualWeight><v1:Unit>KG</v1:Unit><v1:Value>1</v1:Value></v1:ActualWeight>"
                + "<v1:NumberOfPieces>1</v1:NumberOfPieces>"
                + "<v1:DescriptionOfGoods>Order #" + order.getOrderId() + "</v1:DescriptionOfGoods>"
                + "</v1:Details>"
                + "<v1:Reference1>ORDER-" + order.getOrderId() + "</v1:Reference1>"
                + "</v1:Shipment>"
                + "</v1:Shipments>"
                + "</v1:CreateShipments>"
                + "</soap:Body>"
                + "</soap:Envelope>";
    }

    private String buildTrackShipmentEnvelope(Map<String, String> c, String trackingNumber) {
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                + "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" "
                + "xmlns:v1=\"http://ws.aramex.net/ShippingAPI/v1/\">"
                + "<soap:Body>"
                + "<v1:TrackShipments>"
                + clientInfo(c)
                + "<v1:Shipments><v1:string>" + trackingNumber + "</v1:string></v1:Shipments>"
                + "</v1:TrackShipments>"
                + "</soap:Body>"
                + "</soap:Envelope>";
    }

    private String extractTag(String xml, String tagName) {
        Pattern pattern = Pattern.compile("<" + tagName + ">([^<]*)</" + tagName + ">");
        Matcher matcher = pattern.matcher(xml);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
