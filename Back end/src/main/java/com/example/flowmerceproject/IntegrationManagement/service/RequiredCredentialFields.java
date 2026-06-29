package com.example.flowmerceproject.IntegrationManagement.service;

import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;

import java.util.List;
import java.util.Map;

/**
 * Registry of the credential fields a merchant must supply per provider.
 * A generic Map&lt;String,String&gt; credential bag (validated here) avoids needing
 * a separate typed request DTO per provider, since each one needs different keys.
 */
public final class RequiredCredentialFields {

    public static final Map<Provider, List<String>> REQUIRED = Map.of(
            Provider.PAYMOB, List.of("apiKey", "integrationIdCard", "iframeId", "hmacSecret"),
            Provider.BOSTA, List.of("apiKey"),
            Provider.ARAMEX, List.of("accountCountryCode", "accountEntity", "accountNumber",
                    "accountPin", "username", "password"),
            Provider.DHL, List.of("apiKey", "apiSecret", "accountNumber")
    );

    private RequiredCredentialFields() {}

    public static void validate(Provider provider, Map<String, String> credentials) {
        List<String> missing = REQUIRED.get(provider).stream()
                .filter(key -> isBlank(credentials.get(key)))
                .toList();
        if (!missing.isEmpty()) {
            throw new BadRequestException(
                    "Missing required " + provider + " fields: " + missing);
        }
    }

    /** The field shown (masked) as the dashboard's "connected" preview. */
    public static String previewField(Provider provider) {
        return REQUIRED.get(provider).get(0);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
