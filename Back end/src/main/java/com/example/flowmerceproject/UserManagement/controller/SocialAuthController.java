package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.config.CookieUtil;
import com.example.flowmerceproject.UserManagement.dto.AuthResponse;
import com.example.flowmerceproject.UserManagement.service.SocialAuthService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

/**
 * OAuth2 Social Login endpoints.
 *
 * GET  /auth/social/{provider}/redirect
 *      → 302 to Google / Facebook consent screen
 *
 * GET  /auth/social/{provider}/callback?code=...&state=...
 *      → exchanges code, issues JWT, 302 to
 *        {frontendUrl}/login?accessToken=...&refreshToken=...&role=...
 *
 * Supported providers: google, facebook
 *
 * SecurityConfig already permits: /auth/social/{provider}/redirect and /callback
 */
@Slf4j
@RestController
@RequestMapping("/auth/social")
@RequiredArgsConstructor
public class SocialAuthController {

    private final SocialAuthService socialAuthService;
    private final CookieUtil cookieUtil;

    @Value("${jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    /**
     * Step 1 — redirect the browser to the provider's consent page.
     *
     * Example: GET /auth/social/google/redirect
     */
    @GetMapping("/{provider}/redirect")
    public ResponseEntity<Void> redirect(
            @PathVariable String provider,
            @RequestParam(required = false) String state) {

        String url = socialAuthService.buildAuthorizationUrl(provider, state);
        log.info("Redirecting to {} OAuth consent: {}", provider, url);
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(url))
                .build();
    }

    /**
     * Step 2 — provider callback.
     * Exchanges code, issues JWT, redirects browser to frontend.
     *
     * Example: GET /auth/social/google/callback?code=4/0AY0e...&state=xyz
     */
    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(
            @PathVariable String provider,
            @RequestParam String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            HttpServletResponse response) {

        if (error != null) {
            log.warn("{} OAuth error: {}", provider, error);
            String frontendError = socialAuthService.buildFrontendRedirect(null)
                    .replaceAll("accessToken=.*", "error=" + error);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(frontendError))
                    .build();
        }

        log.info("{} OAuth callback received, exchanging code...", provider);
        AuthResponse auth = socialAuthService.handleCallback(provider, code);

        // SEC-6 parity: password login sets an httpOnly cookie alongside the JSON
        // token (AuthController#login); without it, an OAuth session has no
        // fallback if the bearer token ever fails to reach a request, since the
        // browser navigated here via a top-level redirect rather than an AJAX call.
        cookieUtil.setAuthCookies(response, CookieUtil.MERCHANT_SCOPE,
                auth.getAccessToken(), auth.getRefreshToken(),
                jwtExpirationMs / 1000, 30L * 24 * 3600);

        String redirectUrl = socialAuthService.buildFrontendRedirect(auth);

        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(URI.create(redirectUrl));
        return new ResponseEntity<>(headers, HttpStatus.FOUND);
    }
}
