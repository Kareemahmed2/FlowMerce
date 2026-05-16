package com.example.flowmerceproject.StorefrontCustomization.service;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.*;
import com.example.flowmerceproject.StorefrontCustomization.entity.*;
import com.example.flowmerceproject.StorefrontCustomization.repository.*;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
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

    @Value("${storefront.cache.ttl-minutes:30}")
    private long ttlMinutes;

    private static final String CACHE_KEY_PREFIX = "flowmerce:sf:";

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
    public StorefrontTemplateResponse getPublicStorefront(String storeUrl) {
        String cacheKey = CACHE_KEY_PREFIX + storeUrl;
        Optional<StorefrontTemplateResponse> cached = getFromCache(cacheKey);
        if (cached.isPresent()) return cached.get();

        StorefrontTemplate template = templateRepository.findPublishedByStoreUrl(storeUrl)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No published storefront found for: " + storeUrl));

        StorefrontTemplateResponse response = toResponseWithComponents(template);
        putInCache(cacheKey, response);
        return response;
    }

    // ── THEME (DESIGN) ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DesignResponse getDesign(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        ThemeTemplate theme = template.getTheme();
        if (theme == null) {
            return DesignResponse.builder().build();
        }
        return toDesignResponse(theme);
    }

    @Transactional
    public DesignResponse saveDesign(String email, Integer storeId, JsonNode data) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        ThemeTemplate theme = template.getTheme();

        if (theme == null) {
            theme = new ThemeTemplate();
            template.setTheme(theme);
        }

        if (data.has("background")) theme.setBackground(data.get("background").asText());
        if (data.has("header"))     theme.setHeader(data.get("header").asText());
        if (data.has("footer"))     theme.setFooter(data.get("footer").asText());
        if (data.has("accent"))     theme.setAccent(data.get("accent").asText());
        if (data.has("text"))       theme.setText(data.get("text").asText());
        if (data.has("card"))       theme.setCard(data.get("card").asText());

        themeRepository.save(theme);
        evictCache(store.getStoreUrl());
        return toDesignResponse(theme);
    }

    @Transactional(readOnly = true)
    public ThemeResponse updateTheme(String email, Integer storeId, UpdateThemeRequest req) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);

        String cacheKey = CACHE_KEY_PREFIX + store.getStoreUrl();
        StorefrontTemplateResponse cached = getFromCache(cacheKey).orElseGet(() -> toResponse(template));

        ThemeResponse currentTheme = cached.getTheme();
        ThemeResponse updatedTheme = ThemeResponse.builder()
                .themeId(currentTheme.getThemeId())
                .background(req.getBackground() != null ? req.getBackground() : currentTheme.getBackground())
                .header(req.getHeader()         != null ? req.getHeader()     : currentTheme.getHeader())
                .footer(req.getFooter()         != null ? req.getFooter()     : currentTheme.getFooter())
                .accent(req.getAccent()         != null ? req.getAccent()     : currentTheme.getAccent())
                .text(req.getText()             != null ? req.getText()       : currentTheme.getText())
                .card(req.getCard()             != null ? req.getCard()       : currentTheme.getCard())
                .updatedAt(LocalDateTime.now())
                .build();

        // Evict instead of write-behind so next read assembles a fresh document
        evictCache(store.getStoreUrl());
        writeBehindService.persistThemeUpdate(currentTheme.getThemeId(), req);
        return updatedTheme;
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
        putInCache(CACHE_KEY_PREFIX + store.getStoreUrl(), response);
        return response;
    }

    @Transactional
    public StorefrontTemplateResponse unpublishStorefront(String email, Integer storeId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        StorefrontTemplate template = requireTemplate(storeId);
        template.setStatus(StorefrontTemplate.StorefrontStatus.PAUSED);
        templateRepository.save(template);
        evictCache(store.getStoreUrl());
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
        evictCache(store.getStoreUrl());
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
        evictCache(store.getStoreUrl());
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
        evictCache(store.getStoreUrl());
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
        evictCache(store.getStoreUrl());
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
        evictCache(store.getStoreUrl());
        return toComponentResponse(component);
    }

    @Transactional
    public void deleteComponent(String email, Integer storeId, Long pageId, Long componentId) {
        Store store = getStoreAndVerifyOwner(email, storeId);
        BaseComponent component = requireComponent(componentId);
        componentRepository.delete(component);
        evictCache(store.getStoreUrl());
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
        evictCache(store.getStoreUrl());
        return componentRepository.findByPage_PageIdOrderBySortOrderAsc(pageId)
                .stream().map(this::toComponentResponse).collect(Collectors.toList());
    }

    // ── DECORATORS (stub — DecoratorComponent is an interface, no entity exists) ──

    public List<DecoratorResponse> listDecorators(String email, Integer storeId, Long componentId) {
        getStoreAndVerifyOwner(email, storeId);
        return List.of(); // No decorator entity — return empty list
    }

    public DecoratorResponse addDecorator(String email, Integer storeId,
                                          Long componentId, JsonNode data) {
        getStoreAndVerifyOwner(email, storeId);
        return DecoratorResponse.builder()
                .message("Decorator persistence not yet implemented — no entity defined.")
                .build();
    }

    public DecoratorResponse updateDecorator(String email, Integer storeId,
                                             Long componentId, Long decoratorId, JsonNode data) {
        getStoreAndVerifyOwner(email, storeId);
        return DecoratorResponse.builder()
                .message("Decorator persistence not yet implemented — no entity defined.")
                .build();
    }

    public void deleteDecorator(String email, Integer storeId,
                                Long componentId, Long decoratorId) {
        getStoreAndVerifyOwner(email, storeId);
    }

    // ── MEDIA (stub — no media entity exists) ────────────────────────────────

    public List<Object> listMedia(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        return List.of();
    }

    public Object saveMedia(String email, Integer storeId, JsonNode data) {
        getStoreAndVerifyOwner(email, storeId);
        return java.util.Map.of("message", "Media persistence not yet implemented.");
    }

    public void deleteMedia(String email, Integer storeId, Long mediaId) {
        getStoreAndVerifyOwner(email, storeId);
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

    private void evictCache(String storeUrl) {
        try {
            redisTemplate.delete(CACHE_KEY_PREFIX + storeUrl);
        } catch (Exception e) {
            log.warn("Cache evict failed for store '{}': {}", storeUrl, e.getMessage());
        }
    }

    // ── AUTH & GUARD HELPERS ──────────────────────────────────────────────────

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
                    PageSummary ps = toPageSummary(p);
                    return ps;
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
        return ComponentResponse.builder()
                .componentId(c.getComponentId())
                .componentType(c.getComponentType().name())
                .name(c.getName())
                .content(c.getContent())
                .isVisible(c.getIsVisible())
                .sortOrder(c.getSortOrder())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private String textOf(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }
}
