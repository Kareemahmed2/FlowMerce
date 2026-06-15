package com.example.flowmerceproject.UserManagement.dto;

import lombok.Data;

/**
 * DTOs for the Social / OAuth2 login flow.
 *
 * Flow:
 *   1. Frontend redirects user to  GET /auth/social/{provider}/redirect
 *   2. Provider redirects back to  GET /auth/social/{provider}/callback?code=...
 *   3. Backend exchanges code → user info → issues our own JWT
 *   4. Backend redirects browser to {frontendUrl}/login?token=...&refreshToken=...
 */
public class OAuth2DTOs {

    /** Returned after a successful social login (same shape as AuthResponse). */
    @Data
    public static class SocialAuthResponse {
        private String accessToken;
        private String refreshToken;
        private long   expiresIn;
        private UserInfo user;
    }

    @Data
    public static class UserInfo {
        private Integer id;
        private String  name;
        private String  email;
        private String  role;
        private String  provider;
    }

    /** Raw user-info returned by Google's userinfo endpoint. */
    @Data
    public static class GoogleUserInfo {
        private String id;
        private String email;
        private String name;
        private String picture;
    }

    /** Raw user-info returned by Facebook's Graph API. */
    @Data
    public static class FacebookUserInfo {
        private String id;
        private String name;
        private String email;
    }

    /** Facebook token exchange response. */
    @Data
    public static class FacebookTokenResponse {
        private String access_token;
        private String token_type;
    }

    /** Google token exchange response. */
    @Data
    public static class GoogleTokenResponse {
        private String access_token;
        private String id_token;
        private String token_type;
        private Integer expires_in;
        private String refresh_token;
        private String scope;
    }
}
