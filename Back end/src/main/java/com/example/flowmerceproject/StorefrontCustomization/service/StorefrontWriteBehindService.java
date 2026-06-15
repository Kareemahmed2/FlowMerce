package com.example.flowmerceproject.StorefrontCustomization.service;

import com.example.flowmerceproject.StorefrontCustomization.dto.StorefrontDTOs.UpdateThemeRequest;
import com.example.flowmerceproject.StorefrontCustomization.entity.ThemeTemplate;
import com.example.flowmerceproject.StorefrontCustomization.repository.ThemeTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Asynchronous DB persistence for the write-behind (write-back) cache strategy.
 *
 * This must be a separate Spring bean from {@link StorefrontCustomizationService}
 * so that {@code @Async} can be applied via Spring's AOP proxy. Calls that
 * originate from within the same bean would bypass the proxy and execute
 * synchronously.
 *
 * Flow:
 *   1. Service writes to Redis immediately → returns 200 to the merchant.
 *   2. Service calls this bean asynchronously.
 *   3. This bean opens its own transaction and persists to PostgreSQL.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StorefrontWriteBehindService {

    private final ThemeTemplateRepository themeRepository;

    /**
     * Persists theme colour changes to PostgreSQL after the cache has already
     * been updated. Runs on Spring's default async executor thread pool.
     *
     * @param themeId the PK of the ThemeTemplate to update
     * @param req     the partial update request (null fields = no change)
     */
    @Async
    @Transactional
    public void persistThemeUpdate(Long themeId, UpdateThemeRequest req) {
        ThemeTemplate theme = themeRepository.findById(themeId).orElse(null);
        if (theme == null) {
            log.warn("Write-behind: ThemeTemplate {} not found — skipping DB write", themeId);
            return;
        }

        if (req.getBackground() != null) theme.setBackground(req.getBackground());
        if (req.getHeader()     != null) theme.setHeader(req.getHeader());
        if (req.getFooter()     != null) theme.setFooter(req.getFooter());
        if (req.getAccent()     != null) theme.setAccent(req.getAccent());
        if (req.getText()       != null) theme.setText(req.getText());
        if (req.getCard()       != null) theme.setCard(req.getCard());

        themeRepository.save(theme);
        log.debug("Write-behind: persisted theme {} to DB", themeId);
    }
}
