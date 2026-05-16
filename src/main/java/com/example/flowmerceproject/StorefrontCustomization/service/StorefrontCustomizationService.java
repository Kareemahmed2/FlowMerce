package com.example.flowmerceproject.StorefrontCustomization.service;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.*;
import com.example.flowmerceproject.StorefrontCustomization.entity.*;
import com.example.flowmerceproject.StorefrontCustomization.repository.*;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StorefrontCustomizationService {

    private final StorefrontTemplateRepository templateRepository;
    private final ThemeTemplateRepository themeRepository;
    private final PageRepository pageRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final StorefrontWriteBehindService writeBehindService;

    @Value("${storefront.cache.ttl-seconds:3600}")
    private long cacheTtlSeconds;

    /** Cache key prefix — full key: storefront:public:{storeUrl} */
    private static final String CACHE_PREFIX = "storefront:public:";

    // ══════════════════════════════════════════════════════════════════════════
    // CREATE
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Initialises a StorefrontTemplate (+ default ThemeTemplate + HOME page) for
     * the first time. Idempotent — returns the existing record if already set up.
     *
     * Validates merchant ownership of the store before creating anything.
     */
    @Transactional
    public StorefrontTemplateResponse createStorefront(String email, Integer storeId,
                                                       CreateStorefrontRequest req) {
        Store store = getStoreAndVerifyOwner(email, storeId);

        if (templateRepository.existsByStore_StoreId(storeId)) {
            return toResponse(requireTemplate(storeId));
        }

        ThemeTemplate theme = ThemeTemplate.builder()
                .background(req.getBackground() != null ? req.getBackground() : "#FFFFFF")
                .header    (req.getHeader()     != null ? req.getHeader()     : "#1A1A2E")
                .footer    (req.getFooter()     != null ? req.getFooter()     : "#16213E")
                .accent    (req.getAccent()     != null ? req.getAccent()     : "#E94560")
                .text      (req.getText()       != null ? req.getText()       : "#1A1A1A")
                .card      (req.getCard()       != null ? req.getCard()       : "#F9F9F9")
                .build();

        StorefrontTemplate template = StorefrontTemplate.builder()
                .store(store)
                .theme(theme)
                .status(StorefrontTemplate.StorefrontStatus.DRAFT)
                .version(1)
                .build();
        templateRepository.save(template);

        Page homePage = Page.builder()
                .storefrontTemplate(template)
                .title("Home")
                .slug("home")
                .pageType(Page.PageType.HOME)
                .isPublished(true)
                .showInNav(false)
                .navOrder(0)
                .build();
        pageRepository.save(homePage);
        template.getPages().add(homePage);

        return toResponse(template);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // READ — merchant-facing (no cache required for dashboard)
    // ══════════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public StorefrontTemplateResponse getStorefront(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        return toResponse(requireTemplate(storeId));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // READ — customer-facing  (cache-aside: check Redis → DB fallback → cache)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Returns the published storefront for a store URL.
     * Follows a cache-aside strategy:
     *   1. Check Redis — return immediately on hit.
     *   2. On miss: load from DB, populate the cache, then return.
     *
     * Cache key: {@code storefront:public:{storeUrl}}
     * TTL: configured via {@code storefront.cache.ttl-seconds} (default 3600 s).
     */
    @Transactional(readOnly = true)
    public StorefrontTemplateResponse getPublicStorefront(String storeUrl) {
        String cacheKey = CACHE_PREFIX + storeUrl;

        Optional<StorefrontTemplateResponse> cached = getFromCache(cacheKey);
        if (cached.isPresent()) {
            return cached.get();
        }

        StorefrontTemplate template = templateRepository.findPublishedByStoreUrl(storeUrl)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No published storefront found for: " + storeUrl));

        StorefrontTemplateResponse response = toResponse(template);
        putInCache(cacheKey, response);
        return response;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // UPDATE — merchant-facing theme colours  (write-behind / write-back)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Updates the StorefrontTemplate's theme colours using a write-behind strategy:
     *   1. Verify merchant ownership.
     *   2. Load the current state into Redis if not already cached.
     *   3. Apply the colour changes to the cached response.
     *   4. Write the updated response to Redis immediately — the merchant gets 200 here.
     *   5. Dispatch an async task to persist the changes to PostgreSQL in the background.
     *
     * The merchant is never blocked waiting for the DB write.
     *
     * Matches spec §3.1 {@code PUT /stores/:id/colors} and §3.3 colour schema.
     */
    @Transactional(readOnly = true)
    public ThemeResponse updateTheme(String email, Integer storeId, UpdateThemeRequest req) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);

        String cacheKey = CACHE_PREFIX + store.getStoreUrl();

        // ── 1. Warm the cache if needed ───────────────────────────────────────
        StorefrontTemplateResponse cached = getFromCache(cacheKey)
                .orElseGet(() -> toResponse(template));

        // ── 2. Apply colour changes in-memory ─────────────────────────────────
        ThemeResponse currentTheme = cached.getTheme();
        ThemeResponse updatedTheme = ThemeResponse.builder()
                .themeId    (currentTheme.getThemeId())
                .background (req.getBackground() != null ? req.getBackground() : currentTheme.getBackground())
                .header     (req.getHeader()     != null ? req.getHeader()     : currentTheme.getHeader())
                .footer     (req.getFooter()     != null ? req.getFooter()     : currentTheme.getFooter())
                .accent     (req.getAccent()     != null ? req.getAccent()     : currentTheme.getAccent())
                .text       (req.getText()       != null ? req.getText()       : currentTheme.getText())
                .card       (req.getCard()       != null ? req.getCard()       : currentTheme.getCard())
                .updatedAt  (LocalDateTime.now())
                .build();

        cached.setTheme(updatedTheme);

        // ── 3. Write to Redis immediately (merchant sees 200 after this) ──────
        putInCache(cacheKey, cached);

        // ── 4. Async write-behind to PostgreSQL ───────────────────────────────
        writeBehindService.persistThemeUpdate(currentTheme.getThemeId(), req);

        return updatedTheme;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PUBLISH / UNPUBLISH
    // ══════════════════════════════════════════════════════════════════════════

    @Transactional
    public StorefrontTemplateResponse publishStorefront(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);

        template.setStatus(StorefrontTemplate.StorefrontStatus.PUBLISHED);
        template.setPublishedAt(LocalDateTime.now());
        template.setVersion(template.getVersion() + 1);
        templateRepository.save(template);

        StorefrontTemplateResponse response = toResponse(template);

        // Refresh cache with the newly published state
        putInCache(CACHE_PREFIX + store.getStoreUrl(), response);

        return response;
    }

    @Transactional
    public StorefrontTemplateResponse unpublishStorefront(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);

        template.setStatus(StorefrontTemplate.StorefrontStatus.PAUSED);
        templateRepository.save(template);

        // Remove from public cache so the store URL returns 404
        redisTemplate.delete(CACHE_PREFIX + store.getStoreUrl());

        return toResponse(template);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS — Redis
    // ══════════════════════════════════════════════════════════════════════════

    private Optional<StorefrontTemplateResponse> getFromCache(String key) {
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(json, StorefrontTemplateResponse.class));
        } catch (JsonProcessingException e) {
            log.warn("Cache deserialisation failed for key '{}': {}", key, e.getMessage());
            return Optional.empty();
        }
    }

    private void putInCache(String key, StorefrontTemplateResponse response) {
        try {
            String json = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().set(key, json, Duration.ofSeconds(cacheTtlSeconds));
        } catch (JsonProcessingException e) {
            log.warn("Cache serialisation failed for key '{}': {}", key, e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS — auth & guard
    // ══════════════════════════════════════════════════════════════════════════

    private Store getStoreAndVerifyOwner(String email, Integer storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + storeId));

        Merchant merchant = getMerchantByEmail(email);

        if (!store.getMerchant().getMerchantId().equals(merchant.getMerchantId())) {
            throw new ForbiddenException("You do not own this store.");
        }
        return store;
    }

    private Merchant getMerchantByEmail(String email) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + email));
        return merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Merchant profile not found for user: " + email));
    }

    private StorefrontTemplate requireTemplate(Integer storeId) {
        return templateRepository.findWithThemeByStoreId(storeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Storefront not initialised for store " + storeId +
                        ". Call POST /api/stores/" + storeId + "/storefront/init first."));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS — entity → DTO mappers
    // ══════════════════════════════════════════════════════════════════════════

    private StorefrontTemplateResponse toResponse(StorefrontTemplate t) {
        List<PageSummary> pages = pageRepository
                .findByStorefrontTemplate_TemplateIdOrderByNavOrderAsc(t.getTemplateId())
                .stream()
                .map(this::toPageSummary)
                .collect(Collectors.toList());

        return StorefrontTemplateResponse.builder()
                .templateId  (t.getTemplateId())
                .storeId     (t.getStore().getStoreId())
                .storeName   (t.getStore().getStoreName())
                .storeUrl    (t.getStore().getStoreUrl())
                .status      (t.getStatus().name())
                .version     (t.getVersion())
                .publishedAt (t.getPublishedAt())
                .theme       (t.getTheme() != null ? toThemeResponse(t.getTheme()) : null)
                .pages       (pages)
                .createdAt   (t.getCreatedAt())
                .updatedAt   (t.getUpdatedAt())
                .build();
    }

    private ThemeResponse toThemeResponse(ThemeTemplate theme) {
        return ThemeResponse.builder()
                .themeId    (theme.getThemeId())
                .background (theme.getBackground())
                .header     (theme.getHeader())
                .footer     (theme.getFooter())
                .accent     (theme.getAccent())
                .text       (theme.getText())
                .card       (theme.getCard())
                .updatedAt  (theme.getUpdatedAt())
                .build();
    }

    private PageSummary toPageSummary(Page p) {
        return PageSummary.builder()
                .pageId     (p.getPageId())
                .title      (p.getTitle())
                .slug       (p.getSlug())
                .pageType   (p.getPageType().name())
                .isPublished(p.getIsPublished())
                .showInNav  (p.getShowInNav())
                .navOrder   (p.getNavOrder())
                .build();
    }
}
