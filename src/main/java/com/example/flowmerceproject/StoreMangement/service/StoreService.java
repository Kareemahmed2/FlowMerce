package com.example.flowmerceproject.StoreMangement.service;

import com.example.flowmerceproject.StoreMangement.dto.StoreDTOs;
import com.example.flowmerceproject.StoreMangement.dto.StoreSettingsDTOs;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.entity.StoreSettings;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.StoreMangement.repository.StoreSettingsRepository;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.exception.ConflictException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository storeRepository;
    private final StoreSettingsRepository settingsRepository;
    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;

    @Transactional
    public StoreDTOs.StoreResponse createStore(String email, StoreDTOs.CreateStoreRequest request) {
        Merchant merchant = getMerchantByEmail(email);

        if (storeRepository.existsByStoreUrl(request.getStoreUrl())) {
            throw new ConflictException("Store URL already taken: " + request.getStoreUrl());
        }

        Store store = Store.builder()
                .merchant(merchant)
                .storeName(request.getStoreName())
                .storeUrl(request.getStoreUrl())
                .description(request.getDescription())
                .logo(request.getLogo())
                .status("DRAFT")
                .build();

        storeRepository.save(store);

        // Auto-create default settings for the new store
        StoreSettings settings = StoreSettings.builder()
                .store(store)
                .currency("USD")
                .timezone("UTC")
                .language("en")
                .build();
        settingsRepository.save(settings);

        return toResponse(store);
    }

    public List<StoreDTOs.StoreResponse> getMyStores(String email) {
        Merchant merchant = getMerchantByEmail(email);
        return storeRepository.findByMerchant_MerchantId(merchant.getMerchantId())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

  //owner only
    public StoreDTOs.StoreResponse getStoreById(String email, Integer storeId) {
        return toResponse(getStoreAndVerifyOwner(email, storeId));
    }

    @Transactional
    public StoreDTOs.StoreResponse updateStore(String email, Integer storeId,
                                               StoreDTOs.UpdateStoreRequest request) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setStoreName(request.getStoreName());
        if (request.getDescription() != null) store.setDescription(request.getDescription());
        if (request.getLogo() != null) store.setLogo(request.getLogo());
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse publishStore(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setStatus("PUBLISHED");
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse deactivateStore(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setStatus("DEACTIVATED");
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public String deleteStore(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        storeRepository.delete(store);
        return "Store deleted successfully.";
    }

    public StoreSettingsDTOs.SettingsResponse getSettings(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        StoreSettings settings = settingsRepository.findByStore_StoreId(storeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Settings not found for store: " + storeId));
        return toSettingsResponse(settings);
    }


    @Transactional
    public StoreSettingsDTOs.SettingsResponse updateSettings(String email, Integer storeId,
                                                             StoreSettingsDTOs.UpdateSettingsRequest request) {
        getStoreAndVerifyOwner(email, storeId);
        StoreSettings settings = settingsRepository.findByStore_StoreId(storeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Settings not found for store: " + storeId));

        if (request.getCurrency() != null)         settings.setCurrency(request.getCurrency());
        if (request.getTimezone() != null)         settings.setTimezone(request.getTimezone());
        if (request.getLanguage() != null)         settings.setLanguage(request.getLanguage());
        if (request.getTaxSettings() != null)      settings.setTaxSettings(request.getTaxSettings());
        if (request.getShippingSettings() != null) settings.setShippingSettings(request.getShippingSettings());

        settingsRepository.save(settings);
        return toSettingsResponse(settings);
    }

  //Only Admin
    public List<StoreDTOs.StoreResponse> getAllStores() {
        return storeRepository.findAll()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    private Merchant getMerchantByEmail(String email) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Merchant profile not found. Please create a merchant profile first."));
    }

    private Store getStoreAndVerifyOwner(String email, Integer storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Store not found with id: " + storeId));
        Merchant merchant = getMerchantByEmail(email);
        if (!store.getMerchant().getMerchantId().equals(merchant.getMerchantId())) {
            throw new ForbiddenException("You do not own this store.");
        }
        return store;
    }

    public StoreDTOs.StoreResponse toResponse(Store store) {
        return StoreDTOs.StoreResponse.builder()
                .storeId(store.getStoreId())
                .merchantId(store.getMerchant().getMerchantId())
                .storeName(store.getStoreName())
                .storeUrl(store.getStoreUrl())
                .description(store.getDescription())
                .logo(store.getLogo())
                .status(store.getStatus())
                .createdAt(store.getCreatedAt())
                .build();
    }

    private StoreSettingsDTOs.SettingsResponse toSettingsResponse(StoreSettings s) {
        return StoreSettingsDTOs.SettingsResponse.builder()
                .settingsId(s.getSettingsId())
                .storeId(s.getStore().getStoreId())
                .currency(s.getCurrency())
                .timezone(s.getTimezone())
                .language(s.getLanguage())
                .taxSettings(s.getTaxSettings())
                .shippingSettings(s.getShippingSettings())
                .build();
    }
}