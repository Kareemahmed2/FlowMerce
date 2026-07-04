package com.example.flowmerceproject.StorefrontCustomization.service;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs;
import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.*;
import com.example.flowmerceproject.StorefrontCustomization.entity.*;
import com.example.flowmerceproject.StorefrontCustomization.entity.ComponentDecorator;
import com.example.flowmerceproject.StorefrontCustomization.entity.StorefrontMedia;
import com.example.flowmerceproject.StorefrontCustomization.repository.*;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
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
    private final BaseComponentRepository componentRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final StorefrontWriteBehindService writeBehindService;
    private final MediaRepository mediaRepository;
    private final ComponentDecoratorRepository decoratorRepository;

    @Value("${storefront.cache.ttl-minutes:30}")
    private long ttlMinutes;

    private static final String CACHE_KEY_PREFIX        = "flowmerce:sf:";
    private static final String DESIGN_CACHE_KEY_PREFIX = "flowmerce:sf:design:";
    private static final String OWNER_CACHE_KEY_PREFIX  = "flowmerce:own:";
    private static final Duration OWNER_CACHE_TTL       = Duration.ofSeconds(60);

    // ── INIT ──────────────────────────────────────────────────────────────────

    @Transactional
    public StorefrontTemplateResponse createStorefront(String email, Integer storeId,
                                                       CreateStorefrontRequest req) {
        Store store = getStoreAndVerifyOwner(email, storeId);

        if (templateRepository.existsByStore_StoreId(storeId)) {
            return toResponse(requireTemplate(storeId));
        }

        ThemeTemplate theme = ThemeTemplate.builder()
                .background(req.getBackground() != null ? req.getBackground() : "#FFFFFF")
                .header(req.getHeader()         != null ? req.getHeader()     : "#1A1A2E")
                .footer(req.getFooter()         != null ? req.getFooter()     : "#16213E")
                .accent(req.getAccent()         != null ? req.getAccent()     : "#E94560")
                .text(req.getText()             != null ? req.getText()       : "#1A1A1A")
                .card(req.getCard()             != null ? req.getCard()       : "#F9F9F9")
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

    // ── GET (merchant dashboard) ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StorefrontTemplateResponse getStorefront(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        return toResponse(requireTemplate(storeId));
    }

    // ── PUBLIC (cache-aside) ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StorefrontTemplateResponse getPublicStorefront(Integer storeId) {
        String cacheKey = CACHE_KEY_PREFIX + storeId;
        Optional<StorefrontTemplateResponse> cached = getFromCache(cacheKey);
        if (cached.isPresent()) return cached.get();

        StorefrontTemplate template = templateRepository.findPublishedByStoreId(storeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No published storefront found for store: " + storeId));

        StorefrontTemplateResponse response = toResponseWithComponents(template);
        putInCache(cacheKey, response);
        return response;
    }

    // ── THEME (DESIGN) ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DesignResponse getDesign(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        String cacheKey = DESIGN_CACHE_KEY_PREFIX + storeId;
        Optional<DesignResponse> cached = getDesignFromCache(cacheKey);
        if (cached.isPresent()) return cached.get();

        StorefrontTemplate template = requireTemplate(storeId);
        ThemeTemplate theme = template.getTheme();
        if (theme == null) return DesignResponse.builder().build();
        DesignResponse response = toDesignResponse(theme);
        putDesignInCache(cacheKey, response);
        return response;
    }

    @Transactional
    public DesignResponse saveDesign(String email, Integer storeId, JsonNode data) {
        // FAST PATH: ownership + design both cached → zero DB queries.
        // Only valid for existing themes (themeId must be non-null in the design cache).
        if (isOwnershipCached(email, storeId)) {
            String designKey = DESIGN_CACHE_KEY_PREFIX + storeId;
            Optional<DesignResponse> cachedDesign = getDesignFromCache(designKey);
            if (cachedDesign.isPresent() && cachedDesign.get().getThemeId() != null) {
                DesignResponse response = mergeDesignResponse(cachedDesign.get(), data);
                putDesignInCache(designKey, response);
                evictCache(storeId);
                writeBehindService.persistThemeUpdate(cachedDesign.get().getThemeId(), buildUpdateThemeRequest(data));
                return response;
            }
        }

        // SLOW PATH: cache miss → full DB verification.
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        ThemeTemplate theme = template.getTheme();

        DesignResponse response;

        if (theme == null) {
            // First-time theme creation: must persist synchronously to establish the record.
            ThemeTemplate newTheme = ThemeTemplate.builder()
                    .background(textOf(data, "background"))
                    .header(textOf(data, "header"))
                    .footer(textOf(data, "footer"))
                    .accent(textOf(data, "accent"))
                    .text(textOf(data, "text"))
                    .card(textOf(data, "card"))
                    .build();
            template.setTheme(newTheme);
            themeRepository.save(newTheme);
            response = toDesignResponse(newTheme);
        } else {
            // Existing theme: build merged response in-memory without touching the entity
            // so Hibernate dirty-check sees no changes and flushes nothing.
            response = mergeDesignResponse(toDesignResponse(theme), data);
            writeBehindService.persistThemeUpdate(theme.getThemeId(), buildUpdateThemeRequest(data));
        }

        putDesignInCache(DESIGN_CACHE_KEY_PREFIX + storeId, response);
        evictCache(store.getStoreId());
        return response;
    }

    @Transactional
    public ThemeResponse updateTheme(String email, Integer storeId, UpdateThemeRequest req) {
        // FAST PATH: ownership + design both cached → zero DB queries.
        if (isOwnershipCached(email, storeId)) {
            String designKey = DESIGN_CACHE_KEY_PREFIX + storeId;
            Optional<DesignResponse> cachedDesign = getDesignFromCache(designKey);
            if (cachedDesign.isPresent() && cachedDesign.get().getThemeId() != null) {
                DesignResponse existing = cachedDesign.get();
                String background = req.getBackground() != null ? req.getBackground() : existing.getBackground();
                String header     = req.getHeader()     != null ? req.getHeader()     : existing.getHeader();
                String footer     = req.getFooter()     != null ? req.getFooter()     : existing.getFooter();
                String accent     = req.getAccent()     != null ? req.getAccent()     : existing.getAccent();
                String text       = req.getText()       != null ? req.getText()       : existing.getText();
                String card       = req.getCard()       != null ? req.getCard()       : existing.getCard();
                LocalDateTime now = LocalDateTime.now();
                putDesignInCache(designKey, DesignResponse.builder()
                        .themeId(existing.getThemeId())
                        .background(background).header(header).footer(footer)
                        .accent(accent).text(text).card(card).updatedAt(now).build());
                evictCache(storeId);
                writeBehindService.persistThemeUpdate(existing.getThemeId(), req);
                return ThemeResponse.builder()
                        .themeId(existing.getThemeId())
                        .background(background).header(header).footer(footer)
                        .accent(accent).text(text).card(card).updatedAt(now).build();
            }
        }

        // SLOW PATH: cache miss → full DB verification.
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        ThemeTemplate theme = template.getTheme();
        if (theme == null) {
            throw new ResourceNotFoundException(
                    "No theme configured for this storefront. Call saveDesign first.");
        }

        String background = req.getBackground() != null ? req.getBackground() : theme.getBackground();
        String header     = req.getHeader()     != null ? req.getHeader()     : theme.getHeader();
        String footer     = req.getFooter()     != null ? req.getFooter()     : theme.getFooter();
        String accent     = req.getAccent()     != null ? req.getAccent()     : theme.getAccent();
        String text       = req.getText()       != null ? req.getText()       : theme.getText();
        String card       = req.getCard()       != null ? req.getCard()       : theme.getCard();
        LocalDateTime now = LocalDateTime.now();

        putDesignInCache(DESIGN_CACHE_KEY_PREFIX + store.getStoreId(), DesignResponse.builder()
                .themeId(theme.getThemeId())
                .background(background).header(header).footer(footer)
                .accent(accent).text(text).card(card).updatedAt(now).build());
        evictCache(store.getStoreId());
        writeBehindService.persistThemeUpdate(theme.getThemeId(), req);

        return ThemeResponse.builder()
                .themeId(theme.getThemeId())
                .background(background).header(header).footer(footer)
                .accent(accent).text(text).card(card).updatedAt(now).build();
    }

    // ── PUBLISH / UNPUBLISH ───────────────────────────────────────────────────

    @Transactional
    public StorefrontTemplateResponse publishStorefront(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        template.setStatus(StorefrontTemplate.StorefrontStatus.PUBLISHED);
        template.setPublishedAt(LocalDateTime.now());
        template.setVersion(template.getVersion() + 1);
        templateRepository.save(template);
        StorefrontTemplateResponse response = toResponseWithComponents(template);
        putInCache(CACHE_KEY_PREFIX + store.getStoreId(), response);
        return response;
    }

    @Transactional
    public StorefrontTemplateResponse unpublishStorefront(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        template.setStatus(StorefrontTemplate.StorefrontStatus.PAUSED);
        templateRepository.save(template);
        evictCache(store.getStoreId());
        return toResponse(template);
    }

    // ── PAGES ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PageSummary> listPages(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        return pageRepository
                .findByStorefrontTemplate_TemplateIdOrderByNavOrderAsc(template.getTemplateId())
                .stream().map(this::toPageSummary).collect(Collectors.toList());
    }

    @Transactional
    public PageResponse createPage(String email, Integer storeId, JsonNode data) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);

        String slug = textOf(data, "slug");
        if (slug == null || slug.isBlank()) throw new BadRequestException("data.slug is required");

        if (pageRepository.existsByStorefrontTemplate_TemplateIdAndSlug(
                template.getTemplateId(), slug)) {
            throw new BadRequestException("A page with slug '" + slug + "' already exists");
        }

        int navOrder = data.has("navOrder")
                ? data.get("navOrder").asInt()
                : pageRepository.countByStorefrontTemplate_TemplateId(template.getTemplateId());

        Page.PageType pageType = Page.PageType.CUSTOM;
        if (data.has("pageType")) {
            try { pageType = Page.PageType.valueOf(data.get("pageType").asText().toUpperCase()); }
            catch (IllegalArgumentException ignored) { }
        }

        Page page = Page.builder()
                .storefrontTemplate(template)
                .title(data.has("title") ? data.get("title").asText() : slug)
                .slug(slug)
                .pageType(pageType)
                .isPublished(data.has("isPublished") && data.get("isPublished").asBoolean())
                .showInNav(!data.has("showInNav") || data.get("showInNav").asBoolean())
                .navOrder(navOrder)
                .metaDescription(textOf(data, "metaDescription"))
                .build();
        pageRepository.save(page);
        evictCache(store.getStoreId());
        return toPageResponse(page);
    }

    @Transactional(readOnly = true)
    public PageResponse getPage(String email, Integer storeId, Long pageId) {
        getStoreAndVerifyOwner(email, storeId);
        return toPageResponse(requirePage(pageId));
    }

    @Transactional
    public PageResponse updatePage(String email, Integer storeId, Long pageId, JsonNode data) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        Page page = requirePage(pageId);

        if (data.has("title"))           page.setTitle(data.get("title").asText());
        if (data.has("navOrder"))        page.setNavOrder(data.get("navOrder").asInt());
        if (data.has("isPublished"))     page.setIsPublished(data.get("isPublished").asBoolean());
        if (data.has("showInNav"))       page.setShowInNav(data.get("showInNav").asBoolean());
        if (data.has("metaDescription")) page.setMetaDescription(data.get("metaDescription").asText());

        pageRepository.save(page);
        evictCache(store.getStoreId());
        return toPageResponse(page);
    }

    @Transactional
    public void deletePage(String email, Integer storeId, Long pageId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        Page page = requirePage(pageId);

        if ("home".equals(page.getSlug())) {
            throw new ForbiddenException("The HOME page cannot be deleted.");
        }

        pageRepository.delete(page);
        evictCache(store.getStoreId());
    }

    // ── COMPONENTS ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ComponentResponse> listComponents(String email, Integer storeId, Long pageId) {
        getStoreAndVerifyOwner(email, storeId);
        return componentRepository.findByPage_PageIdOrderBySortOrderAsc(pageId)
                .stream().map(this::toComponentResponse).collect(Collectors.toList());
    }

    @Transactional
    public ComponentResponse addComponent(String email, Integer storeId, Long pageId, JsonNode data) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        Page page = requirePage(pageId);

        BaseComponent.ComponentType compType = BaseComponent.ComponentType.CUSTOM_HTML;
        if (data.has("componentType")) {
            try { compType = BaseComponent.ComponentType.valueOf(
                    data.get("componentType").asText().toUpperCase()); }
            catch (IllegalArgumentException ignored) { }
        }

        int sortOrder = data.has("sortOrder")
                ? data.get("sortOrder").asInt()
                : componentRepository.nextSortOrderForPage(pageId);

        String content = null;
        if (data.has("content")) content = data.get("content").toString();

        BaseComponent component = BaseComponent.builder()
                .store(page.getStorefrontTemplate().getStore())
                .page(page)
                .componentType(compType)
                .name(data.has("name") ? data.get("name").asText() : compType.name())
                .content(content)
                .sortOrder(sortOrder)
                .isVisible(!data.has("isVisible") || data.get("isVisible").asBoolean())
                .build();
        componentRepository.save(component);
        evictCache(store.getStoreId());
        return toComponentResponse(component);
    }

    @Transactional
    public ComponentResponse updateComponent(String email, Integer storeId, Long pageId,
                                             Long componentId, JsonNode data) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        BaseComponent component = requireComponent(componentId);

        if (data.has("name"))      component.setName(data.get("name").asText());
        if (data.has("sortOrder")) component.setSortOrder(data.get("sortOrder").asInt());
        if (data.has("isVisible")) component.setIsVisible(data.get("isVisible").asBoolean());
        if (data.has("content"))   component.setContent(data.get("content").toString());

        componentRepository.save(component);
        evictCache(store.getStoreId());
        return toComponentResponse(component);
    }

    @Transactional
    public void deleteComponent(String email, Integer storeId, Long pageId, Long componentId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        BaseComponent component = requireComponent(componentId);
        componentRepository.delete(component);
        evictCache(store.getStoreId());
    }

    @Transactional
    public List<ComponentResponse> reorderComponents(String email, Integer storeId,
                                                     Long pageId, JsonNode data) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        if (data.isArray()) {
            for (JsonNode item : data) {
                if (!item.has("componentId") || !item.has("sortOrder")) continue;
                Long compId = item.get("componentId").asLong();
                int sortOrder = item.get("sortOrder").asInt();
                componentRepository.findById(compId).ifPresent(c -> {
                    c.setSortOrder(sortOrder);
                    componentRepository.save(c);
                });
            }
        }
        evictCache(store.getStoreId());
        return componentRepository.findByPage_PageIdOrderBySortOrderAsc(pageId)
                .stream().map(this::toComponentResponse).collect(Collectors.toList());
    }

    // ── DECORATORS ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DecoratorResponse> listDecorators(String email, Integer storeId,
                                                  Long componentId) {
        getStoreAndVerifyOwner(email, storeId);
        return decoratorRepository
                .findByComponent_ComponentIdOrderByPriorityAsc(componentId)
                .stream().map(this::toDecoratorResponse).collect(Collectors.toList());
    }

    @Transactional
    public DecoratorResponse addDecorator(String email, Integer storeId,
                                          Long componentId, JsonNode data) {
        getStoreAndVerifyOwner(email, storeId);
        BaseComponent component = requireComponent(componentId);
        int priority = data.has("priority") ? data.get("priority").asInt() : 0;
        String dataStr = data.has("data") ? data.get("data").toString() : "{}";
        ComponentDecorator decorator = ComponentDecorator.builder()
                .component(component)
                .priority(priority)
                .data(dataStr)
                .build();
        evictCache(storeId);
        return toDecoratorResponse(decoratorRepository.save(decorator));
    }

    @Transactional
    public DecoratorResponse updateDecorator(String email, Integer storeId,
                                             Long componentId, Long decoratorId,
                                             JsonNode data) {
        getStoreAndVerifyOwner(email, storeId);
        ComponentDecorator decorator = decoratorRepository.findById(decoratorId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Decorator not found: " + decoratorId));
        if (data.has("priority")) decorator.setPriority(data.get("priority").asInt());
        if (data.has("data"))     decorator.setData(data.get("data").toString());
        evictCache(storeId);
        return toDecoratorResponse(decoratorRepository.save(decorator));
    }

    @Transactional
    public void deleteDecorator(String email, Integer storeId,
                                Long componentId, Long decoratorId) {
        getStoreAndVerifyOwner(email, storeId);
        decoratorRepository.findById(decoratorId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Decorator not found: " + decoratorId));
        decoratorRepository.deleteById(decoratorId);
        evictCache(storeId);
    }

    // ── MEDIA ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<StorefrontDTOs.MediaResponse> listMedia(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        return mediaRepository.findByStore_StoreIdOrderByUploadedAtDesc(storeId)
                .stream().map(this::toMediaResponse).collect(Collectors.toList());
    }

    @Transactional
    public StorefrontDTOs.MediaResponse saveMedia(String email, Integer storeId, JsonNode data) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        String url = textOf(data, "url");
        if (url == null || url.isBlank()) throw new BadRequestException("url is required");
        StorefrontMedia media = StorefrontMedia.builder()
                .store(store)
                .url(url)
                .name(textOf(data, "name"))
                .mediaType(data.has("mediaType") ? data.get("mediaType").asText() : "IMAGE")
                .build();
        return toMediaResponse(mediaRepository.save(media));
    }

    @Transactional
    public void deleteMedia(String email, Integer storeId, Long mediaId) {
        getStoreAndVerifyOwner(email, storeId);
        StorefrontMedia media = mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media not found: " + mediaId));
        mediaRepository.delete(media);
    }

    // ── REDIS HELPERS ─────────────────────────────────────────────────────────

    private Optional<StorefrontTemplateResponse> getFromCache(String key) {
        try {
            String json = redisTemplate.opsForValue().get(key);
            if (json == null) return Optional.empty();
            return Optional.of(objectMapper.readValue(json, StorefrontTemplateResponse.class));
        } catch (Exception e) {
            log.warn("Cache get failed for key '{}': {}", key, e.getMessage());
            return Optional.empty();
        }
    }

    private void putInCache(String key, StorefrontTemplateResponse response) {
        try {
            String json = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().set(key, json, Duration.ofMinutes(ttlMinutes));
        } catch (Exception e) {
            log.warn("Cache put failed for key '{}': {}", key, e.getMessage());
        }
    }

    private void evictCache(Integer storeId) {
        try {
            redisTemplate.delete(CACHE_KEY_PREFIX + storeId);
        } catch (Exception e) {
            log.warn("Cache evict failed for store {}: {}", storeId, e.getMessage());
        }
    }

    /**
     * Evicts every Redis entry tied to a store — storefront, design, and the
     * requesting owner's ownership-check cache. Called from store hard-delete
     * so no phantom storefront is served for the remaining TTL.
     */
    public void evictAllCacheForStore(Integer storeId, String ownerEmail) {
        evictCache(storeId);
        try {
            redisTemplate.delete(DESIGN_CACHE_KEY_PREFIX + storeId);
        } catch (Exception e) {
            log.warn("Design cache evict failed for store {}: {}", storeId, e.getMessage());
        }
        if (ownerEmail != null) {
            try {
                redisTemplate.delete(OWNER_CACHE_KEY_PREFIX + storeId + ":" + ownerEmail);
            } catch (Exception e) {
                log.warn("Owner cache evict failed for store {}: {}", storeId, e.getMessage());
            }
        }
    }

    private Optional<DesignResponse> getDesignFromCache(String key) {
        try {
            String json = redisTemplate.opsForValue().get(key);
            if (json == null) return Optional.empty();
            return Optional.of(objectMapper.readValue(json, DesignResponse.class));
        } catch (Exception e) {
            log.warn("Design cache get failed for key '{}': {}", key, e.getMessage());
            return Optional.empty();
        }
    }

    private void putDesignInCache(String key, DesignResponse response) {
        try {
            String json = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().set(key, json, Duration.ofMinutes(ttlMinutes));
        } catch (Exception e) {
            log.warn("Design cache put failed for key '{}': {}", key, e.getMessage());
        }
    }

    private boolean isOwnershipCached(String email, Integer storeId) {
        try {
            return redisTemplate.opsForValue().get(OWNER_CACHE_KEY_PREFIX + storeId + ":" + email) != null;
        } catch (Exception e) {
            log.warn("Owner cache check failed for store {}: {}", storeId, e.getMessage());
            return false;
        }
    }

    private DesignResponse mergeDesignResponse(DesignResponse existing, JsonNode data) {
        return DesignResponse.builder()
                .themeId(existing.getThemeId())
                .background(data.has("background") ? data.get("background").asText() : existing.getBackground())
                .header    (data.has("header")      ? data.get("header").asText()     : existing.getHeader())
                .footer    (data.has("footer")      ? data.get("footer").asText()     : existing.getFooter())
                .accent    (data.has("accent")      ? data.get("accent").asText()     : existing.getAccent())
                .text      (data.has("text")        ? data.get("text").asText()       : existing.getText())
                .card      (data.has("card")        ? data.get("card").asText()       : existing.getCard())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private UpdateThemeRequest buildUpdateThemeRequest(JsonNode data) {
        UpdateThemeRequest req = new UpdateThemeRequest();
        if (data.has("background")) req.setBackground(data.get("background").asText());
        if (data.has("header"))     req.setHeader(data.get("header").asText());
        if (data.has("footer"))     req.setFooter(data.get("footer").asText());
        if (data.has("accent"))     req.setAccent(data.get("accent").asText());
        if (data.has("text"))       req.setText(data.get("text").asText());
        if (data.has("card"))       req.setCard(data.get("card").asText());
        return req;
    }

    // ── AUTH & GUARD HELPERS ──────────────────────────────────────────────────

    private Store getStoreAndVerifyOwner(String email, Integer storeId) {
        // Cache key encodes both dimensions so different merchants can't cross-validate.
        String ownerKey = OWNER_CACHE_KEY_PREFIX + storeId + ":" + email;

        String cachedMerchantId = null;
        try {
            cachedMerchantId = redisTemplate.opsForValue().get(ownerKey);
        } catch (Exception e) {
            log.warn("Owner cache get failed for store {}: {}", storeId, e.getMessage());
        }

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + storeId));

        if (cachedMerchantId != null) {
            // Ownership already verified — skip the 2 user/merchant DB round-trips.
            return store;
        }

        // Cache miss: verify ownership against DB, then cache the result.
        Merchant merchant = getMerchantByEmail(email);
        if (!store.getMerchant().getMerchantId().equals(merchant.getMerchantId())) {
            throw new ForbiddenException("You do not own this store.");
        }
        try {
            redisTemplate.opsForValue().set(
                    ownerKey, merchant.getMerchantId().toString(), OWNER_CACHE_TTL);
        } catch (Exception e) {
            log.warn("Owner cache put failed for store {}: {}", storeId, e.getMessage());
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
                        ". Call POST /stores/" + storeId + "/storefront/init first."));
    }

    private Page requirePage(Long pageId) {
        return pageRepository.findById(pageId)
                .orElseThrow(() -> new ResourceNotFoundException("Page not found: " + pageId));
    }

    private BaseComponent requireComponent(Long componentId) {
        return componentRepository.findById(componentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Component not found: " + componentId));
    }

    // ── MAPPERS ───────────────────────────────────────────────────────────────

    private StorefrontTemplateResponse toResponse(StorefrontTemplate t) {
        List<PageSummary> pages = pageRepository
                .findByStorefrontTemplate_TemplateIdOrderByNavOrderAsc(t.getTemplateId())
                .stream().map(this::toPageSummary).collect(Collectors.toList());
        return StorefrontTemplateResponse.builder()
                .templateId(t.getTemplateId())
                .storeId(t.getStore().getStoreId())
                .storeName(t.getStore().getStoreName())
                .storeUrl(t.getStore().getStoreUrl())
                .status(t.getStatus().name())
                .version(t.getVersion())
                .publishedAt(t.getPublishedAt())
                .theme(t.getTheme() != null ? toThemeResponse(t.getTheme()) : null)
                .pages(pages)
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private StorefrontTemplateResponse toResponseWithComponents(StorefrontTemplate t) {
        List<PageSummary> pages = pageRepository
                .findByStorefrontTemplate_TemplateIdOrderByNavOrderAsc(t.getTemplateId())
                .stream().map(p -> {
                    List<ComponentResponse> components = componentRepository
                            .findByPage_PageIdOrderBySortOrderAsc(p.getPageId())
                            .stream().map(this::toComponentResponse).collect(Collectors.toList());
                    return PageSummary.builder()
                            .pageId(p.getPageId())
                            .title(p.getTitle())
                            .slug(p.getSlug())
                            .pageType(p.getPageType().name())
                            .isPublished(p.getIsPublished())
                            .showInNav(p.getShowInNav())
                            .navOrder(p.getNavOrder())
                            .components(components)
                            .build();
                }).collect(Collectors.toList());
        return StorefrontTemplateResponse.builder()
                .templateId(t.getTemplateId())
                .storeId(t.getStore().getStoreId())
                .storeName(t.getStore().getStoreName())
                .storeUrl(t.getStore().getStoreUrl())
                .status(t.getStatus().name())
                .version(t.getVersion())
                .publishedAt(t.getPublishedAt())
                .theme(t.getTheme() != null ? toThemeResponse(t.getTheme()) : null)
                .pages(pages)
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private ThemeResponse toThemeResponse(ThemeTemplate theme) {
        return ThemeResponse.builder()
                .themeId(theme.getThemeId())
                .background(theme.getBackground())
                .header(theme.getHeader())
                .footer(theme.getFooter())
                .accent(theme.getAccent())
                .text(theme.getText())
                .card(theme.getCard())
                .updatedAt(theme.getUpdatedAt())
                .build();
    }

    private DesignResponse toDesignResponse(ThemeTemplate theme) {
        return DesignResponse.builder()
                .themeId(theme.getThemeId())
                .background(theme.getBackground())
                .header(theme.getHeader())
                .footer(theme.getFooter())
                .accent(theme.getAccent())
                .text(theme.getText())
                .card(theme.getCard())
                .updatedAt(theme.getUpdatedAt())
                .build();
    }

    private PageSummary toPageSummary(Page p) {
        return PageSummary.builder()
                .pageId(p.getPageId())
                .title(p.getTitle())
                .slug(p.getSlug())
                .pageType(p.getPageType().name())
                .isPublished(p.getIsPublished())
                .showInNav(p.getShowInNav())
                .navOrder(p.getNavOrder())
                .build();
    }

    private PageResponse toPageResponse(Page p) {
        List<ComponentResponse> components = componentRepository
                .findByPage_PageIdOrderBySortOrderAsc(p.getPageId())
                .stream().map(this::toComponentResponse).collect(Collectors.toList());
        return PageResponse.builder()
                .pageId(p.getPageId())
                .title(p.getTitle())
                .slug(p.getSlug())
                .pageType(p.getPageType().name())
                .isPublished(p.getIsPublished())
                .showInNav(p.getShowInNav())
                .navOrder(p.getNavOrder())
                .metaDescription(p.getMetaDescription())
                .components(components)
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }

    private ComponentResponse toComponentResponse(BaseComponent c) {
        List<DecoratorResponse> decorators = decoratorRepository
                .findByComponent_ComponentIdOrderByPriorityAsc(c.getComponentId())
                .stream().map(this::toDecoratorResponse).collect(Collectors.toList());
        return ComponentResponse.builder()
                .componentId(c.getComponentId())
                .componentType(c.getComponentType().name())
                .name(c.getName())
                .content(c.getContent())
                .isVisible(c.getIsVisible())
                .sortOrder(c.getSortOrder())
                .decorators(decorators)
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private DecoratorResponse toDecoratorResponse(ComponentDecorator d) {
        return DecoratorResponse.builder()
                .decoratorId(d.getDecoratorId())
                .componentId(d.getComponent().getComponentId())
                .priority(d.getPriority())
                .data(d.getData())
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                .build();
    }

    private StorefrontDTOs.MediaResponse toMediaResponse(StorefrontMedia m) {
        return StorefrontDTOs.MediaResponse.builder()
                .mediaId(m.getMediaId())
                .storeId(m.getStore().getStoreId())
                .url(m.getUrl())
                .name(m.getName())
                .mediaType(m.getMediaType())
                .uploadedAt(m.getUploadedAt())
                .build();
    }

    private String textOf(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }
}
