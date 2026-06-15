package com.example.flowmerceproject.UserManagement.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * SEC-6: builds and clears httpOnly + Secure JWT cookies so the access token
 * is never accessible via JavaScript (mitigates XSS token theft).
 */
@Component
public class CookieUtil {

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    private static final String ACCESS_COOKIE  = "access_token";
    private static final String REFRESH_COOKIE = "refresh_token";

    private boolean isSecure() {
        return frontendUrl.startsWith("https://");
    }

    /** Set both tokens as httpOnly cookies on the response. */
    public void setAuthCookies(HttpServletResponse response,
                               String accessToken,
                               String refreshToken,
                               long accessTtlSeconds,
                               long refreshTtlSeconds) {
        response.addHeader("Set-Cookie",
            ResponseCookie.from(ACCESS_COOKIE, accessToken)
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1")
                .maxAge(accessTtlSeconds)
                .sameSite("Lax")
                .build().toString());

        response.addHeader("Set-Cookie",
            ResponseCookie.from(REFRESH_COOKIE, refreshToken)
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1/auth")   // scoped to auth endpoints only
                .maxAge(refreshTtlSeconds)
                .sameSite("Lax")
                .build().toString());
    }

    /** Clear both auth cookies on logout. */
    public void clearAuthCookies(HttpServletResponse response) {
        response.addHeader("Set-Cookie",
            ResponseCookie.from(ACCESS_COOKIE, "")
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1")
                .maxAge(0)
                .sameSite("Lax")
                .build().toString());

        response.addHeader("Set-Cookie",
            ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(isSecure())
                .path("/api/v1/auth")
                .maxAge(0)
                .sameSite("Lax")
                .build().toString());
    }

    /** Extract the access token from cookies (returns null if absent). */
    public static String extractAccessToken(jakarta.servlet.http.HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var c : request.getCookies()) {
            if (ACCESS_COOKIE.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    /** Extract the refresh token from cookies (returns null if absent). */
    public static String extractRefreshToken(jakarta.servlet.http.HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var c : request.getCookies()) {
            if (REFRESH_COOKIE.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
