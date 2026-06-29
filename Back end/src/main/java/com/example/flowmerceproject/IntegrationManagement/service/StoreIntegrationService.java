package com.example.flowmerceproject.IntegrationManagement.service;

import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.IntegrationStatusResponse;
import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.SaveCredentialsRequest;
import com.example.flowmerceproject.IntegrationManagement.dto.IntegrationDTOs.TestConnectionResponse;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.Provider;
import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration.VerificationStatus;
import com.example.flowmerceproject.IntegrationManagement.probe.IntegrationTestConnectionProbe;
import com.example.flowmerceproject.IntegrationManagement.repository.StoreIntegrationRepository;
import com.example.flowmerceproject.IntegrationManagement.security.CredentialEncryptionService;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StoreIntegrationService {

    private final StoreIntegrationRepository integrationRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final CredentialEncryptionService encryptionService;
    private final ObjectMapper objectMapper;
    private final List<IntegrationTestConnectionProbe> probes;

    @Transactional(readOnly = true)
    public List<IntegrationStatusResponse> listForStore(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        Map<Provider, StoreIntegration> existing = integrationRepository.findByStore_StoreId(storeId).stream()
                .collect(java.util.stream.Collectors.toMap(StoreIntegration::getProvider, si -> si));

        return java.util.Arrays.stream(Provider.values())
                .map(provider -> existing.containsKey(provider)
                        ? toResponse(existing.get(provider))
                        : emptyResponse(provider))
                .toList();
    }

    @Transactional
    public IntegrationStatusResponse saveCredentials(String email, Integer storeId,
                                                       Provider provider, SaveCredentialsRequest request) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        RequiredCredentialFields.validate(provider, request.getCredentials());

        StoreIntegration integration = integrationRepository
                .findByStore_StoreIdAndProvider(storeId, provider)
                .orElseGet(() -> StoreIntegration.builder().store(store).provider(provider).build());

        String json = writeJson(request.getCredentials());
        integration.setCredentialsEncrypted(encryptionService.encrypt(json));
        integration.setLastVerifiedAt(null);
        integration.setLastVerifiedStatus(VerificationStatus.UNVERIFIED);
        // Saving new credentials never auto-enables — the merchant must explicitly
        // flip the toggle after confirming the connection works.
        integration.setEnabled(false);

        return toResponse(integrationRepository.save(integration));
    }

    @Transactional
    public IntegrationStatusResponse setEnabled(String email, Integer storeId, Provider provider, boolean enabled) {
        getStoreAndVerifyOwner(email, storeId);
        StoreIntegration integration = integrationRepository
                .findByStore_StoreIdAndProvider(storeId, provider)
                .orElseThrow(() -> new BadRequestException(
                        "Configure " + provider + " credentials before enabling it."));
        integration.setEnabled(enabled);
        return toResponse(integrationRepository.save(integration));
    }

    @Transactional
    public TestConnectionResponse testConnection(String email, Integer storeId, Provider provider) {
        getStoreAndVerifyOwner(email, storeId);
        StoreIntegration integration = integrationRepository
                .findByStore_StoreIdAndProvider(storeId, provider)
                .orElseThrow(() -> new BadRequestException(
                        "Configure " + provider + " credentials before testing the connection."));

        Map<String, String> credentials = readJson(encryptionService.decrypt(integration.getCredentialsEncrypted()));
        IntegrationTestConnectionProbe probe = probes.stream()
                .filter(p -> p.getProvider() == provider)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("No test probe available for " + provider));

        TestConnectionResponse result = probe.test(credentials);

        integration.setLastVerifiedAt(LocalDateTime.now());
        integration.setLastVerifiedStatus(result.isSuccess() ? VerificationStatus.SUCCESS : VerificationStatus.FAILED);
        integrationRepository.save(integration);

        return result;
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    private Merchant getMerchantByEmail(String email) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Merchant profile not found. Please create a merchant profile first."));
    }

    /**
     * StoreService.getStoreAndVerifyOwner is private to that package — following the
     * codebase's own precedent (OrderService.verifyMerchantOwnsStore independently
     * re-implements the same check), this re-implements it locally rather than
     * widening visibility on existing, working code.
     */
    private Store getStoreAndVerifyOwner(String email, Integer storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found with id: " + storeId));
        Merchant merchant = getMerchantByEmail(email);
        if (!store.getMerchant().getMerchantId().equals(merchant.getMerchantId())) {
            throw new ForbiddenException("You do not own this store.");
        }
        return store;
    }

    private IntegrationStatusResponse toResponse(StoreIntegration integration) {
        Map<String, String> credentials = readJson(encryptionService.decrypt(integration.getCredentialsEncrypted()));
        String previewField = RequiredCredentialFields.previewField(integration.getProvider());
        return IntegrationStatusResponse.builder()
                .provider(integration.getProvider())
                .enabled(integration.isEnabled())
                .configured(true)
                .maskedPreview(mask(credentials.get(previewField)))
                .lastVerifiedAt(integration.getLastVerifiedAt())
                .lastVerifiedStatus(integration.getLastVerifiedStatus())
                .build();
    }

    private IntegrationStatusResponse emptyResponse(Provider provider) {
        return IntegrationStatusResponse.builder()
                .provider(provider)
                .enabled(false)
                .configured(false)
                .maskedPreview(null)
                .lastVerifiedAt(null)
                .lastVerifiedStatus(null)
                .build();
    }

    private String mask(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.length() <= 4) return "••••";
        return "••••" + value.substring(value.length() - 4);
    }

    private String writeJson(Map<String, String> credentials) {
        try {
            return objectMapper.writeValueAsString(credentials);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize credentials", e);
        }
    }

    private Map<String, String> readJson(String json) {
        try {
            return objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deserialize stored credentials", e);
        }
    }
}
