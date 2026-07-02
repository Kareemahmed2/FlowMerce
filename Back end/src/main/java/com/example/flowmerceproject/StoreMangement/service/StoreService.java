package com.example.flowmerceproject.StoreMangement.service;

import com.example.flowmerceproject.InventoryManagement.repository.InventoryRepository;
import com.example.flowmerceproject.ProductManagement.entity.Category;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.repository.CategoryRepository;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.ProductManagement.service.CategoryService;
import com.example.flowmerceproject.ProductManagement.service.ProductService;
import com.example.flowmerceproject.StoreMangement.dto.CatalogDTOs;
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
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository storeRepository;
    private final StoreSettingsRepository settingsRepository;
    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final CategoryService categoryService;
    private final ProductService productService;
    private final InventoryRepository inventoryRepository;
    private final ObjectMapper objectMapper;

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
                .status(Store.StoreStatus.DRAFT)
                .build();

        storeRepository.save(store);

        StoreSettings settings = StoreSettings.builder()
                .store(store)
                .currency("EGP")
                .timezone("Africa/Cairo")
                .language("ar")
                .build();
        settingsRepository.save(settings);
        store.setSettings(settings);

        return toResponse(store);
    }

    @Transactional(readOnly = true)
    public List<StoreDTOs.StoreResponse> getMyStores(String email) {
        Merchant merchant = getMerchantByEmail(email);
        return storeRepository.findByMerchantIdWithMerchant(merchant.getMerchantId())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public StoreDTOs.StoreResponse getStoreById(String email, Integer storeId) {
        return toResponse(getStoreAndVerifyOwner(email, storeId));
    }

    /** Public lookup — used to resolve the customer-facing storefront by slug. */
    @Transactional(readOnly = true)
    public StoreDTOs.StoreResponse getBySlug(String slug) {
        Store store = storeRepository.findByStoreUrl(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + slug));
        if (store.getStatus() == Store.StoreStatus.PAUSED) {
            throw new ForbiddenException("This store is currently paused and unavailable.");
        }
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse updateStore(String email, Integer storeId,
                                               StoreDTOs.UpdateStoreRequest request) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setStoreName(request.getStoreName());
        if (request.getDescription() != null) store.setDescription(request.getDescription());
        if (request.getLogo() != null) store.setLogo(request.getLogo());
        if (request.getStoreUrl() != null && !request.getStoreUrl().isBlank()) store.setStoreUrl(request.getStoreUrl());
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse publishStore(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setStatus(Store.StoreStatus.PUBLISHED);
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse unpublishStore(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setStatus(Store.StoreStatus.PAUSED);
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse updateBrand(String email, Integer storeId,
                                               StoreDTOs.BrandUpdateRequest request) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setStoreName(request.getBrandName());
        if (request.getLogoUrl() != null) store.setLogo(request.getLogoUrl());
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse updatePaymentMethods(String email, Integer storeId,
                                                        StoreDTOs.PaymentMethodsRequest request) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        try {
            store.setPaymentMethods(objectMapper.writeValueAsString(request.getMethods()));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new com.example.flowmerceproject.UserManagement.exception.BadRequestException(
                    "Invalid payment methods: " + e.getMessage());
        }
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public StoreDTOs.StoreResponse updateOnboardingStep(String email, Integer storeId,
                                                        StoreDTOs.OnboardingStepRequest request) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        store.setCurrentStep(request.getStep());
        storeRepository.save(store);
        return toResponse(store);
    }

    @Transactional
    public String deleteStore(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        storeRepository.delete(store);
        return "Store deleted successfully.";
    }

    @Transactional(readOnly = true)
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

    /**
     * Returns the payment methods enabled by the merchant for a store.
     * FLOWMERCE_WALLET is always included as the first entry (fixed simulation method).
     */
    @Transactional(readOnly = true)
    public List<String> getEnabledPaymentMethods(Integer storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + storeId));
        List<String> methods = new java.util.ArrayList<>(parsePaymentMethods(store.getPaymentMethods()));
        if (!methods.contains("FLOWMERCE_WALLET")) {
            methods.add(0, "FLOWMERCE_WALLET");
        }
        return methods;
    }

    private List<String> parsePaymentMethods(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse paymentMethods JSON: {}", e.getMessage());
            return List.of();
        }
    }

    @Transactional(readOnly = true)
    public List<StoreDTOs.StoreResponse> getAllStores() {
        return storeRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── PUBLIC CATALOG ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CatalogDTOs.CategoryResponse> getPublicCategories(Integer storeId) {
        // Collect the distinct category IDs actually used by this store's visible products.
        // This covers both global categories (store = null) and store-specific ones.
        List<Integer> usedCatIds = productRepository.findVisibleByStoreId(storeId).stream()
                .filter(p -> p.getCategory() != null)
                .map(p -> p.getCategory().getCategoryId())
                .distinct()
                .collect(Collectors.toList());

        if (usedCatIds.isEmpty()) return List.of();

        return StreamSupport.stream(categoryRepository.findAllById(usedCatIds).spliterator(), false)
                .map(c -> CatalogDTOs.CategoryResponse.builder()
                        .categoryId(c.getCategoryId())
                        .storeId(storeId)
                        .name(c.getName())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CatalogDTOs.ProductResponse> getPublicProducts(Integer storeId,
                                                                Integer categoryId) {
        List<Product> products = categoryId != null
                ? productRepository.findVisibleByStoreIdAndCategoryId(storeId, categoryId)
                : productRepository.findVisibleByStoreId(storeId);
        return products.stream().map(this::toProductResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CatalogDTOs.ProductResponse getPublicProduct(Integer storeId, Integer productId) {
        Product product = productRepository.findByProductIdAndStore_StoreId(productId, storeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + productId));
        return toProductResponse(product);
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

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
        // CON-12: brandName mirrors the store's own name — every storefront-facing
        // page (hero, header, footer, login/signup) treats brandName as "what the
        // customer sees", which is the store name, not the merchant's personal/OAuth
        // account name. merchant.getBusinessName() used to back this and was wrong:
        // it's set once at account creation (OAuth providers fill it with the
        // merchant's own profile name) and nothing can ever update it afterwards,
        // so a merchant's chosen store name was permanently shadowed.
        String brandName = store.getStoreName();
        // CON-6: enrich with merchant info for admin panel
        String merchantName = store.getMerchant() != null && store.getMerchant().getUser() != null
                ? store.getMerchant().getUser().getFullName()
                : null;
        String merchantEmail = store.getMerchant() != null && store.getMerchant().getUser() != null
                ? store.getMerchant().getUser().getEmail()
                : null;

        return StoreDTOs.StoreResponse.builder()
                .storeId(store.getStoreId())
                .merchantId(store.getMerchant().getMerchantId())
                .storeName(store.getStoreName())
                .storeUrl(store.getStoreUrl())
                .description(store.getDescription())
                .logo(store.getLogo())
                .brandName(brandName)
                .merchantName(merchantName)
                .merchantEmail(merchantEmail)
                .status(store.getStatus())
                .currentStep(store.getCurrentStep())
                .paymentMethods(store.getPaymentMethods())
                .createdAt(store.getCreatedAt())
                .build();
    }

    /** CON-7 / INT-3: populate images (from mediaList) and inventory (from Inventory table). */
    private CatalogDTOs.ProductResponse toProductResponse(Product p) {
        // Extract image URLs from the product's media list
        java.util.List<String> images = p.getMediaList() == null ? java.util.List.of()
                : p.getMediaList().stream()
                        .map(m -> m.getMediaUrl())
                        .collect(java.util.stream.Collectors.toList());

        // Fetch available stock (quantity − reserved) from Inventory table
        Integer availableQty = inventoryRepository.findByProductId(
                p.getProductId() != null ? p.getProductId() : 0)
                .map(inv -> Math.max(0, inv.getQuantity() - inv.getReservedQuantity()))
                .orElse(0);

        return CatalogDTOs.ProductResponse.builder()
                .productId(p.getProductId() != null ? p.getProductId().longValue() : null)
                .storeId(p.getStore() != null ? p.getStore().getStoreId() : null)
                .categoryId(p.getCategory() != null ? p.getCategory().getCategoryId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .name(p.getName())
                .description(p.getDescription())
                .price(p.getBasePrice())
                .inventory(availableQty)
                .rating(p.getRating() != null ? p.getRating().floatValue() : null)
                .images(images)
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
