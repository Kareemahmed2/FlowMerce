package com.example.flowmerceproject.IntegrationManagement.service;

import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration;
import com.example.flowmerceproject.IntegrationManagement.repository.StoreIntegrationRepository;
import com.example.flowmerceproject.IntegrationManagement.security.CredentialEncryptionService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Shared lookup used by every gateway/carrier adapter (PaymobAdapter, the
 * shipping adapters) to resolve a specific store's own decrypted credentials.
 * Never returns credentials for a disabled or unconfigured integration —
 * callers must treat an empty Optional as "not available", not an error.
 */
@Service
@RequiredArgsConstructor
public class IntegrationCredentialResolver {

    private final StoreIntegrationRepository integrationRepository;
    private final CredentialEncryptionService encryptionService;
    private final ObjectMapper objectMapper;

    public Optional<Map<String, String>> resolve(Integer storeId, StoreIntegration.Provider provider) {
        return integrationRepository.findByStore_StoreIdAndProvider(storeId, provider)
                .filter(StoreIntegration::isEnabled)
                .map(this::decryptToMap);
    }

    private Map<String, String> decryptToMap(StoreIntegration integration) {
        try {
            String json = encryptionService.decrypt(integration.getCredentialsEncrypted());
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Stored credentials for integration " + integration.getIntegrationId()
                            + " are corrupted; the merchant must re-save them.", e);
        }
    }
}
