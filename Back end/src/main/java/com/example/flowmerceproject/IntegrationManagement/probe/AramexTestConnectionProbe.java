package com.example.flowmerceproject.IntegrationManagement.probe;

import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.TestConnectionResponse;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Validates a merchant's Aramex account via the Rate Calculator SOAP operation
 * (CalculateRate) — cheap, no shipment side-effect, still exercises the same
 * ClientInfo auth block used by CreateShipments.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AramexTestConnectionProbe implements IntegrationTestConnectionProbe {

    private static final String RATE_CALCULATOR_URL =
            "https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc";

    @Qualifier("integrationRestTemplate")
    private final RestTemplate restTemplate;

    @Override
    public Provider getProvider() { return Provider.ARAMEX; }

    @Override
    public TestConnectionResponse test(Map<String, String> credentials) {
        String envelope = buildCalculateRateEnvelope(credentials);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_XML);
        headers.set("SOAPAction", "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CalculateRate");

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    RATE_CALCULATOR_URL, org.springframework.http.HttpMethod.POST,
                    new HttpEntity<>(envelope, headers), String.class);

            String soapBody = response.getBody() != null ? response.getBody() : "";
            if (soapBody.contains("<HasErrors>false</HasErrors>")) {
                return TestConnectionResponse.builder()
                        .success(true).message("Aramex account credentials verified successfully.").build();
            }
            if (soapBody.contains("<HasErrors>true</HasErrors>") || soapBody.contains("Fault")) {
                return TestConnectionResponse.builder()
                        .success(false)
                        .message("Aramex rejected the account credentials. Check account number/PIN/entity/country.")
                        .build();
            }
            return TestConnectionResponse.builder()
                    .success(false).message("Unexpected response from Aramex.").build();
        } catch (RestClientException e) {
            log.warn("Aramex test-connection call failed: {}", e.getMessage());
            return TestConnectionResponse.builder()
                    .success(false).message("Could not reach Aramex: " + e.getMessage()).build();
        }
    }

    private String buildCalculateRateEnvelope(Map<String, String> c) {
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                + "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" "
                + "xmlns:v1=\"http://ws.aramex.net/ShippingAPI/v1/\">"
                + "<soap:Body>"
                + "<v1:CalculateRate>"
                + "<v1:ClientInfo>"
                + "<v1:AccountCountryCode>" + c.get("accountCountryCode") + "</v1:AccountCountryCode>"
                + "<v1:AccountEntity>" + c.get("accountEntity") + "</v1:AccountEntity>"
                + "<v1:AccountNumber>" + c.get("accountNumber") + "</v1:AccountNumber>"
                + "<v1:AccountPin>" + c.get("accountPin") + "</v1:AccountPin>"
                + "<v1:UserName>" + c.get("username") + "</v1:UserName>"
                + "<v1:Password>" + c.get("password") + "</v1:Password>"
                + "<v1:Version>v1.0</v1:Version>"
                + "</v1:ClientInfo>"
                + "<v1:OriginAddress><v1:City>Cairo</v1:City><v1:CountryCode>EG</v1:CountryCode></v1:OriginAddress>"
                + "<v1:DestinationAddress><v1:City>Alexandria</v1:City><v1:CountryCode>EG</v1:CountryCode></v1:DestinationAddress>"
                + "<v1:ShipmentDetails>"
                + "<v1:ActualWeight><v1:Unit>KG</v1:Unit><v1:Value>1</v1:Value></v1:ActualWeight>"
                + "<v1:ProductGroup>DOM</v1:ProductGroup>"
                + "<v1:ProductType>OND</v1:ProductType>"
                + "<v1:PaymentType>P</v1:PaymentType>"
                + "<v1:NumberOfPieces>1</v1:NumberOfPieces>"
                + "</v1:ShipmentDetails>"
                + "</v1:CalculateRate>"
                + "</soap:Body>"
                + "</soap:Envelope>";
    }
}
