package com.example.flowmerceproject.UserManagement.service;

import com.example.flowmerceproject.UserManagement.config.JwtUtil;
import com.example.flowmerceproject.UserManagement.dto.AuthResponse;
import com.example.flowmerceproject.UserManagement.dto.OAuth2DTOs;
import com.example.flowmerceproject.UserManagement.entity.Role;
import com.example.flowmerceproject.UserManagement.entity.Session;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.SessionRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Handles OAuth2 Authorization Code flow for Google and Facebook.
 *
 * Flow:
 *   1. GET /auth/social/{provider}/redirect  →  redirects browser to provider's consent page
 *   2. Provider calls back GET /auth/social/{provider}/callback?code=&state=
 *   3. We exchange code for tokens, fetch user info, find-or-create a User row,
 *      issue our own JWT, and redirect the browser to the frontend with token params.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SocialAuthService {

    private final UserRepository     userRepository;
    private final MerchantRepository merchantRepository;
    private final SessionRepository  sessionRepository;
    private final JwtUtil            jwtUtil;
    private final RestTemplate       restTemplate;

    @Value("${jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    // ── Google config ──────────────────────────────────────────────────────────

    @Value("${oauth2.google.client-id:}")
    private String googleClientId;

    @Value("${oauth2.google.client-secret:}")
    private String googleClientSecret;

    @Value("${oauth2.google.redirect-uri:http://localhost:8080/api/v1/auth/social/google/callback}")
    private String googleRedirectUri;

    private static final String GOOGLE_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token";
    private static final String GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

    // ── Facebook config ────────────────────────────────────────────────────────

    @Value("${oauth2.facebook.app-id:}")
    private String facebookAppId;

    @Value("${oauth2.facebook.app-secret:}")
    private String facebookAppSecret;

    @Value("${oauth2.facebook.redirect-uri:http://localhost:8080/api/v1/auth/social/facebook/callback}")
    private String facebookRedirectUri;

    private static final String FACEBOOK_AUTH_URL   = "https://www.facebook.com/v19.0/dialog/oauth";
    private static final String FACEBOOK_TOKEN_URL  = "https://graph.facebook.com/v19.0/oauth/access_token";
    private static final String FACEBOOK_USERINFO_URL = "https://graph.facebook.com/me?fields=id,name,email";

    // ── Public API ─────────────────────────────────────────────────────────────

    /** Build the URL to redirect the browser to the provider's consent page. */
    public String buildAuthorizationUrl(String provider, String state) {
        return switch (provider.toLowerCase()) {
            case "google" -> buildGoogleAuthUrl(state);
            case "facebook" -> buildFacebookAuthUrl(state);
            default -> throw new BadRequestException("Unsupported provider: " + provider);
        };
    }

    /** Exchange code for user info, find-or-create account, return our JWT. */
    @Transactional
    public AuthResponse handleCallback(String provider, String code) {
        return switch (provider.toLowerCase()) {
            case "google" -> handleGoogleCallback(code);
            case "facebook" -> handleFacebookCallback(code);
            default -> throw new BadRequestException("Unsupported provider: " + provider);
        };
    }

    /** Frontend redirect URL after successful social login. */
    public String buildFrontendRedirect(AuthResponse auth) {
        AuthResponse.UserInfo u = auth.getUser();
        try {
            return String.format(
                "%s/login?accessToken=%s&refreshToken=%s&expiresIn=%s&role=%s&userId=%s&email=%s&name=%s",
                frontendUrl,
                auth.getAccessToken(),
                auth.getRefreshToken(),
                auth.getExpiresIn(),
                u.getRole(),
                u.getUserId(),
                java.net.URLEncoder.encode(u.getEmail() != null ? u.getEmail() : "", "UTF-8"),
                java.net.URLEncoder.encode(u.getFullName() != null ? u.getFullName() : "", "UTF-8")
            );
        } catch (java.io.UnsupportedEncodingException e) {
            // UTF-8 is always supported
            throw new RuntimeException(e);
        }
    }

    // ── Google ─────────────────────────────────────────────────────────────────

    private String buildGoogleAuthUrl(String state) {
        if (googleClientId.isBlank()) {
            throw new BadRequestException("Google OAuth is not configured. Set oauth2.google.client-id.");
        }
        return GOOGLE_AUTH_URL
            + "?client_id=" + googleClientId
            + "&redirect_uri=" + googleRedirectUri
            + "&response_type=code"
            + "&scope=openid%20email%20profile"
            + "&state=" + (state != null ? state : UUID.randomUUID())
            + "&access_type=offline"
            + "&prompt=consent";
    }

    private AuthResponse handleGoogleCallback(String code) {
        // 1. Exchange code for access token
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("code", code);
        params.add("client_id", googleClientId);
        params.add("client_secret", googleClientSecret);
        params.add("redirect_uri", googleRedirectUri);
        params.add("grant_type", "authorization_code");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<OAuth2DTOs.GoogleTokenResponse> tokenResp =
            restTemplate.postForEntity(
                GOOGLE_TOKEN_URL,
                new HttpEntity<>(params, headers),
                OAuth2DTOs.GoogleTokenResponse.class);

        if (!tokenResp.getStatusCode().is2xxSuccessful() || tokenResp.getBody() == null) {
            throw new BadRequestException("Failed to exchange Google code for token.");
        }

        // 2. Fetch user info
        HttpHeaders infoHeaders = new HttpHeaders();
        infoHeaders.setBearerAuth(tokenResp.getBody().getAccess_token());
        ResponseEntity<OAuth2DTOs.GoogleUserInfo> infoResp =
            restTemplate.exchange(GOOGLE_USERINFO_URL, HttpMethod.GET,
                new HttpEntity<>(infoHeaders), OAuth2DTOs.GoogleUserInfo.class);

        if (!infoResp.getStatusCode().is2xxSuccessful() || infoResp.getBody() == null) {
            throw new BadRequestException("Failed to fetch Google user info.");
        }

        OAuth2DTOs.GoogleUserInfo info = infoResp.getBody();
        if (info.getEmail() == null || info.getEmail().isBlank()) {
            throw new BadRequestException("Google account has no email address.");
        }

        return findOrCreateMerchant(info.getEmail(), info.getName(), "GOOGLE");
    }

    // ── Facebook ───────────────────────────────────────────────────────────────

    private String buildFacebookAuthUrl(String state) {
        if (facebookAppId.isBlank()) {
            throw new BadRequestException("Facebook OAuth is not configured. Set oauth2.facebook.app-id.");
        }
        return FACEBOOK_AUTH_URL
            + "?client_id=" + facebookAppId
            + "&redirect_uri=" + facebookRedirectUri
            + "&scope=email,public_profile"
            + "&state=" + (state != null ? state : UUID.randomUUID());
    }

    private AuthResponse handleFacebookCallback(String code) {
        // 1. Exchange code for access token
        String tokenUrl = FACEBOOK_TOKEN_URL
            + "?client_id=" + facebookAppId
            + "&redirect_uri=" + facebookRedirectUri
            + "&client_secret=" + facebookAppSecret
            + "&code=" + code;

        ResponseEntity<OAuth2DTOs.FacebookTokenResponse> tokenResp =
            restTemplate.getForEntity(tokenUrl, OAuth2DTOs.FacebookTokenResponse.class);

        if (!tokenResp.getStatusCode().is2xxSuccessful() || tokenResp.getBody() == null) {
            throw new BadRequestException("Failed to exchange Facebook code for token.");
        }

        // 2. Fetch user info
        String infoUrl = FACEBOOK_USERINFO_URL
            + "&access_token=" + tokenResp.getBody().getAccess_token();

        ResponseEntity<OAuth2DTOs.FacebookUserInfo> infoResp =
            restTemplate.getForEntity(infoUrl, OAuth2DTOs.FacebookUserInfo.class);

        if (!infoResp.getStatusCode().is2xxSuccessful() || infoResp.getBody() == null) {
            throw new BadRequestException("Failed to fetch Facebook user info.");
        }

        OAuth2DTOs.FacebookUserInfo info = infoResp.getBody();
        if (info.getEmail() == null || info.getEmail().isBlank()) {
            throw new BadRequestException(
                "Facebook account has no email address. Please grant email permission.");
        }

        return findOrCreateMerchant(info.getEmail(), info.getName(), "FACEBOOK");
    }

    // ── Shared: find-or-create + issue JWT ────────────────────────────────────

    private AuthResponse findOrCreateMerchant(String email, String name, String provider) {
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            // New social user: create with a random unusable password
            User newUser = User.builder()
                .email(email)
                .passwordHash("{noop}" + UUID.randomUUID())  // not usable for password login
                .fullName(name != null ? name : email.split("@")[0])
                .role(Role.MERCHANT)
                .isActive(true)  // social accounts are pre-verified by the provider
                .isMfaEnabled(false)
                .build();
            userRepository.save(newUser);

            merchantRepository.save(
                com.example.flowmerceproject.UserManagement.entity.Merchant.builder()
                    .user(newUser)
                    .businessName(name != null ? name : email.split("@")[0])
                    .build());

            log.info("Created new merchant via {} OAuth: {}", provider, email);
            return newUser;
        });

        if (!user.getIsActive()) {
            user.setIsActive(true);
            userRepository.save(user);
        }

        // Issue our own JWT (same as password login)
        String accessToken  = jwtUtil.generateToken(user.getEmail(), user.getRole().name());
        String refreshToken = UUID.randomUUID().toString();

        sessionRepository.save(Session.builder()
            .user(user).token(accessToken)
            .isRevoked(false)
            .createdAt(LocalDateTime.now())
            .expiresAt(LocalDateTime.now().plusSeconds(jwtExpirationMs / 1000))
            .build());

        sessionRepository.save(Session.builder()
            .user(user).token(refreshToken)
            .isRevoked(false)
            .createdAt(LocalDateTime.now())
            .expiresAt(LocalDateTime.now().plusDays(30))
            .build());

        return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .expiresIn(jwtExpirationMs)
            .user(AuthResponse.UserInfo.builder()
                .userId(user.getUserId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .createdAt(user.getCreatedAt())
                .build())
            .build();
    }
}
